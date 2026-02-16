use crate::lsp::embedded::EmbeddedLspProvider;
use crate::lsp::provider::LspProviderKind;
use crate::lsp::stdio::StdioLspProvider;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Managed state for the LSP provider
pub struct LspState {
    pub provider: Arc<Mutex<Option<LspProviderKind>>>,
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
/// If a custom command is provided (or GPC_LSP_COMMAND env var is set), spawns an
/// external process via stdio. Otherwise, starts the embedded ersa-lsp-core server
/// in-process using in-memory channels.
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

    // Determine provider: custom command -> stdio, otherwise -> embedded
    let provider = if let Some(resolved) = resolve_external_command(custom_command) {
        let (command, args) = resolved?;
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let stdio = StdioLspProvider::start(&command, &arg_refs, app_handle).await?;
        LspProviderKind::Stdio(stdio)
    } else {
        let features = ersa_lsp_core::lsp::Features::all();
        let embedded = EmbeddedLspProvider::start(app_handle, features).await?;
        LspProviderKind::Embedded(embedded)
    };

    // Send initialize request (id: 0)
    let workspace_name = workspace_root
        .split('/')
        .last()
        .unwrap_or("workspace")
        .to_string();

    let initialize_params = build_initialize_params(&workspace_root, &workspace_name);
    provider.send(&initialize_params.to_string()).await?;

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

/// Forward a raw JSON-RPC message to the language server.
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

/// Returns Some if an external command should be used, None if embedded should be used.
fn resolve_external_command(
    custom_command: Option<String>,
) -> Option<Result<(String, Vec<String>), String>> {
    let custom_str = custom_command
        .filter(|s| !s.trim().is_empty())
        .or_else(|| std::env::var("GPC_LSP_COMMAND").ok());

    custom_str.map(|custom| {
        let parts: Vec<String> = custom.split_whitespace().map(String::from).collect();
        if parts.is_empty() {
            Err("Custom LSP command is empty".to_string())
        } else {
            let command = parts[0].clone();
            let args = parts[1..].to_vec();
            Ok((command, args))
        }
    })
}

/// Build the JSON-RPC initialize request with full client capabilities.
fn build_initialize_params(workspace_root: &str, workspace_name: &str) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": 0,
        "method": "initialize",
        "params": {
            "processId": std::process::id(),
            "capabilities": {
                "textDocument": {
                    "completion": {
                        "completionItem": {
                            "snippetSupport": true,
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "hover": {
                        "contentFormat": ["markdown", "plaintext"]
                    },
                    "signatureHelp": {
                        "signatureInformation": {
                            "documentationFormat": ["markdown", "plaintext"],
                            "parameterInformation": {
                                "labelOffsetSupport": true
                            }
                        }
                    },
                    "synchronization": {
                        "didSave": true,
                        "dynamicRegistration": false
                    },
                    "publishDiagnostics": {
                        "relatedInformation": true,
                        "tagSupport": {
                            "valueSet": [1, 2]
                        }
                    },
                    "definition": {
                        "dynamicRegistration": false
                    },
                    "references": {
                        "dynamicRegistration": false
                    },
                    "documentHighlight": {
                        "dynamicRegistration": false
                    },
                    "documentSymbol": {
                        "dynamicRegistration": false,
                        "hierarchicalDocumentSymbolSupport": true
                    },
                    "formatting": {
                        "dynamicRegistration": false
                    },
                    "rename": {
                        "dynamicRegistration": false,
                        "prepareSupport": false
                    },
                    "foldingRange": {
                        "dynamicRegistration": false,
                        "lineFoldingOnly": true
                    },
                    "semanticTokens": {
                        "dynamicRegistration": false,
                        "requests": {
                            "full": true,
                            "range": false
                        },
                        "tokenTypes": [
                            "function", "variable", "enumMember", "parameter"
                        ],
                        "tokenModifiers": [
                            "declaration", "readonly"
                        ],
                        "formats": ["relative"],
                        "multilineTokenSupport": false,
                        "overlappingTokenSupport": false
                    },
                    "inlayHint": {
                        "dynamicRegistration": false
                    },
                    "diagnostic": {
                        "dynamicRegistration": false
                    },
                    "codeLens": {
                        "dynamicRegistration": false
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
    })
}
