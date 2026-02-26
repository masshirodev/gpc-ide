use crate::commands::game::app_root;
use crate::pipeline::build::{BuildResult, build_game, build_game_with_plugins};
use std::path::PathBuf;

/// Build a game by preprocessing its main.gpc and writing the output to {workspace}/dist/
#[tauri::command]
pub fn build_game_cmd(game_path: String, workspace_path: Option<String>) -> Result<BuildResult, String> {
    let root = app_root();
    let game_dir = PathBuf::from(&game_path);

    if !game_dir.exists() {
        return Err(format!("Game directory not found: {}", game_path));
    }

    // Determine dist base: workspace path if provided, otherwise app root
    let dist_base = workspace_path
        .as_ref()
        .map(|p| PathBuf::from(p))
        .unwrap_or_else(|| root.clone());

    // Use plugin-aware build when workspace path is available
    let result = match workspace_path.as_deref() {
        Some(ws) => build_game_with_plugins(&game_dir, &root, &dist_base, true, ws),
        None => build_game(&game_dir, &root, &dist_base, true),
    };
    Ok(result)
}

/// Get the expected build output path for a game
#[tauri::command]
pub fn get_build_output_path(game_path: String, workspace_path: Option<String>) -> Result<String, String> {
    let game_dir = PathBuf::from(&game_path);
    let config_path = game_dir.join("config.toml");

    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Could not read config.toml: {}", e))?;

    let config: toml::Value = toml::from_str(&config_content)
        .map_err(|e| format!("Could not parse config.toml: {}", e))?;

    let filename = config
        .get("filename")
        .and_then(|v| v.as_str())
        .unwrap_or("Output");
    let version = config
        .get("version")
        .and_then(|v| v.as_integer())
        .unwrap_or(1);

    let dist_base = workspace_path
        .map(PathBuf::from)
        .unwrap_or_else(|| app_root());

    let output_path = dist_base.join("dist").join(format!("{}{}.gpc", filename, version));
    Ok(output_path.to_string_lossy().to_string())
}
