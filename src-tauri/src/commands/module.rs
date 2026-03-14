use crate::commands::game::app_root;
use crate::models::module::{ModuleDefinition, ModuleSummary};
use crate::pipeline::modules;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;

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

/// Serialize a ModuleDefinition to TOML with the module ID as the top-level key
fn module_to_toml(module_def: &ModuleDefinition) -> Result<String, String> {
    let mut wrapper: HashMap<String, &ModuleDefinition> = HashMap::new();
    wrapper.insert(module_def.id.clone(), module_def);
    toml::to_string_pretty(&wrapper).map_err(|e| format!("Failed to serialize module: {}", e))
}

/// Save a user module to the first workspace's modules/ directory
#[tauri::command]
pub fn save_user_module(
    workspace_path: String,
    module_def: ModuleDefinition,
) -> Result<String, String> {
    let workspace = PathBuf::from(&workspace_path);
    let modules_dir = workspace.join("modules");

    if !modules_dir.exists() {
        std::fs::create_dir_all(&modules_dir)
            .map_err(|e| format!("Failed to create modules directory: {}", e))?;
    }

    let toml_str = module_to_toml(&module_def)?;
    let file_path = modules_dir.join(format!("{}.toml", module_def.id));

    std::fs::write(&file_path, &toml_str)
        .map_err(|e| format!("Failed to write module file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Export a module as a .toml file via native save dialog
#[tauri::command]
pub async fn export_module_toml(
    app: tauri::AppHandle,
    module_id: String,
    workspace_paths: Option<Vec<String>>,
) -> Result<Option<String>, String> {
    let root = app_root();
    let extra = workspace_dirs(&workspace_paths);
    let all = modules::load_all_modules_with_paths(&root, &extra)?;

    let module_def = all
        .into_iter()
        .find(|m| m.id == module_id)
        .ok_or_else(|| format!("Module '{}' not found", module_id))?;

    let toml_str = module_to_toml(&module_def)?;

    let path = app
        .dialog()
        .file()
        .set_title("Export Module")
        .set_file_name(format!("{}.toml", module_id))
        .add_filter("TOML files", &["toml"])
        .blocking_save_file();

    match path {
        Some(file_path) => {
            let p = file_path.as_path().ok_or("Invalid file path")?;
            std::fs::write(p, &toml_str)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(Some(p.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

/// Import a .toml module file via native open dialog
#[tauri::command]
pub async fn import_module_toml(
    app: tauri::AppHandle,
    workspace_path: String,
) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .set_title("Import Module")
        .add_filter("TOML files", &["toml"])
        .blocking_pick_file();

    match path {
        Some(file_path) => {
            let p = file_path.as_path().ok_or("Invalid file path")?;
            let content = std::fs::read_to_string(p)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            // Validate: parse as module TOML (top-level key wrapping a ModuleDefinition)
            let table: HashMap<String, toml::Value> =
                toml::from_str(&content).map_err(|e| format!("Invalid TOML: {}", e))?;

            let (key, value) = table
                .into_iter()
                .next()
                .ok_or_else(|| "Empty TOML file".to_string())?;

            let _module: ModuleDefinition = value
                .try_into()
                .map_err(|e| format!("Invalid module format: {}", e))?;

            // Copy to workspace modules/ directory
            let modules_dir = PathBuf::from(&workspace_path).join("modules");
            if !modules_dir.exists() {
                std::fs::create_dir_all(&modules_dir)
                    .map_err(|e| format!("Failed to create modules directory: {}", e))?;
            }

            let dest = modules_dir.join(format!("{}.toml", key));
            std::fs::write(&dest, &content)
                .map_err(|e| format!("Failed to write module file: {}", e))?;

            Ok(Some(key))
        }
        None => Ok(None),
    }
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
