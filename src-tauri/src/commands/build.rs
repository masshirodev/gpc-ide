use crate::commands::game::app_root;
use crate::pipeline::build::{BuildResult, build_game};
use std::path::PathBuf;

/// Build a game by preprocessing its main.gpc and writing the output to Dist/
#[tauri::command]
pub fn build_game_cmd(game_path: String) -> Result<BuildResult, String> {
    let root = app_root();
    let game_dir = PathBuf::from(&game_path);

    if !game_dir.exists() {
        return Err(format!("Game directory not found: {}", game_path));
    }

    let result = build_game(&game_dir, &root, true);
    Ok(result)
}

/// Get the list of available games that can be built
#[tauri::command]
pub fn get_build_output_path(game_path: String) -> Result<String, String> {
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

    let root = app_root();
    let output_path = root.join("Dist").join(format!("{}{}.gpc", filename, version));
    Ok(output_path.to_string_lossy().to_string())
}
