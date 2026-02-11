use crate::lsp::stdio::StdioLspProvider;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Managed state for the LSP provider
pub struct LspState {
    pub provider: Arc<Mutex<Option<StdioLspProvider>>>,
}

impl Default for LspState {
    fn default() -> Self {
        Self {
            provider: Arc::new(Mutex::new(None)),
        }
    }
}

/// Start the GPC language server.
///
/// Spawns the node process with the bundled server.js, sends the initialize
/// request. The frontend LspClient handles the initialize response and sends
/// the initialized notification.
#[tauri::command]
pub async fn lsp_start(
    workspace_root: String,
    custom_command: Option<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, LspState>,
) -> Result<(), String> {
    let mut provider_guard = state.provider.lock().await;

    // Stop existing instance if running
    if let Some(existing) = provider_guard.take() {
        let _ = existing.stop().await;
    }

    let (command, args) = resolve_server_command(custom_command)?;
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let provider = StdioLspProvider::start(&command, &arg_refs, app_handle).await?;

    // Send initialize request (id: 0)
    let workspace_name = workspace_root
        .split('/')
        .last()
        .unwrap_or("workspace")
        .to_string();

    let initialize_params = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 0,
        "method": "initialize",
        "params": {
            "processId": std::process::id(),
            "capabilities": {
                "textDocument": {
                    "completion": {
                        "completionItem": {
                            "snippetSupport": false,
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "hover": {
                        "contentFormat": ["markdown", "plaintext"]
                    },
                    "signatureHelp": {
                        "signatureInformation": {
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "synchronization": {
                        "didSave": true,
                        "dynamicRegistration": false
                    },
                    "publishDiagnostics": {
                        "relatedInformation": true
                    }
                },
                "workspace": {
                    "configuration": true
                }
            },
            "rootUri": format!("file://{}", workspace_root),
            "workspaceFolders": [{
                "uri": format!("file://{}", workspace_root),
                "name": workspace_name
            }]
        }
    });

    provider
        .send(&initialize_params.to_string())
        .await?;

    *provider_guard = Some(provider);
    Ok(())
}

/// Stop the GPC language server gracefully.
#[tauri::command]
pub async fn lsp_stop(state: State<'_, LspState>) -> Result<(), String> {
    let mut provider_guard = state.provider.lock().await;
    if let Some(provider) = provider_guard.take() {
        // Send shutdown request
        let shutdown = serde_json::json!({
            "jsonrpc": "2.0",
            "id": -1,
            "method": "shutdown",
            "params": null
        });
        let _ = provider.send(&shutdown.to_string()).await;

        // Send exit notification
        let exit = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "exit",
            "params": null
        });
        let _ = provider.send(&exit.to_string()).await;

        provider.stop().await?;
    }
    Ok(())
}

/// Forward a raw JSON-RPC message to the language server stdin.
#[tauri::command]
pub async fn lsp_send(message: String, state: State<'_, LspState>) -> Result<(), String> {
    let provider_guard = state.provider.lock().await;
    if let Some(ref provider) = *provider_guard {
        provider.send(&message).await
    } else {
        Err("LSP not running".to_string())
    }
}

/// Check if the LSP is currently running.
#[tauri::command]
pub async fn lsp_status(state: State<'_, LspState>) -> Result<bool, String> {
    let provider_guard = state.provider.lock().await;
    Ok(provider_guard
        .as_ref()
        .map(|p| p.is_running())
        .unwrap_or(false))
}

/// Resolve the LSP server command and arguments.
///
/// Priority: 1) custom_command from settings, 2) GPC_LSP_COMMAND env var, 3) bundled server.js
fn resolve_server_command(custom_command: Option<String>) -> Result<(String, Vec<String>), String> {
    // Check custom command from frontend settings
    let custom_str = custom_command
        .filter(|s| !s.trim().is_empty())
        .or_else(|| std::env::var("GPC_LSP_COMMAND").ok());

    if let Some(custom) = custom_str {
        let parts: Vec<String> = custom.split_whitespace().map(String::from).collect();
        if parts.is_empty() {
            return Err("Custom LSP command is empty".to_string());
        }
        let command = parts[0].clone();
        let args = parts[1..].to_vec();
        return Ok((command, args));
    }

    // Use bundled server.js
    let server_path = resolve_bundled_server_path()?;
    Ok((
        "node".to_string(),
        vec![server_path, "--stdio".to_string()],
    ))
}

/// Find the bundled server.js relative to the project root.
fn resolve_bundled_server_path() -> Result<String, String> {
    // In development: go from src-tauri/ up to the Frontend/ dir, then lsp-server/server.js
    let cargo_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));

    // cargo_dir = Frontend/src-tauri
    // We want Frontend/lsp-server/server.js
    let server_path = cargo_dir
        .parent() // Frontend/
        .map(|p| p.join("lsp-server").join("server.cjs"));

    if let Some(path) = server_path {
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    // Also try relative to the project root (when running as installed app)
    let alt_path = cargo_dir.join("../lsp-server/server.cjs");
    if alt_path.exists() {
        return Ok(alt_path.canonicalize().unwrap().to_string_lossy().to_string());
    }

    Err(
        "Could not find bundled GPC language server (lsp-server/server.js). \
         Set GPC_LSP_COMMAND environment variable to use a custom LSP server."
            .to_string(),
    )
}
