use crate::commands::game::app_root;
use crate::models::module::{ModuleDefinition, ModuleSummary};
use crate::pipeline::modules;
use std::collections::HashSet;
use std::path::PathBuf;

/// List all available modules (optionally filtered by type)
#[tauri::command]
pub fn list_modules(module_type: Option<String>) -> Result<Vec<ModuleSummary>, String> {
    let root = app_root();
    let all = modules::load_all_modules(&root)?;

    let filtered: Vec<ModuleSummary> = match module_type {
        Some(ref t) => all
            .iter()
            .filter(|m| m.r#type == *t)
            .map(|m| m.to_summary())
            .collect(),
        None => all.iter().map(|m| m.to_summary()).collect(),
    };

    Ok(filtered)
}

/// Get full details for a specific module by ID
#[tauri::command]
pub fn get_module(module_id: String) -> Result<ModuleDefinition, String> {
    let root = app_root();
    let all = modules::load_all_modules(&root)?;

    all.into_iter()
        .find(|m| m.id == module_id)
        .ok_or_else(|| format!("Module '{}' not found", module_id))
}

/// List available modules for a specific game (filters out already installed modules)
#[tauri::command]
pub fn list_available_modules(game_path: String) -> Result<Vec<ModuleSummary>, String> {
    let root = app_root();
    let all = modules::load_all_modules(&root)?;
    let game_dir = PathBuf::from(&game_path);

    // Get existing modules from Modules/ directory
    let modules_dir = game_dir.join("Modules");
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
pub fn validate_module_selection(module_ids: Vec<String>) -> Result<Vec<String>, String> {
    let root = app_root();
    let all = modules::load_all_modules(&root)?;
    modules::resolve_dependencies(&module_ids, &all)
}
