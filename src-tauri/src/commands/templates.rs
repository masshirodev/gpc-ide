use std::path::{Path, PathBuf};

#[derive(Debug, Clone, serde::Serialize)]
pub struct TemplateFile {
    pub name: String,
    pub path: String,
    pub category: String,
    pub description: String,
    pub size: u64,
}

/// List all available template files from Common/ and Drawing/
#[tauri::command]
pub fn list_templates() -> Result<Vec<TemplateFile>, String> {
    let root = crate::commands::game::app_root();
    let mut templates = Vec::new();

    // Common templates
    let common_dir = root.join("common");
    if common_dir.exists() {
        templates.extend(scan_template_dir(&common_dir, "Common")?);
    }

    // Drawing templates
    let drawing_dir = root.join("drawings");
    if drawing_dir.exists() {
        templates.extend(scan_template_dir(&drawing_dir, "Drawing")?);
    }

    templates.sort_by(|a, b| {
        a.category
            .cmp(&b.category)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(templates)
}

fn scan_template_dir(dir: &PathBuf, category: &str) -> Result<Vec<TemplateFile>, String> {
    let mut templates = Vec::new();

    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read {} directory: {}", category, e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("gpc") {
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let metadata = std::fs::metadata(&path)
                .map_err(|e| format!("Failed to read metadata: {}", e))?;

            let description = get_template_description(&name);

            templates.push(TemplateFile {
                name,
                path: path.to_string_lossy().to_string(),
                category: category.to_string(),
                description,
                size: metadata.len(),
            });
        }
    }

    Ok(templates)
}

fn get_template_description(filename: &str) -> String {
    match filename {
        // Common
        "bitpack.gpc" => "Dynamic bit-packing for SPVAR persistence (used by most modules)".to_string(),
        "helper.gpc" => "Common helper functions (Clear, PrintNumber, PackValue, etc.)".to_string(),
        "fgc.gpc" => "Fighting game common utilities (frame-perfect inputs, motion detection)".to_string(),
        "control.gpc" => "Controller input helpers and abstractions".to_string(),
        "oled.gpc" => "OLED display utility functions".to_string(),
        "scroll.gpc" => "Scrollbar visualization for menus".to_string(),
        "text.gpc" => "Common text strings (On/Off, status indicators)".to_string(),

        // Drawing
        "scroll_current.gpc" => "Current page indicator drawing (positions 0-5)".to_string(),
        "scroll_outer.gpc" => "Outer scroll bar border drawing".to_string(),
        "selector.gpc" => "X-style menu selector drawing".to_string(),
        "toggle.gpc" => "Toggle display helper (On/Off indicators)".to_string(),

        _ => "Template file".to_string(),
    }
}

/// Read a template file's contents
#[tauri::command]
pub fn read_template(template_path: String) -> Result<String, String> {
    std::fs::read_to_string(&template_path)
        .map_err(|e| format!("Failed to read template: {}", e))
}

