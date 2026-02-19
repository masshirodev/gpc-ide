use crate::models::config::GameConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMeta {
    pub id: String,
    pub timestamp: u64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SnapshotIndex {
    snapshots: Vec<SnapshotMeta>,
}

fn history_dir(game_path: &str) -> PathBuf {
    PathBuf::from(game_path).join(".history")
}

fn index_path(game_path: &str) -> PathBuf {
    history_dir(game_path).join("snapshots.json")
}

fn load_index(game_path: &str) -> SnapshotIndex {
    let path = index_path(game_path);
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(SnapshotIndex { snapshots: vec![] })
    } else {
        SnapshotIndex { snapshots: vec![] }
    }
}

fn save_index(game_path: &str, index: &SnapshotIndex) -> Result<(), String> {
    let dir = history_dir(game_path);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create .history directory: {}", e))?;
    let content = serde_json::to_string_pretty(index)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;
    std::fs::write(index_path(game_path), content)
        .map_err(|e| format!("Failed to write index: {}", e))?;
    Ok(())
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Create a snapshot of the current config.toml
#[tauri::command]
pub fn create_snapshot(game_path: String, label: Option<String>) -> Result<SnapshotMeta, String> {
    let config_path = PathBuf::from(&game_path).join("config.toml");
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.toml: {}", e))?;

    let ts = now_ts();
    let id = format!("{}", ts);

    let dir = history_dir(&game_path);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create .history directory: {}", e))?;

    // Save the TOML content as-is
    let snapshot_file = dir.join(format!("{}.toml", id));
    std::fs::write(&snapshot_file, &content)
        .map_err(|e| format!("Failed to write snapshot: {}", e))?;

    let meta = SnapshotMeta {
        id: id.clone(),
        timestamp: ts,
        label,
    };

    let mut index = load_index(&game_path);
    index.snapshots.push(meta.clone());
    save_index(&game_path, &index)?;

    Ok(meta)
}

/// List all snapshots for a game
#[tauri::command]
pub fn list_snapshots(game_path: String) -> Result<Vec<SnapshotMeta>, String> {
    let index = load_index(&game_path);
    let mut snapshots = index.snapshots;
    snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp)); // newest first
    Ok(snapshots)
}

/// Get a snapshot's config content
#[tauri::command]
pub fn get_snapshot(game_path: String, snapshot_id: String) -> Result<String, String> {
    let file = history_dir(&game_path).join(format!("{}.toml", snapshot_id));
    std::fs::read_to_string(&file)
        .map_err(|e| format!("Snapshot not found: {}", e))
}

/// Rollback to a snapshot (auto-snapshots current state first)
#[tauri::command]
pub fn rollback_snapshot(game_path: String, snapshot_id: String) -> Result<SnapshotMeta, String> {
    // Auto-snapshot current state before rollback
    let auto_meta = create_snapshot(game_path.clone(), Some("Auto-save before rollback".into()))?;

    // Read the target snapshot
    let file = history_dir(&game_path).join(format!("{}.toml", snapshot_id));
    let content = std::fs::read_to_string(&file)
        .map_err(|e| format!("Snapshot not found: {}", e))?;

    // Write it as the current config
    let config_path = PathBuf::from(&game_path).join("config.toml");
    std::fs::write(&config_path, &content)
        .map_err(|e| format!("Failed to restore config: {}", e))?;

    Ok(auto_meta)
}

/// Delete a snapshot
#[tauri::command]
pub fn delete_snapshot(game_path: String, snapshot_id: String) -> Result<(), String> {
    let file = history_dir(&game_path).join(format!("{}.toml", snapshot_id));
    if file.exists() {
        std::fs::remove_file(&file)
            .map_err(|e| format!("Failed to delete snapshot file: {}", e))?;
    }

    let mut index = load_index(&game_path);
    index.snapshots.retain(|s| s.id != snapshot_id);
    save_index(&game_path, &index)?;

    Ok(())
}

/// Rename a snapshot
#[tauri::command]
pub fn rename_snapshot(
    game_path: String,
    snapshot_id: String,
    label: String,
) -> Result<(), String> {
    let mut index = load_index(&game_path);
    if let Some(s) = index.snapshots.iter_mut().find(|s| s.id == snapshot_id) {
        s.label = Some(label);
    } else {
        return Err("Snapshot not found".into());
    }
    save_index(&game_path, &index)?;
    Ok(())
}
