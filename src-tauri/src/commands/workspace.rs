use tauri_plugin_dialog::DialogExt;

/// Pick a directory using the native file picker
#[tauri::command]
pub async fn pick_workspace_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app.dialog()
        .file()
        .set_title("Select Workspace Directory")
        .blocking_pick_folder();

    Ok(folder.map(|path| path.to_string()))
}

/// Get the default workspace directory (APP_ROOT/Games/)
#[tauri::command]
pub fn get_default_workspace() -> Result<String, String> {
    let root = crate::commands::game::app_root();
    let games_dir = root.join("Games");
    Ok(games_dir.to_string_lossy().to_string())
}
