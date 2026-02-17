mod commands;
mod lsp;
mod models;
mod pipeline;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::lsp::LspState::default())
        .manage(commands::watcher::WatcherState::default())
        .manage(commands::watcher::WorkspaceWatcherState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::game::list_games,
            commands::game::get_game_config,
            commands::game::get_app_root,
            commands::game::delete_game,
            commands::module::list_modules,
            commands::module::list_available_modules,
            commands::module::get_module,
            commands::module::validate_module_selection,
            commands::module::save_user_module,
            commands::module::delete_user_module,
            commands::wizard::create_game,
            commands::wizard::add_module,
            commands::build::build_game_cmd,
            commands::build::get_build_output_path,
            commands::config::save_game_config,
            commands::config::read_file,
            commands::config::write_file,
            commands::config::read_file_tree,
            commands::config::create_standalone_file,
            commands::config::delete_file,
            commands::config::regenerate_file,
            commands::config::regenerate_all,
            commands::lsp::lsp_start,
            commands::lsp::lsp_stop,
            commands::lsp::lsp_send,
            commands::lsp::lsp_status,
            commands::watcher::watch_directory,
            commands::watcher::unwatch_directory,
            commands::watcher::watch_workspaces,
            commands::workspace::pick_workspace_directory,
            commands::workspace::get_default_workspace,
            commands::templates::list_templates,
            commands::templates::read_template,
            commands::templates::import_template,
            commands::search::search_in_files,
            commands::search::replace_in_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
