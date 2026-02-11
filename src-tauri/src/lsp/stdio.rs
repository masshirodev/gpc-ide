use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::Mutex;

pub struct StdioLspProvider {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    running: Arc<AtomicBool>,
}

impl StdioLspProvider {
    /// Spawn an LSP server process and begin reading stdout.
    pub async fn start(
        command: &str,
        args: &[&str],
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let mut child = tokio::process::Command::new(command)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn LSP server: {}", e))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to capture LSP stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture LSP stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to capture LSP stderr".to_string())?;

        let running = Arc::new(AtomicBool::new(true));
        let running_reader = running.clone();

        // Background task: read JSON-RPC messages from stdout and emit as Tauri events
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
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
                        Ok(0) => return, // EOF — process exited
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
                            log::error!("LSP stdout read error: {}", e);
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
                    log::error!("LSP body read error: {}", e);
                    break;
                }

                let message = String::from_utf8_lossy(&body).to_string();

                // Emit raw JSON-RPC message to the frontend
                if let Err(e) = app_handle.emit("lsp://message", &message) {
                    log::error!("Failed to emit LSP message: {}", e);
                }
            }
        });

        // Background task: log stderr for debugging
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => log::info!("[LSP stderr] {}", line.trim()),
                    Err(_) => break,
                }
            }
        });

        Ok(StdioLspProvider {
            child: Arc::new(Mutex::new(Some(child))),
            stdin: Arc::new(Mutex::new(Some(stdin))),
            running,
        })
    }

    /// Send a JSON-RPC message with Content-Length header framing.
    pub async fn send(&self, message: &str) -> Result<(), String> {
        let header = format!("Content-Length: {}\r\n\r\n", message.len());

        let mut stdin_guard = self.stdin.lock().await;
        if let Some(ref mut stdin) = *stdin_guard {
            stdin
                .write_all(header.as_bytes())
                .await
                .map_err(|e| format!("Failed to write LSP header: {}", e))?;
            stdin
                .write_all(message.as_bytes())
                .await
                .map_err(|e| format!("Failed to write LSP body: {}", e))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush LSP stdin: {}", e))?;
            Ok(())
        } else {
            Err("LSP stdin not available".to_string())
        }
    }

    /// Stop the language server gracefully.
    pub async fn stop(&self) -> Result<(), String> {
        self.running.store(false, Ordering::Relaxed);

        // Close stdin to signal the child
        {
            let mut stdin_guard = self.stdin.lock().await;
            *stdin_guard = None;
        }

        // Wait for child to exit
        let mut child_guard = self.child.lock().await;
        if let Some(mut child) = child_guard.take() {
            let _ = child.wait().await;
        }

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }
}
