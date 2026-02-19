use crate::models::config::GameConfig;
use crate::pipeline::generate::Generator;
use crate::pipeline::modules;
use crate::commands::game::app_root;
use std::path::PathBuf;
use std::collections::HashMap;

/// Save a game configuration back to config.toml, preserving comments and formatting
#[tauri::command]
pub fn save_game_config(game_path: String, config: GameConfig) -> Result<(), String> {
    let config_path = PathBuf::from(&game_path).join("config.toml");

    // Serialize the config to TOML
    let content = toml::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(&config_path, &content)
        .map_err(|e| format!("Failed to write config.toml: {}", e))?;

    Ok(())
}

/// Read a file's contents (for the code editor)
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write a file's contents (for the code editor)
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Read the file tree for a game directory
#[tauri::command]
pub fn read_file_tree(path: String) -> Result<Vec<FileTreeEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut entries = Vec::new();
    collect_tree_entries(&root, &root, &mut entries)?;
    entries.sort_by(|a, b| {
        // Directories first, then files, alphabetically
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    Ok(entries)
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileTreeEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileTreeEntry>>,
}

fn collect_tree_entries(
    dir: &PathBuf,
    root: &PathBuf,
    entries: &mut Vec<FileTreeEntry>,
) -> Result<(), String> {
    let read_dir =
        std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and build artifacts
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let mut children = Vec::new();
            collect_tree_entries(&path, root, &mut children)?;
            children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });
            entries.push(FileTreeEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
            });
        } else {
            entries.push(FileTreeEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }
    Ok(())
}

/// Create a new standalone .gpc file in the game directory
#[tauri::command]
pub fn create_standalone_file(game_path: String, filename: String) -> Result<String, String> {
    // Ensure filename ends with .gpc
    let filename = if filename.ends_with(".gpc") {
        filename
    } else {
        format!("{}.gpc", filename)
    };

    // Validate filename (no slashes, no special chars)
    if filename.contains('/') || filename.contains('\\') {
        return Err("Filename cannot contain slashes".to_string());
    }

    let file_path = PathBuf::from(&game_path).join(&filename);

    if file_path.exists() {
        return Err(format!("File already exists: {}", filename));
    }

    // Create empty file with a header comment
    let content = format!(
        "// {}\n// Created by Cronus IDE\n\n// Add your code here\n",
        filename
    );
    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Delete a file (only allows deletion of user-created files, not module files)
#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("File not found".to_string());
    }

    // Safety check: Prevent deleting config.toml (needed for generation)
    let forbidden = vec![
        "config.toml",
    ];

    if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
        if forbidden.contains(&filename) {
            return Err(format!("Cannot delete protected file: {}", filename));
        }

        // Prevent deleting files in modules/ directory (these are from modules)
        if file_path.contains("/modules/") || file_path.contains("\\modules\\") {
            return Err("Cannot delete module files. Remove the module instead.".to_string());
        }
    }

    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

/// Regenerate a specific generated file (for files that can be safely regenerated)
#[tauri::command]
pub fn regenerate_file(game_path: String, file_path: String) -> Result<String, String> {
    let game_dir = PathBuf::from(&game_path);
    let full_path = PathBuf::from(&file_path);

    // Get the relative path from game directory
    let rel_path = full_path
        .strip_prefix(&game_dir)
        .map_err(|_| "File is not in game directory".to_string())?
        .to_string_lossy()
        .to_string();

    // List of files that can be regenerated
    let regenerable = vec![
        "modules/core.gpc",
        "main.gpc",
        "define.gpc",
        "menu.gpc",
        "setting.gpc",
        "persistence.gpc",
    ];

    // Check if this file can be regenerated
    let can_regenerate = regenerable.iter().any(|&pattern| {
        rel_path == pattern || rel_path.starts_with("modules/") && rel_path.ends_with(".gpc")
    });

    if !can_regenerate {
        return Err(format!("File '{}' cannot be auto-regenerated. Only generated module files and core files can be regenerated.", rel_path));
    }

    // Load config and modules
    let config_path = game_dir.join("config.toml");
    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.toml: {}", e))?;
    let game_config: GameConfig = toml::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.toml: {}", e))?;

    // Load all modules
    let root = app_root();
    let all_modules = modules::load_all_modules(&root)?;
    let modules_metadata: HashMap<String, crate::models::module::ModuleDefinition> = all_modules
        .iter()
        .map(|m| (m.id.clone(), m.clone()))
        .collect();

    // Calculate game depth
    let game_depth = game_dir
        .strip_prefix(game_dir.parent().unwrap())
        .ok()
        .and_then(|p| p.components().count().checked_sub(1))
        .unwrap_or(1);

    // Generate all files
    let mut generator = Generator::new(game_config, modules_metadata, game_depth);
    let result = generator.generate_all();

    // Find the specific file to regenerate
    let file_content = result
        .files
        .iter()
        .find(|(path, _)| path == &rel_path)
        .map(|(_, content)| content.clone())
        .ok_or_else(|| format!("File '{}' not found in generated files", rel_path))?;

    // Write the regenerated file
    std::fs::write(&full_path, &file_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_content)
}

