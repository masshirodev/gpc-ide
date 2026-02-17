use crate::models::config::GameConfig;
use crate::models::module::ModuleDefinition;
use crate::pipeline::config_gen::{generate_config_toml, NewGameConfig};
use crate::pipeline::generate::Generator;
use crate::pipeline::modules;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Parameters received from the frontend wizard
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CreateGameParams {
    pub name: String,
    pub display_name: Option<String>,
    pub username: Option<String>,
    pub game_type: String,
    pub console_type: Option<String>,
    pub version: u32,
    pub profiles: u32,
    pub module_ids: Vec<String>,
    pub module_params: HashMap<String, HashMap<String, String>>,
    pub quick_toggles: HashMap<String, String>,
    pub weapon_names: Vec<String>,
    pub workspace_path: Option<String>,
}

/// Result of game creation
#[derive(Debug, Clone, serde::Serialize)]
pub struct CreateGameResult {
    pub game_path: String,
    pub config_path: String,
    pub files_created: Vec<String>,
}

/// Create a new game: generate config.toml and keyboard.gpc if needed
pub fn create_game(
    app_root: &Path,
    params: CreateGameParams,
) -> Result<CreateGameResult, String> {
    let workspace = params.workspace_path.as_ref()
        .map(|p| PathBuf::from(p))
        .unwrap_or_else(|| app_root.join("Games"));
    let game_dir = workspace.join(&params.name);

    // Check if game already exists
    if game_dir.exists() {
        return Err(format!(
            "Game directory already exists: {}",
            game_dir.display()
        ));
    }

    // Load all module definitions
    let all_modules = modules::load_all_modules(app_root)?;

    // Resolve dependencies and validate
    let resolved_ids = modules::resolve_dependencies(&params.module_ids, &all_modules)?;

    // Get full module definitions for resolved IDs
    let module_map: HashMap<&str, &ModuleDefinition> =
        all_modules.iter().map(|m| (m.id.as_str(), m)).collect();

    let mut resolved_modules: Vec<ModuleDefinition> = Vec::new();
    for id in &resolved_ids {
        if let Some(module) = module_map.get(id.as_str()) {
            resolved_modules.push((*module).clone());
        } else {
            return Err(format!("Module '{}' not found in registry", id));
        }
    }

    // Fill in default param values for modules not explicitly configured
    let mut module_params = params.module_params.clone();
    for module in &resolved_modules {
        if !module.params.is_empty() && !module_params.contains_key(&module.id) {
            let defaults: HashMap<String, String> = module
                .params
                .iter()
                .filter_map(|p| p.default.as_ref().map(|d| (p.key.clone(), d.clone())))
                .collect();
            if !defaults.is_empty() {
                module_params.insert(module.id.clone(), defaults);
            }
        }
    }

    // Generate weapon names if weapondata is present but no names provided
    let weapon_names = if resolved_ids.contains(&"weapondata".to_string())
        && params.weapon_names.is_empty()
    {
        (1..=30).map(|i| format!("Weapon {}", i)).collect()
    } else {
        params.weapon_names.clone()
    };

    // Build config
    let config = NewGameConfig {
        name: game_basename(&params.name),
        display_name: params.display_name.clone(),
        username: params.username.clone(),
        game_type: params.game_type.clone(),
        console_type: params.console_type.clone(),
        version: params.version,
        profiles: params.profiles,
        weapon_names,
        modules: resolved_modules.clone(),
        module_params,
        quick_toggles: params.quick_toggles.clone(),
    };

    // Generate config.toml content
    let config_content = generate_config_toml(&config);

    // Create directories
    std::fs::create_dir_all(&game_dir)
        .map_err(|e| format!("Failed to create game directory: {}", e))?;
    std::fs::create_dir_all(game_dir.join("modules"))
        .map_err(|e| format!("Failed to create Modules directory: {}", e))?;

    let mut files_created = Vec::new();

    // Write config.toml
    let config_path = game_dir.join("config.toml");
    std::fs::write(&config_path, &config_content)
        .map_err(|e| format!("Failed to write config.toml: {}", e))?;
    files_created.push("config.toml".to_string());

    // Write keyboard.gpc if keyboard module is selected
    for module in &resolved_modules {
        if module.requires_keyboard_file.unwrap_or(false) {
            if let Some(ref combo) = module.combo {
                let keyboard_path = game_dir.join("keyboard.gpc");
                std::fs::write(&keyboard_path, combo.trim())
                    .map_err(|e| format!("Failed to write keyboard.gpc: {}", e))?;
                files_created.push("keyboard.gpc".to_string());
            }
        }
    }

    // Parse config.toml back to run the generator
    let game_config: GameConfig = toml::from_str(&config_content)
        .map_err(|e| format!("Failed to parse generated config.toml: {}", e))?;

    // Build module metadata map
    let module_metadata: HashMap<String, ModuleDefinition> = resolved_modules
        .iter()
        .map(|m| (m.id.clone(), m.clone()))
        .collect();

    // Calculate game depth (number of path components from Games/ to game folder)
    let game_depth = Path::new(&params.name).components().count();

    // Run the generator
    let mut generator = Generator::new(game_config, module_metadata, game_depth);
    let result = generator.generate_all();

    // Write all generated files
    for (rel_path, content) in &result.files {
        let full_path = game_dir.join(rel_path);

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        std::fs::write(&full_path, content)
            .map_err(|e| format!("Failed to write {}: {}", rel_path, e))?;
        files_created.push(rel_path.clone());
    }

    // Copy required common template files into common/ subdirectory
    let common_dest_dir = game_dir.join("common");
    std::fs::create_dir_all(&common_dest_dir)
        .map_err(|e| format!("Failed to create common directory: {}", e))?;
    let common_files = get_required_common_files(&params.game_type);
    for common_file in common_files {
        let source = app_root.join("common").join(&common_file);
        let dest = common_dest_dir.join(&common_file);

        if source.exists() {
            match std::fs::copy(&source, &dest) {
                Ok(_) => {
                    files_created.push(format!("common/{}", common_file));
                }
                Err(e) => {
                    log::warn!("Failed to copy common/{}: {}", common_file, e);
                }
            }
        }
    }

    // Copy required drawing template files into drawings/ subdirectory
    let drawings_dest_dir = game_dir.join("drawings");
    std::fs::create_dir_all(&drawings_dest_dir)
        .map_err(|e| format!("Failed to create drawings directory: {}", e))?;
    let drawing_files = get_required_drawing_files();
    for drawing_file in drawing_files {
        let source = app_root.join("drawings").join(&drawing_file);
        let dest = drawings_dest_dir.join(&drawing_file);

        if source.exists() {
            match std::fs::copy(&source, &dest) {
                Ok(_) => {
                    files_created.push(format!("drawings/{}", drawing_file));
                }
                Err(e) => {
                    log::warn!("Failed to copy drawings/{}: {}", drawing_file, e);
                }
            }
        }
    }

    Ok(CreateGameResult {
        game_path: game_dir.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        files_created,
    })
}

