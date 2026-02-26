use crate::models::config::{GameConfig, GameSummary};
use crate::models::game_meta::GameMeta;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

/// Get the most recent modification time (ms since epoch) of key files in a game directory.
fn game_dir_modified_ms(game_dir: &Path) -> u64 {
    let candidates = ["game.json", "config.toml", "main.gpc"];
    let mut latest: u64 = 0;
    for name in &candidates {
        if let Ok(meta) = std::fs::metadata(game_dir.join(name)) {
            if let Ok(modified) = meta.modified() {
                let ms = modified
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
                if ms > latest {
                    latest = ms;
                }
            }
        }
    }
    // Fallback to dir itself
    if latest == 0 {
        if let Ok(meta) = std::fs::metadata(game_dir) {
            if let Ok(modified) = meta.modified() {
                latest = modified
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
            }
        }
    }
    latest
}

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

/// Scan workspace directories for games.
/// Detects both game.json (flow-based) and config.toml (legacy config-based) games.
#[tauri::command]
pub fn list_games(workspace_paths: Option<Vec<String>>) -> Result<Vec<GameSummary>, String> {
    let mut games = Vec::new();
    let mut scanned_paths = std::collections::HashSet::new();

    let paths_to_scan: Vec<PathBuf> = if let Some(workspaces) = workspace_paths {
        workspaces.into_iter().filter(|w| !w.is_empty()).map(PathBuf::from).collect()
    } else {
        Vec::new()
    };

    if paths_to_scan.is_empty() {
        return Ok(games);
    }

    for workspace_path in paths_to_scan {
        if !workspace_path.exists() {
            log::warn!("Workspace directory not found: {}", workspace_path.display());
            continue;
        }

        for entry in WalkDir::new(&workspace_path)
            .min_depth(1)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let filename = entry.file_name().to_string_lossy().to_string();
            if filename != "game.json" && filename != "config.toml" {
                continue;
            }

            let file_path = entry.path();
            let game_dir = file_path.parent().unwrap();

            let canonical_path = game_dir.canonicalize().unwrap_or_else(|_| game_dir.to_path_buf());
            if !scanned_paths.insert(canonical_path) {
                continue;
            }

            if filename == "game.json" {
                // Flow-based game (preferred over config.toml if both exist)
                match parse_game_summary_from_meta(game_dir) {
                    Ok(summary) => games.push(summary),
                    Err(e) => {
                        log::warn!("Failed to parse {}: {}", file_path.display(), e);
                    }
                }
            } else {
                // Legacy config-based game (only if no game.json exists)
                if !game_dir.join("game.json").exists() {
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
                    match parse_game_summary_from_config(file_path) {
                        Ok(summary) => games.push(summary),
                        Err(e) => {
                            log::warn!("Failed to parse {}: {}", file_path.display(), e);
                        }
                    }
                }
            }
        }
    }

    games.sort_by(|a, b| a.game_type.cmp(&b.game_type).then(a.name.cmp(&b.name)));
    Ok(games)
}

fn parse_game_summary_from_meta(game_dir: &Path) -> Result<GameSummary, String> {
    let meta_path = game_dir.join("game.json");
    let content = std::fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read {}: {}", meta_path.display(), e))?;

    let meta: GameMeta =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse game.json: {}", e))?;

    let updated_at = game_dir_modified_ms(game_dir);

    Ok(GameSummary {
        name: meta.name.clone(),
        path: game_dir.to_string_lossy().to_string(),
        game_type: meta.game_type.clone(),
        console_type: meta.console_type.clone(),
        version: meta.version,
        title: meta.name.clone(),
        module_count: 0,
        generation_mode: meta.generation_mode.clone(),
        updated_at,
    })
}

fn parse_game_summary_from_config(config_path: &Path) -> Result<GameSummary, String> {
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

    let updated_at = game_dir_modified_ms(game_dir);

    Ok(GameSummary {
        name,
        path: game_dir.to_string_lossy().to_string(),
        game_type,
        console_type,
        version: config.version,
        title: config.state_screen.title.clone(),
        module_count: config.menu.len(),
        generation_mode: "config".to_string(),
        updated_at,
    })
}

/// Get the full config for a specific game (legacy config-based games)
#[tauri::command]
pub fn get_game_config(game_path: String) -> Result<GameConfig, String> {
    let config_path = Path::new(&game_path).join("config.toml");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;

    toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
}

/// Save game metadata to game.json
#[tauri::command]
pub fn save_game_meta(game_path: String, meta: GameMeta) -> Result<(), String> {
    let path = Path::new(&game_path).join("game.json");
    let content = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize game meta: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write game.json: {}", e))?;
    Ok(())
}

/// Load game metadata from game.json
#[tauri::command]
pub fn load_game_meta(game_path: String) -> Result<Option<GameMeta>, String> {
    let path = Path::new(&game_path).join("game.json");
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read game.json: {}", e))?;
    let meta: GameMeta = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse game.json: {}", e))?;
    Ok(Some(meta))
}

/// Delete an entire game directory
#[tauri::command]
pub fn delete_game(game_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&game_path);
    if !path.exists() {
        return Err("Game directory not found".to_string());
    }
    // Safety: require game.json or config.toml to confirm it's a real game dir
    if !path.join("game.json").exists() && !path.join("config.toml").exists() {
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