/// Preview regeneration — returns diffs without writing files
#[tauri::command]
pub fn regenerate_preview(game_path: String) -> Result<Vec<FileDiff>, String> {
    let game_dir = PathBuf::from(&game_path);

    let config_path = game_dir.join("config.toml");
    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.toml: {}", e))?;
    let game_config: GameConfig = toml::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.toml: {}", e))?;

    let root = app_root();
    let all_modules = modules::load_all_modules(&root)?;
    let modules_metadata: HashMap<String, crate::models::module::ModuleDefinition> = all_modules
        .iter()
        .map(|m| (m.id.clone(), m.clone()))
        .collect();

    let game_depth = game_dir
        .strip_prefix(game_dir.parent().unwrap())
        .ok()
        .and_then(|p| p.components().count().checked_sub(1))
        .unwrap_or(1);

    let mut generator = Generator::new(game_config, modules_metadata, game_depth);
    let result = generator.generate_all();

    let mut diffs = Vec::new();
    for (rel_path, new_content) in &result.files {
        let full_path = game_dir.join(rel_path);
        let old_content = std::fs::read_to_string(&full_path).unwrap_or_default();

        if old_content != *new_content {
            diffs.push(FileDiff {
                path: rel_path.clone(),
                old_content,
                new_content: new_content.clone(),
            });
        }
    }

    Ok(diffs)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileDiff {
    pub path: String,
    pub old_content: String,
    pub new_content: String,
}

/// Commit regenerated files — writes specific files with provided content
#[tauri::command]
pub fn regenerate_commit(game_path: String, files: Vec<FileWrite>) -> Result<Vec<String>, String> {
    let game_dir = PathBuf::from(&game_path);
    let mut written = Vec::new();

    for file in &files {
        let full_path = game_dir.join(&file.path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        std::fs::write(&full_path, &file.content)
            .map_err(|e| format!("Failed to write {}: {}", file.path, e))?;
        written.push(file.path.clone());
    }

    Ok(written)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileWrite {
    pub path: String,
    pub content: String,
}

/// Regenerate all generated files from config.toml
#[tauri::command]
pub fn regenerate_all(game_path: String) -> Result<Vec<String>, String> {
    let game_dir = PathBuf::from(&game_path);

    // Load config and modules
    let config_path = game_dir.join("config.toml");
    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.toml: {}", e))?;
    let game_config: GameConfig = toml::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.toml: {}", e))?;

    let root = app_root();
    let all_modules = modules::load_all_modules(&root)?;
    let modules_metadata: HashMap<String, crate::models::module::ModuleDefinition> = all_modules
        .iter()
        .map(|m| (m.id.clone(), m.clone()))
        .collect();

    let game_depth = game_dir
        .strip_prefix(game_dir.parent().unwrap())
        .ok()
        .and_then(|p| p.components().count().checked_sub(1))
        .unwrap_or(1);

    // Generate all files
    let mut generator = Generator::new(game_config, modules_metadata, game_depth);
    let result = generator.generate_all();

    // Write all generated files
    let mut written = Vec::new();
    for (rel_path, content) in &result.files {
        let full_path = game_dir.join(rel_path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        std::fs::write(&full_path, content)
            .map_err(|e| format!("Failed to write {}: {}", rel_path, e))?;
        written.push(rel_path.clone());
    }

    Ok(written)
}
