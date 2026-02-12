use crate::models::module::ModuleDefinition;
use std::collections::HashMap;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Load all module definitions from bundled modules/ and optional extra directories
pub fn load_all_modules(project_root: &Path) -> Result<Vec<ModuleDefinition>, String> {
    load_all_modules_with_paths(project_root, &[])
}

/// Load all module definitions from bundled modules/ plus extra search paths (workspace modules/)
pub fn load_all_modules_with_paths(
    project_root: &Path,
    extra_dirs: &[PathBuf],
) -> Result<Vec<ModuleDefinition>, String> {
    let modules_dir = project_root.join("modules");
    if !modules_dir.exists() {
        return Err(format!(
            "Modules directory not found: {}",
            modules_dir.display()
        ));
    }

    let mut modules = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    // Load bundled modules first
    load_modules_from_dir(&modules_dir, &mut modules, &mut seen_ids, false)?;

    // Load user modules from extra directories
    for extra_dir in extra_dirs {
        let user_modules_dir = extra_dir.join("modules");
        if user_modules_dir.exists() {
            load_modules_from_dir(&user_modules_dir, &mut modules, &mut seen_ids, true)?;
        }
    }

    // Sort by menu_priority (lower first), then by display_name
    modules.sort_by(|a, b| {
        let pa = a.menu_priority.unwrap_or(100);
        let pb = b.menu_priority.unwrap_or(100);
        pa.cmp(&pb).then(a.display_name.cmp(&b.display_name))
    });

    Ok(modules)
}

fn load_modules_from_dir(
    dir: &Path,
    modules: &mut Vec<ModuleDefinition>,
    seen_ids: &mut HashSet<String>,
    is_user: bool,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read modules dir {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("toml") {
            match load_module(&path) {
                Ok(mut module) => {
                    if seen_ids.contains(&module.id) {
                        if is_user {
                            log::warn!(
                                "User module '{}' conflicts with bundled module, skipping",
                                module.id
                            );
                            continue;
                        }
                    }
                    module.is_user_module = is_user;
                    seen_ids.insert(module.id.clone());
                    modules.push(module);
                }
                Err(e) => {
                    log::warn!("Failed to load module {}: {}", path.display(), e);
                }
            }
        }
    }

    Ok(())
}

/// Load a single module definition from a TOML file.
/// Each file has a dynamic top-level key (the module name) wrapping the definition.
fn load_module(path: &Path) -> Result<ModuleDefinition, String> {
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Parse as a generic TOML table first since the top-level key is dynamic
    let table: HashMap<String, toml::Value> =
        toml::from_str(&content).map_err(|e| format!("TOML parse error: {}", e))?;

    // Extract the first (and only) top-level key
    let (_key, value) = table
        .into_iter()
        .next()
        .ok_or_else(|| "Empty TOML file".to_string())?;

    // Deserialize the inner value into ModuleDefinition
    let module: ModuleDefinition =
        value.try_into().map_err(|e| format!("Module parse error: {}", e))?;

    Ok(module)
}

/// Load modules filtered by type (fps, fgs, etc.)
pub fn load_modules_by_type(
    project_root: &Path,
    module_type: &str,
) -> Result<Vec<ModuleDefinition>, String> {
    let all = load_all_modules(project_root)?;
    Ok(all
        .into_iter()
        .filter(|m| m.r#type == module_type)
        .collect())
}

/// Resolve module dependencies: given a list of selected module IDs,
/// return them in dependency order and include any auto-required modules.
pub fn resolve_dependencies(
    selected: &[String],
    all_modules: &[ModuleDefinition],
) -> Result<Vec<String>, String> {
    let module_map: HashMap<&str, &ModuleDefinition> =
        all_modules.iter().map(|m| (m.id.as_str(), m)).collect();

    let mut resolved = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // First pass: add weapondata if any selected module needs it
    for id in selected {
        if let Some(module) = module_map.get(id.as_str()) {
            if module.needs_weapondata.unwrap_or(false) && !selected.contains(&"weapondata".into())
            {
                if !seen.contains("weapondata") {
                    seen.insert("weapondata".to_string());
                    resolved.push("weapondata".to_string());
                }
            }
        }
    }

    // Second pass: add all selected modules preserving order, skipping already added
    for id in selected {
        if !seen.contains(id.as_str()) {
            seen.insert(id.clone());
            resolved.push(id.clone());
        }
    }

    // Validate no conflicts
    for i in 0..resolved.len() {
        let id = &resolved[i];
        if let Some(module) = module_map.get(id.as_str()) {
            for conflict in &module.conflicts {
                if resolved.contains(conflict) {
                    return Err(format!(
                        "Module '{}' conflicts with '{}'",
                        module.display_name,
                        module_map
                            .get(conflict.as_str())
                            .map(|m| m.display_name.as_str())
                            .unwrap_or(conflict.as_str())
                    ));
                }
            }
        }
    }

    Ok(resolved)
}

/// Get the path to the modules directory
pub fn modules_dir(project_root: &Path) -> PathBuf {
    project_root.join("modules")
}
