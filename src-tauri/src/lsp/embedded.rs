use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader, WriteHalf};
use tokio::sync::Mutex;

pub struct EmbeddedLspProvider {
    client_write: Arc<Mutex<Option<WriteHalf<tokio::io::DuplexStream>>>>,
    running: Arc<AtomicBool>,
    server_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl EmbeddedLspProvider {
    /// Start the embedded LSP server on in-memory streams.
    pub async fn start(
        app_handle: AppHandle,
        features: ersa_lsp_core::lsp::Features,
    ) -> Result<Self, String> {
        let (client_stream, server_stream) = tokio::io::duplex(65536);

        let (server_read, server_write) = tokio::io::split(server_stream);
        let (client_read, client_write) = tokio::io::split(client_stream);

        let running = Arc::new(AtomicBool::new(true));
        let running_reader = running.clone();

        // Spawn the LSP server on the server-side streams
        let server_task = tokio::spawn(async move {
            ersa_lsp_core::lsp::LSP::start_with_streams(features, server_read, server_write).await;
        });

        // Spawn background reader: read JSON-RPC from client_read, emit as Tauri events
        tokio::spawn(async move {
            let mut reader = BufReader::new(client_read);
            let mut header_buf = String::new();

            loop {
                if !running_reader.load(Ordering::Relaxed) {
                    break;
                }

                // Read headers until empty line
                let mut content_length: usize = 0;
                loop {
                    header_buf.clear();
                    match reader.read_line(&mut header_buf).await {
                        Ok(0) => return, // EOF
                        Ok(_) => {
                            let line = header_buf.trim();
                            if line.is_empty() {
                                break; // End of headers
                            }
                            if let Some(len_str) = line.strip_prefix("Content-Length: ") {
                                if let Ok(len) = len_str.parse::<usize>() {
                                    content_length = len;
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("Embedded LSP read error: {}", e);
                            return;
                        }
                    }
                }

                if content_length == 0 {
                    continue;
                }

                // Read exactly content_length bytes of the JSON body
                let mut body = vec![0u8; content_length];
                if let Err(e) = reader.read_exact(&mut body).await {
                    log::error!("Embedded LSP body read error: {}", e);
                    break;
                }

                let message = String::from_utf8_lossy(&body).to_string();

                // Emit raw JSON-RPC message to the frontend
                if let Err(e) = app_handle.emit("lsp://message", &message) {
                    log::error!("Failed to emit embedded LSP message: {}", e);
                }
            }
        });

        Ok(EmbeddedLspProvider {
            client_write: Arc::new(Mutex::new(Some(client_write))),
            running,
            server_task: Arc::new(Mutex::new(Some(server_task))),
        })
    }

    /// Send a JSON-RPC message with Content-Length header framing.
    pub async fn send(&self, message: &str) -> Result<(), String> {
        let header = format!("Content-Length: {}\r\n\r\n", message.len());

        let mut write_guard = self.client_write.lock().await;
        if let Some(ref mut writer) = *write_guard {
            writer
                .write_all(header.as_bytes())
                .await
                .map_err(|e| format!("Failed to write embedded LSP header: {}", e))?;
            writer
                .write_all(message.as_bytes())
                .await
                .map_err(|e| format!("Failed to write embedded LSP body: {}", e))?;
            writer
                .flush()
                .await
                .map_err(|e| format!("Failed to flush embedded LSP: {}", e))?;
            Ok(())
        } else {
            Err("Embedded LSP write stream not available".to_string())
        }
    }

    /// Stop the embedded LSP server.
    pub async fn stop(&self) -> Result<(), String> {
        self.running.store(false, Ordering::Relaxed);

        // Close the write half to signal EOF to the server
        {
            let mut write_guard = self.client_write.lock().await;
            *write_guard = None;
        }

        // Wait briefly for graceful shutdown, then abort as fallback
        let mut task_guard = self.server_task.lock().await;
        if let Some(task) = task_guard.take() {
            tokio::select! {
                _ = task => {}
                _ = tokio::time::sleep(std::time::Duration::from_secs(2)) => {
                    log::warn!("Embedded LSP server did not shut down gracefully, aborting");
                }
            }
        }

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }
}
