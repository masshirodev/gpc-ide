use notify::{RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct WatcherState {
    inner: Arc<Mutex<Option<WatcherInner>>>,
}

struct WatcherInner {
    _watcher: RecommendedWatcher,
    watched_path: PathBuf,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct FileChangeEvent {
    paths: Vec<String>,
    kind: String,
}

fn event_kind_str(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        _ => "other",
    }
}

#[tauri::command]
pub fn watch_directory(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);
    if !watch_path.exists() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;

    // If already watching this path, do nothing
    if let Some(ref inner) = *guard {
        if inner.watched_path == watch_path {
            return Ok(());
        }
    }

    // Stop existing watcher
    *guard = None;

    let app_handle = app.clone();
    let watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        match res {
            Ok(event) => {
                let kind = event_kind_str(&event.kind);
                // Only emit for create/modify/remove (skip access, other)
                if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)) {
                    let paths: Vec<String> = event.paths.iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();
                    let _ = app_handle.emit("fs://change", FileChangeEvent {
                        paths,
                        kind: kind.to_string(),
                    });
                }
            }
            Err(e) => {
                log::warn!("File watcher error: {}", e);
            }
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Use default config with recommended watcher
    let mut watcher = watcher;
    watcher.watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    *guard = Some(WatcherInner {
        _watcher: watcher,
        watched_path: watch_path,
    });

    Ok(())
}

#[tauri::command]
pub fn unwatch_directory(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
