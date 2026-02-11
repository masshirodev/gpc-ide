use std::path::PathBuf;

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
