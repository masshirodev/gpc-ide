use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpriteFrame {
    pub id: String,
    pub pixels: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpriteCollection {
    pub version: u8,
    pub id: String,
    pub name: String,
    pub frames: Vec<SpriteFrame>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpriteCollectionSummary {
    pub id: String,
    pub name: String,
    pub frame_count: usize,
    pub frame_width: u32,
    pub frame_height: u32,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SpriteIndex {
    version: u8,
    collections: Vec<SpriteCollectionSummary>,
}

fn sprites_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("_sprites")
}

fn index_path(workspace: &str) -> PathBuf {
    sprites_dir(workspace).join("index.json")
}

fn collection_path(workspace: &str, id: &str) -> PathBuf {
    sprites_dir(workspace).join(format!("{}.json", id))
}

fn read_index(workspace: &str) -> SpriteIndex {
    let path = index_path(workspace);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(index) = serde_json::from_str::<SpriteIndex>(&content) {
                return index;
            }
        }
    }
    SpriteIndex {
        version: 1,
        collections: vec![],
    }
}

fn write_index(workspace: &str, index: &SpriteIndex) -> Result<(), String> {
    let dir = sprites_dir(workspace);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create _sprites dir: {}", e))?;
    }
    let json =
        serde_json::to_string_pretty(index).map_err(|e| format!("Failed to serialize index: {}", e))?;
    fs::write(index_path(workspace), json).map_err(|e| format!("Failed to write index: {}", e))
}

#[tauri::command]
pub fn list_sprite_collections(workspace: String) -> Result<Vec<SpriteCollectionSummary>, String> {
    let index = read_index(&workspace);
    Ok(index.collections)
}

#[tauri::command]
pub fn read_sprite_collection(workspace: String, id: String) -> Result<SpriteCollection, String> {
    let path = collection_path(&workspace, &id);
    if !path.exists() {
        return Err(format!("Sprite collection '{}' not found", id));
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read collection: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse collection: {}", e))
}

#[tauri::command]
pub fn save_sprite_collection(workspace: String, collection: SpriteCollection) -> Result<(), String> {
    let dir = sprites_dir(&workspace);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create _sprites dir: {}", e))?;
    }

    // Write collection file
    let json = serde_json::to_string_pretty(&collection)
        .map_err(|e| format!("Failed to serialize collection: {}", e))?;
    fs::write(collection_path(&workspace, &collection.id), json)
        .map_err(|e| format!("Failed to write collection: {}", e))?;

    // Update index
    let mut index = read_index(&workspace);
    let summary = SpriteCollectionSummary {
        id: collection.id.clone(),
        name: collection.name.clone(),
        frame_count: collection.frames.len(),
        frame_width: collection.frames.first().map(|f| f.width).unwrap_or(0),
        frame_height: collection.frames.first().map(|f| f.height).unwrap_or(0),
        updated_at: collection.updated_at.clone(),
    };

    if let Some(existing) = index.collections.iter_mut().find(|c| c.id == collection.id) {
        *existing = summary;
    } else {
        index.collections.push(summary);
    }

    write_index(&workspace, &index)
}

#[tauri::command]
pub fn delete_sprite_collection(workspace: String, id: String) -> Result<(), String> {
    let path = collection_path(&workspace, &id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete collection: {}", e))?;
    }

    let mut index = read_index(&workspace);
    index.collections.retain(|c| c.id != id);
    write_index(&workspace, &index)
}
