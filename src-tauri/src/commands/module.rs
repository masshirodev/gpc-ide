use crate::commands::game::app_root;
use crate::models::module::{ModuleDefinition, ModuleSummary};
use crate::pipeline::modules;
use std::collections::HashSet;
use std::path::PathBuf;

fn workspace_dirs(workspace_paths: &Option<Vec<String>>) -> Vec<PathBuf> {
    workspace_paths
        .as_ref()
        .map(|paths| paths.iter().filter(|p| !p.is_empty()).map(PathBuf::from).collect())
        .unwrap_or_default()
}

/// List all available modules (optionally filtered by type)
#[tauri::command]
pub fn list_modules(
    module_type: Option<String>,
    workspace_paths: Option<Vec<String>>,
) -> Result<Vec<ModuleSummary>, String> {
    let root = app_root();
    let extra = workspace_dirs(&workspace_paths);
    let all = modules::load_all_modules_with_paths(&root, &extra)?;

    let filtered: Vec<ModuleSummary> = match module_type {
        Some(ref t) => all
            .iter()
            .filter(|m| m.r#type == *t || m.r#type == "all")
            .map(|m| m.to_summary())
            .collect(),
        None => all.iter().map(|m| m.to_summary()).collect(),
    };

    Ok(filtered)
}

/// Get full details for a specific module by ID
#[tauri::command]
pub fn get_module(
    module_id: String,
    workspace_paths: Option<Vec<String>>,
) -> Result<ModuleDefinition, String> {
    let root = app_root();
    let extra = workspace_dirs(&workspace_paths);
    let all = modules::load_all_modules_with_paths(&root, &extra)?;

    all.into_iter()
        .find(|m| m.id == module_id)
        .ok_or_else(|| format!("Module '{}' not found", module_id))
}

/// List available modules for a specific game (filters out already installed modules)
#[tauri::command]
pub fn list_available_modules(
    game_path: String,
    workspace_paths: Option<Vec<String>>,
) -> Result<Vec<ModuleSummary>, String> {
    let root = app_root();
    let extra = workspace_dirs(&workspace_paths);
    let all = modules::load_all_modules_with_paths(&root, &extra)?;
    let game_dir = PathBuf::from(&game_path);

    // Get existing modules from modules/ directory
    let modules_dir = game_dir.join("modules");
    let existing_modules: HashSet<String> = if modules_dir.exists() {
        std::fs::read_dir(&modules_dir)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter_map(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        if name.ends_with(".gpc") && name != "core.gpc" {
                            Some(name.trim_end_matches(".gpc").to_string())
                        } else {
                            None
                        }
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        HashSet::new()
    };

    // Filter out already installed modules and conflicting ones
    let available: Vec<ModuleSummary> = all
        .iter()
        .filter(|m| {
            // Skip if already installed
            if existing_modules.contains(&m.id) {
                return false;
            }
            // Skip if conflicts with existing module
            if m.conflicts.iter().any(|c| existing_modules.contains(c)) {
                return false;
            }
            // Skip if an existing module conflicts with this one
            for existing_id in &existing_modules {
                if let Some(existing_mod) = all.iter().find(|mod_def| mod_def.id == *existing_id) {
                    if existing_mod.conflicts.contains(&m.id) {
                        return false;
                    }
                }
            }
            true
        })
        .map(|m| m.to_summary())
        .collect();

    Ok(available)
}

/// Validate a module selection: check conflicts and resolve dependencies.
/// Returns the resolved module list in dependency order.
#[tauri::command]
pub fn validate_module_selection(
    module_ids: Vec<String>,
    workspace_paths: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    let root = app_root();
    let extra = workspace_dirs(&workspace_paths);
    let all = modules::load_all_modules_with_paths(&root, &extra)?;
    modules::resolve_dependencies(&module_ids, &all)
}

/// Save a user module TOML file to the first workspace's modules/ directory
#[tauri::command]
pub fn save_user_module(
    workspace_path: String,
    module_toml: String,
) -> Result<String, String> {
    let workspace = PathBuf::from(&workspace_path);
    let modules_dir = workspace.join("modules");

    // Create modules directory if it doesn't exist
    if !modules_dir.exists() {
        std::fs::create_dir_all(&modules_dir)
            .map_err(|e| format!("Failed to create modules directory: {}", e))?;
    }

    // Parse the TOML to extract the module ID for the filename
    let table: std::collections::HashMap<String, toml::Value> =
        toml::from_str(&module_toml).map_err(|e| format!("Invalid TOML: {}", e))?;

    let (key, _) = table
        .into_iter()
        .next()
        .ok_or_else(|| "Empty module TOML".to_string())?;

    let file_path = modules_dir.join(format!("{}.toml", key));

    std::fs::write(&file_path, &module_toml)
        .map_err(|e| format!("Failed to write module file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Delete a user module TOML file
#[tauri::command]
pub fn delete_user_module(
    module_id: String,
    workspace_paths: Option<Vec<String>>,
) -> Result<(), String> {
    let extra = workspace_dirs(&workspace_paths);

    for workspace in &extra {
        let module_path = workspace.join("modules").join(format!("{}.toml", module_id));
        if module_path.exists() {
            std::fs::remove_file(&module_path)
                .map_err(|e| format!("Failed to delete module: {}", e))?;
            return Ok(());
        }
    }

    Err(format!("User module '{}' not found in any workspace", module_id))
}
