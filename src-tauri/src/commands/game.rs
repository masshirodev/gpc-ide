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
        tags: meta.tags.unwrap_or_default(),
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
        tags: Vec::new(),
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

/// Copy external files into a game directory
#[tauri::command]
pub fn import_files(game_path: String, file_paths: Vec<String>) -> Result<Vec<String>, String> {
    let dest = Path::new(&game_path);
    if !dest.is_dir() {
        return Err(format!("Game directory does not exist: {}", game_path));
    }
    let mut imported = Vec::new();
    for src_path in file_paths {
        let src = Path::new(&src_path);
        if !src.is_file() {
            continue;
        }
        let file_name = src
            .file_name()
            .ok_or_else(|| format!("Invalid file name: {}", src_path))?;
        let target = dest.join(file_name);
        std::fs::copy(src, &target)
            .map_err(|e| format!("Failed to copy {}: {}", src_path, e))?;
        imported.push(target.to_string_lossy().to_string());
    }
    Ok(imported)
}

/// Export a game directory as a zip archive
#[tauri::command]
pub fn export_game_zip(game_path: String, output_path: String) -> Result<String, String> {
    use std::io::Write;

    let game_dir = Path::new(&game_path);
    if !game_dir.is_dir() {
        return Err(format!("Game directory not found: {}", game_path));
    }

    let file = std::fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for entry in WalkDir::new(game_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path
            .strip_prefix(game_dir)
            .map_err(|e| format!("Path error: {}", e))?;
        let name_str = name.to_string_lossy();

        // Skip hidden files/dirs and build output
        if name_str.starts_with('.') || name_str.contains("/.") || name_str.starts_with("build") {
            continue;
        }

        if path.is_file() {
            zip.start_file(name_str.to_string(), options)
                .map_err(|e| format!("Failed to add file to zip: {}", e))?;
            let data = std::fs::read(path)
                .map_err(|e| format!("Failed to read {}: {}", name_str, e))?;
            zip.write_all(&data)
                .map_err(|e| format!("Failed to write to zip: {}", e))?;
        } else if path.is_dir() && !name_str.is_empty() {
            zip.add_directory(name_str.to_string(), options)
                .map_err(|e| format!("Failed to add directory to zip: {}", e))?;
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(output_path)
}

/// Import a game from a zip archive into a workspace
#[tauri::command]
pub fn import_game_zip(zip_path: String, workspace_path: String) -> Result<String, String> {
    use std::io::Read;

    let zip_file = std::fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("Invalid zip file: {}", e))?;

    // Determine game name from zip filename
    let zip_name = Path::new(&zip_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("imported-game")
        .to_string();

    let ws_dir = Path::new(&workspace_path);
    let game_dir = ws_dir.join(&zip_name);

    if game_dir.exists() {
        return Err(format!("Game '{}' already exists in workspace", zip_name));
    }

    std::fs::create_dir_all(&game_dir)
        .map_err(|e| format!("Failed to create game directory: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let name = file.name().to_string();

        // Security: skip absolute paths and path traversal
        if name.starts_with('/') || name.contains("..") {
            continue;
        }

        let out_path = game_dir.join(&name);

        if file.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut data = Vec::new();
            file.read_to_end(&mut data)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;
            std::fs::write(&out_path, &data)
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
    }

    Ok(game_dir.to_string_lossy().to_string())
}

/// Run a shell command in the context of a game directory
#[tauri::command]
pub fn run_task(game_path: String, command: String) -> Result<TaskResult, String> {
    let game_dir = Path::new(&game_path);
    if !game_dir.is_dir() {
        return Err(format!("Game directory not found: {}", game_path));
    }

    let output = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/C", &command])
            .current_dir(game_dir)
            .output()
    } else {
        std::process::Command::new("sh")
            .args(["-c", &command])
            .current_dir(game_dir)
            .output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            Ok(TaskResult {
                success: out.status.success(),
                exit_code: out.status.code().unwrap_or(-1),
                stdout,
                stderr,
            })
        }
        Err(e) => Err(format!("Failed to run command: {}", e)),
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TaskResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}