/// Import a template file into a game directory
#[tauri::command]
pub fn import_template(
    game_path: String,
    template_path: String,
    target_filename: Option<String>,
) -> Result<String, String> {
    let game_dir = PathBuf::from(&game_path);
    let template_file = PathBuf::from(&template_path);

    if !game_dir.exists() {
        return Err("Game directory not found".to_string());
    }

    if !template_file.exists() {
        return Err("Template file not found".to_string());
    }

    // Determine target filename
    let filename = target_filename.unwrap_or_else(|| {
        template_file
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("template.gpc")
            .to_string()
    });

    let target_path = game_dir.join(&filename);

    // Check if file already exists
    if target_path.exists() {
        return Err(format!("File '{}' already exists in game directory", filename));
    }

    // Read template content
    let content = std::fs::read_to_string(&template_file)
        .map_err(|e| format!("Failed to read template: {}", e))?;

    // Write to game directory
    std::fs::write(&target_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

// === User Project Templates ===

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProjectTemplateMeta {
    pub name: String,
    pub description: String,
    pub game_type: String,
    pub console_type: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProjectTemplateInfo {
    pub id: String,
    pub path: String,
    pub meta: ProjectTemplateMeta,
    pub file_count: usize,
}

fn templates_dir(workspace: &Path) -> PathBuf {
    workspace.join("_templates")
}

/// Save a game as a project template
#[tauri::command]
pub fn save_project_template(
    game_path: String,
    workspace_path: String,
    name: String,
    description: String,
) -> Result<ProjectTemplateInfo, String> {
    let game_dir = Path::new(&game_path);
    let ws_dir = Path::new(&workspace_path);

    if !game_dir.is_dir() {
        return Err(format!("Game directory not found: {}", game_path));
    }

    // Create template ID from name (slugified)
    let id: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if id.is_empty() {
        return Err("Invalid template name".to_string());
    }

    let tpl_dir = templates_dir(ws_dir).join(&id);
    if tpl_dir.exists() {
        return Err(format!("Template '{}' already exists", name));
    }

    std::fs::create_dir_all(&tpl_dir)
        .map_err(|e| format!("Failed to create template directory: {}", e))?;

    // Copy game files (skip hidden dirs, build output, etc.)
    let mut file_count = 0usize;
    copy_dir_for_template(game_dir, &tpl_dir, &mut file_count)?;

    // Read game meta to get type info (try game.json first, then .gpc-meta.json, then config.toml)
    let game_json_path = game_dir.join("game.json");
    let legacy_meta_path = game_dir.join(".gpc-meta.json");
    let (game_type, console_type) = if game_json_path.exists() {
        let meta_str = std::fs::read_to_string(&game_json_path).unwrap_or_default();
        let meta: serde_json::Value = serde_json::from_str(&meta_str).unwrap_or_default();
        (
            meta.get("game_type").and_then(|v| v.as_str()).unwrap_or("custom").to_string(),
            meta.get("console_type").and_then(|v| v.as_str()).unwrap_or("ps5").to_string(),
        )
    } else if legacy_meta_path.exists() {
        let meta_str = std::fs::read_to_string(&legacy_meta_path).unwrap_or_default();
        let meta: serde_json::Value = serde_json::from_str(&meta_str).unwrap_or_default();
        (
            meta.get("game_type").and_then(|v| v.as_str()).unwrap_or("custom").to_string(),
            meta.get("console_type").and_then(|v| v.as_str()).unwrap_or("ps5").to_string(),
        )
    } else {
        // Try config.toml
        let config_path = game_dir.join("config.toml");
        if config_path.exists() {
            let config_str = std::fs::read_to_string(&config_path).unwrap_or_default();
            let config: toml::Value = config_str.parse().unwrap_or(toml::Value::Table(Default::default()));
            (
                config.get("game_type").and_then(|v| v.as_str()).unwrap_or("custom").to_string(),
                config.get("console_type").and_then(|v| v.as_str()).unwrap_or("ps5").to_string(),
            )
        } else {
            ("custom".to_string(), "ps5".to_string())
        }
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let meta = ProjectTemplateMeta {
        name: name.clone(),
        description,
        game_type,
        console_type,
        created_at: now,
    };

    // Write template metadata
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    std::fs::write(tpl_dir.join("_template.json"), &meta_json)
        .map_err(|e| format!("Failed to write template metadata: {}", e))?;

    Ok(ProjectTemplateInfo {
        id,
        path: tpl_dir.to_string_lossy().to_string(),
        meta,
        file_count,
    })
}

fn copy_dir_for_template(src: &Path, dst: &Path, count: &mut usize) -> Result<(), String> {
    for entry in std::fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Skip hidden files/dirs, build output, template metadata
        if name.starts_with('.') || name == "build" || name == "_templates" {
            continue;
        }

        let target = dst.join(name);
        if path.is_dir() {
            std::fs::create_dir_all(&target)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
            copy_dir_for_template(&path, &target, count)?;
        } else {
            std::fs::copy(&path, &target)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            *count += 1;
        }
    }
    Ok(())
}

/// List all user project templates across workspaces
#[tauri::command]
pub fn list_project_templates(workspace_paths: Vec<String>) -> Result<Vec<ProjectTemplateInfo>, String> {
    let mut results = Vec::new();

    for ws in workspace_paths {
        let tpl_root = templates_dir(Path::new(&ws));
        if !tpl_root.exists() {
            continue;
        }

        let entries = std::fs::read_dir(&tpl_root)
            .map_err(|e| format!("Failed to read templates dir: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let meta_file = path.join("_template.json");
            if !meta_file.exists() {
                continue;
            }

            let meta_str = std::fs::read_to_string(&meta_file)
                .map_err(|e| format!("Failed to read template meta: {}", e))?;
            let meta: ProjectTemplateMeta = serde_json::from_str(&meta_str)
                .map_err(|e| format!("Failed to parse template meta: {}", e))?;

            let file_count = count_files(&path);

            let id = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();

            results.push(ProjectTemplateInfo {
                id,
                path: path.to_string_lossy().to_string(),
                meta,
                file_count,
            });
        }
    }

    results.sort_by(|a, b| b.meta.created_at.cmp(&a.meta.created_at));
    Ok(results)
}

fn count_files(dir: &Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('_') {
                continue;
            }
            if path.is_dir() {
                count += count_files(&path);
            } else {
                count += 1;
            }
        }
    }
    count
}

/// Create a new game from a project template
#[tauri::command]
pub fn create_game_from_template(
    template_path: String,
    game_name: String,
    workspace_path: String,
) -> Result<String, String> {
    let tpl_dir = Path::new(&template_path);
    let ws_dir = Path::new(&workspace_path);

    if !tpl_dir.is_dir() {
        return Err("Template not found".to_string());
    }

    let game_dir = ws_dir.join(&game_name);
    if game_dir.exists() {
        return Err(format!("Game '{}' already exists in workspace", game_name));
    }

    std::fs::create_dir_all(&game_dir)
        .map_err(|e| format!("Failed to create game directory: {}", e))?;

    // Copy template files (skip _template.json metadata)
    let mut count = 0usize;
    copy_template_to_game(tpl_dir, &game_dir, &mut count)?;

    // Update game name in config.toml if present
    let config_path = game_dir.join("config.toml");
    if config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            // Simple replacement of the name field
            let updated = update_toml_name(&content, &game_name);
            let _ = std::fs::write(&config_path, updated);
        }
    }

    // Update game.json if present (flow-based games)
    let game_json_path = game_dir.join("game.json");
    if game_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&game_json_path) {
            if let Ok(mut meta) = serde_json::from_str::<serde_json::Value>(&content) {
                meta["name"] = serde_json::Value::String(game_name.clone());
                if let Ok(updated) = serde_json::to_string_pretty(&meta) {
                    let _ = std::fs::write(&game_json_path, updated);
                }
            }
        }
    }

    // Update .gpc-meta.json if present
    let meta_path = game_dir.join(".gpc-meta.json");
    if meta_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&meta_path) {
            if let Ok(mut meta) = serde_json::from_str::<serde_json::Value>(&content) {
                meta["name"] = serde_json::Value::String(game_name.clone());
                meta["display_name"] = serde_json::Value::String(game_name.clone());
                if let Ok(updated) = serde_json::to_string_pretty(&meta) {
                    let _ = std::fs::write(&meta_path, updated);
                }
            }
        }
    }

    Ok(game_dir.to_string_lossy().to_string())
}