/// Determine which common files should be copied for this game
fn get_required_common_files(game_type: &str) -> Vec<String> {
    let mut files = Vec::new();

    // Core files needed by most games
    files.push("bitpack.gpc".to_string());  // Persistence helper
    files.push("helper.gpc".to_string());   // Common helper functions
    files.push("text.gpc".to_string());     // Common text strings
    files.push("scroll.gpc".to_string());   // Scrollbar functions
    files.push("oled.gpc".to_string());     // OLED display utilities
    files.push("control.gpc".to_string());  // Controller input helpers

    // FGS games need fgc.gpc for fighting game common utilities
    if game_type == "fgs" {
        files.push("fgc.gpc".to_string());
    }

    // Future: modules could declare dependencies on specific files

    files
}

/// Determine which drawing files should be copied for this game
fn get_required_drawing_files() -> Vec<String> {
    vec![
        "scroll_outer.gpc".to_string(),   // Scroll bar border
        "scroll_current.gpc".to_string(), // Current page indicator
        "selector.gpc".to_string(),       // Menu selector
        "toggle.gpc".to_string(),         // Toggle display helper
    ]
}

/// Extract the basename from a potentially nested path (e.g., "Shooter/Arc" -> "Arc")
fn game_basename(name: &str) -> String {
    Path::new(name)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}
