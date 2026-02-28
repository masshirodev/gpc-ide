use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

struct FileServerHandle {
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

pub struct FileServerState {
    inner: Arc<Mutex<Option<FileServerHandle>>>,
}

impl Default for FileServerState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn start_file_server(
    file_path: String,
    state: State<'_, FileServerState>,
) -> Result<String, String> {
    // Stop any existing server
    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        if let Some(mut handle) = guard.take() {
            if let Some(tx) = handle.shutdown_tx.take() {
                let _ = tx.send(());
            }
        }
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                result = listener.accept() => {
                    if let Ok((mut stream, _)) = result {
                        let content = content.clone();
                        tokio::spawn(async move {
                            let mut buf = [0u8; 4096];
                            let n = match stream.read(&mut buf).await {
                                Ok(n) => n,
                                Err(_) => return,
                            };
                            let request = String::from_utf8_lossy(&buf[..n]);
                            let is_options = request.starts_with("OPTIONS");

                            if is_options {
                                let response = "HTTP/1.1 204 No Content\r\n\
                                    Access-Control-Allow-Origin: *\r\n\
                                    Access-Control-Allow-Methods: GET, OPTIONS\r\n\
                                    Access-Control-Allow-Headers: *\r\n\
                                    Connection: close\r\n\
                                    \r\n";
                                let _ = stream.write_all(response.as_bytes()).await;
                            } else {
                                let body = content.as_bytes();
                                let header = format!(
                                    "HTTP/1.1 200 OK\r\n\
                                     Content-Type: text/plain; charset=utf-8\r\n\
                                     Content-Length: {}\r\n\
                                     Access-Control-Allow-Origin: *\r\n\
                                     Access-Control-Allow-Methods: GET, OPTIONS\r\n\
                                     Access-Control-Allow-Headers: *\r\n\
                                     Connection: close\r\n\
                                     \r\n",
                                    body.len()
                                );
                                let _ = stream.write_all(header.as_bytes()).await;
                                let _ = stream.write_all(body).await;
                            }
                        });
                    }
                }
                _ = &mut shutdown_rx => {
                    break;
                }
            }
        }
    });

    // Store handle
    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        *guard = Some(FileServerHandle {
            shutdown_tx: Some(shutdown_tx),
        });
    }

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();

    Ok(format!("http://127.0.0.1:{}/{}", port, filename))
}

#[tauri::command]
pub async fn stop_file_server(state: State<'_, FileServerState>) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut handle) = guard.take() {
        if let Some(tx) = handle.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
    Ok(())
}