fn copy_template_to_game(src: &Path, dst: &Path, count: &mut usize) -> Result<(), String> {
    for entry in std::fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Skip template metadata
        if name == "_template.json" {
            continue;
        }

        let target = dst.join(name);
        if path.is_dir() {
            std::fs::create_dir_all(&target)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
            copy_template_to_game(&path, &target, count)?;
        } else {
            std::fs::copy(&path, &target)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            *count += 1;
        }
    }
    Ok(())
}

fn update_toml_name(content: &str, new_name: &str) -> String {
    let mut result = String::new();
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("name") && trimmed.contains('=') {
            result.push_str(&format!("name = \"{}\"", new_name));
        } else if trimmed.starts_with("display_name") && trimmed.contains('=') {
            result.push_str(&format!("display_name = \"{}\"", new_name));
        } else {
            result.push_str(line);
        }
        result.push('\n');
    }
    result
}

/// Delete a project template
#[tauri::command]
pub fn delete_project_template(template_path: String) -> Result<(), String> {
    let tpl_dir = Path::new(&template_path);
    if !tpl_dir.is_dir() {
        return Err("Template not found".to_string());
    }

    // Verify it's actually a template (has _template.json)
    if !tpl_dir.join("_template.json").exists() {
        return Err("Not a valid template directory".to_string());
    }

    std::fs::remove_dir_all(tpl_dir)
        .map_err(|e| format!("Failed to delete template: {}", e))?;

    Ok(())
}
