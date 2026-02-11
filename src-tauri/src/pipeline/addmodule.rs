use crate::models::module::ModuleDefinition;
use crate::models::config::GameConfig;
use crate::pipeline::generate::Generator;
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Parameters for adding a module to an existing game
#[derive(Debug, Clone, serde::Deserialize)]
pub struct AddModuleParams {
    pub module_id: String,
    pub module_params: Option<HashMap<String, String>>,
    pub quick_toggle_key: Option<String>,
    pub weapon_names: Option<Vec<String>>,
}

/// Result of adding a module
#[derive(Debug, Clone, serde::Serialize)]
pub struct AddModuleResult {
    pub success: bool,
    pub messages: Vec<String>,
    pub files_modified: Vec<String>,
}

/// Add a module to an existing game's config.toml.
///
/// This modifies the TOML content in-place using toml_edit to preserve formatting.
pub fn add_module(
    game_dir: &Path,
    module: &ModuleDefinition,
    params: &AddModuleParams,
    all_modules: &[ModuleDefinition],
) -> Result<AddModuleResult, String> {
    let config_path = game_dir.join("config.toml");
    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Could not read config.toml: {}", e))?;

    let mut doc: toml_edit::DocumentMut = config_content
        .parse()
        .map_err(|e| format!("Could not parse config.toml: {}", e))?;

    let mut messages = Vec::new();
    let mut files_modified = Vec::new();

    // Check game type compatibility
    let game_type = doc
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("fps")
        .to_string();
    check_type_compatibility(&module.r#type, &game_type)?;

    // Check for conflicts with existing modules
    check_conflicts(game_dir, &params.module_id, module, all_modules)?;

    // Check for duplicate menu entry
    if let Some(menu) = doc.get("menu").and_then(|v| v.as_array_of_tables()) {
        for item in menu.iter() {
            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                if name == module.display_name {
                    return Err(format!(
                        "Module '{}' already exists in menu",
                        module.display_name
                    ));
                }
            }
        }
    }

    // Add menu item
    if !module.options.is_empty() {
        // Standard clickable module with options
        let mut menu_item = toml_edit::Table::new();
        menu_item.insert("name", toml_edit::value(&module.display_name));
        menu_item.insert("type", toml_edit::value("clickable"));
        if let Some(ref sd) = module.state_display {
            menu_item.insert("state_display", toml_edit::value(sd.as_str()));
        }

        // Find status_var from the first toggle option
        if let Some(first_toggle) = module.options.iter().find(|o| o.r#type == "toggle") {
            menu_item.insert("status_var", toml_edit::value(&first_toggle.var));
        }

        // Add options as nested [[menu.options]] sub-tables
        let mut opts_arr = toml_edit::ArrayOfTables::new();
        for opt in &module.options {
            let mut opt_table = toml_edit::Table::new();
            opt_table.insert("name", toml_edit::value(&opt.name));
            opt_table.insert("var", toml_edit::value(&opt.var));
            opt_table.insert("type", toml_edit::value(&opt.r#type));
            if let Some(ref default) = opt.default {
                if let Some(n) = default.as_i64() {
                    opt_table.insert("default", toml_edit::value(n));
                } else if let Some(b) = default.as_bool() {
                    opt_table.insert("default", toml_edit::value(b));
                }
            }
            if let Some(min) = opt.min {
                opt_table.insert("min", toml_edit::value(min as i64));
            }
            if let Some(max) = opt.max {
                opt_table.insert("max", toml_edit::value(max as i64));
            }
            opts_arr.push(opt_table);
        }
        menu_item.insert("options", toml_edit::Item::ArrayOfTables(opts_arr));

        // Ensure menu array exists and push
        if doc.get("menu").is_none() {
            doc.insert(
                "menu",
                toml_edit::Item::ArrayOfTables(toml_edit::ArrayOfTables::new()),
            );
        }
        if let Some(menu_arr) = doc.get_mut("menu").and_then(|v| v.as_array_of_tables_mut()) {
            menu_arr.push(menu_item);
        }

        messages.push(format!("Added menu item: {}", module.display_name));
    } else if let Some(ref config_menu) = module.config_menu {
        // Custom config_menu module
        let mut menu_item = toml_edit::Table::new();
        menu_item.insert("name", toml_edit::value(&config_menu.name));
        menu_item.insert("type", toml_edit::value(&config_menu.r#type));
        menu_item.insert("module", toml_edit::value(&params.module_id));

        if let Some(ref sd) = module.state_display {
            menu_item.insert("state_display", toml_edit::value(sd.as_str()));
        }
        if let Some(ref df) = config_menu.display_function {
            menu_item.insert("display_function", toml_edit::value(df.as_str()));
        }
        if let Some(ref ef) = config_menu.edit_function {
            menu_item.insert("edit_function", toml_edit::value(ef.as_str()));
        }
        if config_menu.profile_aware.unwrap_or(false) {
            menu_item.insert("profile_aware", toml_edit::value(true));
        }

        if doc.get("menu").is_none() {
            doc.insert(
                "menu",
                toml_edit::Item::ArrayOfTables(toml_edit::ArrayOfTables::new()),
            );
        }
        if let Some(menu_arr) = doc.get_mut("menu").and_then(|v| v.as_array_of_tables_mut()) {
            menu_arr.push(menu_item);
        }

        messages.push(format!("Added menu item: {}", config_menu.name));
    } else {
        // Data module or module with no menu - skip menu addition silently
        messages.push(format!(
            "Module '{}' has no menu configuration, skipping menu addition",
            params.module_id
        ));
    }

    // Add extra_vars
    if !module.extra_vars.is_empty() {
        if doc.get("extra_vars").is_none() {
            doc.insert(
                "extra_vars",
                toml_edit::Item::Table(toml_edit::Table::new()),
            );
        }
        if let Some(table) = doc.get_mut("extra_vars").and_then(|v| v.as_table_mut()) {
            for (var_name, var_type) in &module.extra_vars {
                table.insert(var_name, toml_edit::value(var_type.as_str()));
            }
        }
        messages.push(format!("Added {} extra variables", module.extra_vars.len()));
    }

    // Add module params
    if !module.params.is_empty() {
        if doc.get("module_params").is_none() {
            doc.insert(
                "module_params",
                toml_edit::Item::Table(toml_edit::Table::new()),
            );
        }
        if let Some(table) = doc.get_mut("module_params").and_then(|v| v.as_table_mut()) {
            let mut param_table = toml_edit::Table::new();
            for param in &module.params {
                let value = params
                    .module_params
                    .as_ref()
                    .and_then(|p| p.get(&param.key))
                    .or(param.default.as_ref())
                    .cloned()
                    .unwrap_or_default();
                param_table.insert(&param.key, toml_edit::value(&value));
            }
            table.insert(&params.module_id, toml_edit::Item::Table(param_table));
        }
        messages.push(format!("Added module params for {}", params.module_id));
    }

    // Add keyboard quick toggle if provided
    if let Some(ref qt_key) = params.quick_toggle_key {
        if !qt_key.is_empty() {
            if doc.get("keyboard").is_none() {
                doc.insert(
                    "keyboard",
                    toml_edit::Item::Table(toml_edit::Table::new()),
                );
            }
            if let Some(table) = doc.get_mut("keyboard").and_then(|v| v.as_table_mut()) {
                let key_name = format!("quick_toggle_{}", params.module_id);
                table.insert(&key_name, toml_edit::value(qt_key.as_str()));
            }
            messages.push(format!(
                "Added keyboard shortcut: quick_toggle_{} = {}",
                params.module_id, qt_key
            ));
        }
    }

    // Add weapon names if provided and needed
    if let Some(ref weapon_names) = params.weapon_names {
        if !weapon_names.is_empty() && doc.get("weapons").is_none() {
            let mut arr = toml_edit::Array::new();
            for name in weapon_names {
                arr.push(name.as_str());
            }
            doc.insert("weapons", toml_edit::value(arr));
            messages.push(format!("Added {} weapon names", weapon_names.len()));
        }
    }

    // Write updated config.toml
    std::fs::write(&config_path, doc.to_string())
        .map_err(|e| format!("Failed to write config.toml: {}", e))?;
    files_modified.push("config.toml".to_string());

    // Generate module files
    let generated_files = generate_module_files(game_dir, all_modules, &params.module_id)?;
    files_modified.extend(generated_files.iter().cloned());
    messages.extend(
        generated_files
            .iter()
            .map(|f| format!("Generated: {}", f))
    );

    // Check if main.gpc needs the include
    let main_path = game_dir.join("main.gpc");
    if main_path.exists() {
        let main_content = std::fs::read_to_string(&main_path)
            .unwrap_or_default();
        let include_line = format!("#include \"Modules/{}.gpc\"", params.module_id);
        if !main_content.contains(&include_line) {
            messages.push(format!(
                "⚠ Add to main.gpc: {}",
                include_line
            ));
        }
    }

    // Handle keyboard module specially - create keyboard.gpc
    if module.requires_keyboard_file.unwrap_or(false) {
        let keyboard_path = game_dir.join("keyboard.gpc");
        if !keyboard_path.exists() {
            if let Some(ref combo) = module.combo {
                std::fs::write(&keyboard_path, combo.trim())
                    .map_err(|e| format!("Failed to write keyboard.gpc: {}", e))?;
                files_modified.push("keyboard.gpc".to_string());
                messages.push("Created keyboard.gpc".to_string());
            }
        } else {
            messages.push("keyboard.gpc already exists, skipping".to_string());
        }
    }

    Ok(AddModuleResult {
        success: true,
        messages,
        files_modified,
    })
}

fn generate_module_files(
    game_dir: &Path,
    all_modules: &[ModuleDefinition],
    new_module_id: &str,
) -> Result<Vec<String>, String> {
    let config_path = game_dir.join("config.toml");

    // Reload the updated config
    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.toml: {}", e))?;
    let game_config: GameConfig = toml::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config.toml: {}", e))?;

    // Build modules metadata map
    let modules_metadata: HashMap<String, ModuleDefinition> = all_modules
        .iter()
        .map(|m| (m.id.clone(), m.clone()))
        .collect();

    // Calculate game depth (1 for Games/Foo, 2 for Games/Cat/Foo)
    let game_depth = game_dir
        .strip_prefix(game_dir.parent().unwrap())
        .ok()
        .and_then(|p| p.components().count().checked_sub(1))
        .unwrap_or(1);

    // Generate all files
    let mut generator = Generator::new(game_config, modules_metadata, game_depth);
    let result = generator.generate_all();

    let mut files_written = Vec::new();

    // Only write the NEW module file and regenerate core.gpc
    for (rel_path, content) in result.files {
        let full_path = game_dir.join(&rel_path);

        // Write if it's the new module, or core.gpc (which needs updating)
        let should_write = rel_path == format!("Modules/{}.gpc", new_module_id)
            || rel_path == "Modules/core.gpc";

        if should_write {
            if let Some(parent) = full_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
            }
            std::fs::write(&full_path, content)
                .map_err(|e| format!("Failed to write {}: {}", rel_path, e))?;
            files_written.push(rel_path);
        }
    }

    Ok(files_written)
}

fn check_type_compatibility(module_type: &str, game_type: &str) -> Result<(), String> {
    if module_type == "all" {
        return Ok(());
    }
    let compatible_types: HashSet<&str> = match game_type {
        "fps" | "tps" => ["fps", "tps"].into_iter().collect(),
        other => [other].into_iter().collect(),
    };
    if !compatible_types.contains(module_type) {
        return Err(format!(
            "Module type '{}' is not compatible with game type '{}'",
            module_type, game_type
        ));
    }
    Ok(())
}

fn check_conflicts(
    game_dir: &Path,
    module_id: &str,
    module: &ModuleDefinition,
    all_modules: &[ModuleDefinition],
) -> Result<(), String> {
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

    // Check new module's conflicts against existing
    for conflict in &module.conflicts {
        if existing_modules.contains(conflict) {
            return Err(format!(
                "Module '{}' conflicts with existing module '{}'",
                module_id, conflict
            ));
        }
    }

    // Check existing modules' conflicts against new
    for existing_id in &existing_modules {
        if let Some(existing_mod) = all_modules.iter().find(|m| m.id == *existing_id) {
            if existing_mod.conflicts.contains(&module_id.to_string()) {
                return Err(format!(
                    "Existing module '{}' conflicts with '{}'",
                    existing_id, module_id
                ));
            }
        }
    }

    Ok(())
}
