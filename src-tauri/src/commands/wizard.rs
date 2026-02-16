use crate::commands::game::app_root;
use crate::pipeline::addmodule::{AddModuleParams, AddModuleResult};
use crate::pipeline::newgame::{CreateGameParams, CreateGameResult};
use std::path::PathBuf;

/// Create a new game from the wizard parameters
#[tauri::command]
pub fn create_game(params: CreateGameParams) -> Result<CreateGameResult, String> {
    let root = app_root();
    crate::pipeline::newgame::create_game(&root, params)
}

/// Add a module to an existing game
#[tauri::command]
pub fn add_module(
    game_path: String,
    params: AddModuleParams,
    workspace_paths: Option<Vec<String>>,
) -> Result<AddModuleResult, String> {
    let root = app_root();
    let game_dir = PathBuf::from(&game_path);

    if !game_dir.exists() {
        return Err(format!("Game directory not found: {}", game_path));
    }

    // Load all modules including user modules from workspaces
    let extra: Vec<PathBuf> = workspace_paths
        .as_ref()
        .map(|paths| paths.iter().filter(|p| !p.is_empty()).map(PathBuf::from).collect())
        .unwrap_or_default();
    let all_modules = crate::pipeline::modules::load_all_modules_with_paths(&root, &extra)?;

    // Find the requested module
    let module = all_modules
        .iter()
        .find(|m| m.id == params.module_id)
        .ok_or_else(|| format!("Module '{}' not found", params.module_id))?;

    crate::pipeline::addmodule::add_module(&game_dir, module, &params, &all_modules)
}
