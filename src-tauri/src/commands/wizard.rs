use crate::commands::game::app_root;
use crate::pipeline::newgame::{CreateGameParams, CreateGameResult};

/// Create a new game from the wizard parameters
#[tauri::command]
pub fn create_game(params: CreateGameParams) -> Result<CreateGameResult, String> {
    let root = app_root();
    crate::pipeline::newgame::create_game(&root, params)
}
