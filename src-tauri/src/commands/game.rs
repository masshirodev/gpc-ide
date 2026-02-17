use crate::models::config::{GameConfig, GameSummary};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Resolve the app root directory (where bundled resources like modules/, common/, drawings/ live).
/// In dev mode, the exe is in src-tauri/target/debug/, so we walk up to find modules/.
/// In production, we do the same from the exe location.
pub fn app_root() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = exe_dir {
        let mut current = dir.as_path();
        for _ in 0..10 {
            if current.join("modules").is_dir() {
                return current.to_path_buf();
            }
            if let Some(parent) = current.parent() {
                current = parent;
            } else {
                break;
            }
        }
    }

    // Fallback: check from cwd
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut current = cwd.as_path();
    for _ in 0..5 {
        if current.join("modules").is_dir() {
            return current.to_path_buf();
        }
        if let Some(parent) = current.parent() {
            current = parent;
        } else {
            break;
        }
    }

    cwd
}

/// Scan the Games/ directory for all game configs
/// If workspace_paths is provided and non-empty, scan those directories instead of the default Games dir
#[tauri::command]
pub fn list_games(workspace_paths: Option<Vec<String>>) -> Result<Vec<GameSummary>, String> {
    let mut games = Vec::new();
    let mut scanned_paths = std::collections::HashSet::new();

    // Determine which directories to scan
    let paths_to_scan: Vec<PathBuf> = if let Some(workspaces) = workspace_paths {
        workspaces.into_iter().filter(|w| !w.is_empty()).map(PathBuf::from).collect()
    } else {
        Vec::new()
    };

    if paths_to_scan.is_empty() {
        return Ok(games);
    }

    // Scan each workspace directory
    for workspace_path in paths_to_scan {
        if !workspace_path.exists() {
            log::warn!("Workspace directory not found: {}", workspace_path.display());
            continue;
        }

        // Games are organized as <Workspace>/<Category>/<GameName>/config.toml
        // or <Workspace>/<GameName>/config.toml
        // Only include modular games (those with a modules/ subdirectory)
        for entry in WalkDir::new(&workspace_path)
            .min_depth(1)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_name() == "config.toml" {
                let config_path = entry.path();
                let game_dir = config_path.parent().unwrap();

                // Skip if we've already processed this game directory
                let canonical_path = game_dir.canonicalize().unwrap_or_else(|_| game_dir.to_path_buf());
                if !scanned_paths.insert(canonical_path) {
                    continue;
                }

                // Ensure modules/ directory exists for modular games
                let modules_dir = game_dir.join("modules");
                if !modules_dir.is_dir() {
                    if let Err(e) = std::fs::create_dir_all(&modules_dir) {
                        log::warn!(
                            "Failed to create Modules dir for {}: {}",
                            game_dir.display(),
                            e
                        );
                        continue;
                    }
                }
                match parse_game_summary(config_path) {
                    Ok(summary) => games.push(summary),
                    Err(e) => {
                        log::warn!("Failed to parse {}: {}", config_path.display(), e);
                    }
                }
            }
        }
    }

    games.sort_by(|a, b| a.game_type.cmp(&b.game_type).then(a.name.cmp(&b.name)));
    Ok(games)
}

fn parse_game_summary(config_path: &Path) -> Result<GameSummary, String> {
    let content = std::fs::read_to_string(config_path)
        .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;

    let config: GameConfig =
        toml::from_str(&content).map_err(|e| format!("Failed to parse TOML: {}", e))?;

    let game_dir = config_path.parent().unwrap();
    let folder_name = game_dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let name = config.name.clone().unwrap_or(folder_name);

    let game_type = config.r#type.clone().unwrap_or_else(|| "fps".to_string());
    let console_type = config.console_type.clone().unwrap_or_else(|| "ps5".to_string());

    Ok(GameSummary {
        name,
        path: game_dir.to_string_lossy().to_string(),
        game_type,
        console_type,
        version: config.version,
        title: config.state_screen.title.clone(),
        module_count: config.menu.len(),
    })
}

/// Get the full config for a specific game
#[tauri::command]
pub fn get_game_config(game_path: String) -> Result<GameConfig, String> {
    let config_path = Path::new(&game_path).join("config.toml");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;

    toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
}

/// Delete an entire game directory
#[tauri::command]
pub fn delete_game(game_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&game_path);
    if !path.exists() {
        return Err("Game directory not found".to_string());
    }
    // Safety: require config.toml to confirm it's a real game dir
    if !path.join("config.toml").exists() {
        return Err("Not a valid game directory".to_string());
    }
    std::fs::remove_dir_all(path)
        .map_err(|e| format!("Failed to delete game directory: {}", e))?;
    Ok(())
}

/// Get the app root path (where bundled resources live)
#[tauri::command]
pub fn get_app_root() -> String {
    app_root().to_string_lossy().to_string()
}
