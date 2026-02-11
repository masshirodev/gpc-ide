import { invoke } from '@tauri-apps/api/core';
import { onLspMessage } from '$lib/tauri/events';
import type { UnlistenFn } from '@tauri-apps/api/event';

interface PendingRequest {
    resolve: (result: unknown) => void;
    reject: (error: unknown) => void;
    method: string;
}

type DiagnosticHandler = (uri: string, diagnostics: LspDiagnostic[]) => void;
type LogHandler = (message: string) => void;

export interface LspDiagnostic {
    range: LspRange;
    severity?: number;
    message: string;
    source?: string;
    relatedInformation?: Array<{
        location: { uri: string; range: LspRange };
        message: string;
    }>;
}

export interface LspRange {
    start: LspPosition;
    end: LspPosition;
}

export interface LspPosition {
    line: number;
    character: number;
}

export class LspClient {
    private nextId = 1; // Start at 1; id 0 is used for initialize
    private pending = new Map<number, PendingRequest>();
    private unlisten: UnlistenFn | null = null;
    private diagnosticHandler: DiagnosticHandler | null = null;
    private logHandler: LogHandler | null = null;
    private initialized = false;

    /**
     * Start the LSP server and begin listening for messages.
     * The Rust backend spawns the process and sends the initialize request (id: 0).
     * We wait for that response, then send the initialized notification.
     */
    async start(workspaceRoot: string, customCommand?: string): Promise<void> {
        // Start listening for messages from the backend
        this.unlisten = await onLspMessage((raw) => {
            this.handleMessage(raw);
        });

        // Invoke the Rust command to spawn the LSP and send initialize
        await invoke('lsp_start', {
            workspaceRoot,
            customCommand: customCommand || null,
        });

        // Wait for the initialize response (id: 0 sent by Rust)
        await new Promise<void>((resolve, reject) => {
            this.pending.set(0, {
                resolve: () => {
                    this.initialized = true;
                    resolve();
                },
                reject,
                method: 'initialize',
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pending.has(0)) {
                    this.pending.delete(0);
                    reject(new Error('LSP initialize timed out'));
                }
            }, 10000);
        });

        // Send initialized notification
        await this.sendNotification('initialized', {});
    }

    /** Stop the LSP server. */
    async stop(): Promise<void> {
        this.initialized = false;
        this.pending.clear();

        try {
            await invoke('lsp_stop');
        } catch {
            // Ignore errors during shutdown
        }

        if (this.unlisten) {
            this.unlisten();
            this.unlisten = null;
        }
    }

    /** Send a JSON-RPC request and await the response. */
    async sendRequest<T = unknown>(method: string, params: unknown): Promise<T> {
        const id = this.nextId++;
        const message = JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params,
        });

        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, {
                resolve: resolve as (r: unknown) => void,
                reject,
                method,
            });

            invoke('lsp_send', { message }).catch((err) => {
                this.pending.delete(id);
                reject(err);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`LSP request '${method}' timed out (id: ${id})`));
                }
            }, 5000);
        });
    }

    /** Send a JSON-RPC notification (no response expected). */
    async sendNotification(method: string, params: unknown): Promise<void> {
        const message = JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
        });
        await invoke('lsp_send', { message });
    }

    /** Handle an incoming JSON-RPC message from the backend. */
    private handleMessage(raw: string): void {
        let msg: Record<string, unknown>;
        try {
            msg = JSON.parse(raw);
        } catch {
            this.logHandler?.(`Failed to parse LSP message: ${raw.slice(0, 200)}`);
            return;
        }

        // Response to a request we sent
        if ('id' in msg && ('result' in msg || 'error' in msg)) {
            const id = msg.id as number;
            const pending = this.pending.get(id);
            if (pending) {
                this.pending.delete(id);
                if ('error' in msg) {
                    pending.reject(msg.error);
                } else {
                    pending.resolve(msg.result);
                }
            }
            return;
        }

        // Server notification (no id)
        if ('method' in msg && !('id' in msg)) {
            this.handleNotification(
                msg.method as string,
                (msg.params as Record<string, unknown>) || {}
            );
            return;
        }

        // Server request (has both method and id — must respond)
        if ('method' in msg && 'id' in msg) {
            this.handleServerRequest(
                msg.id as number,
                msg.method as string,
                msg.params
            );
            return;
        }
    }

    /** Handle server→client notifications. */
    private handleNotification(method: string, params: Record<string, unknown>): void {
        switch (method) {
            case 'textDocument/publishDiagnostics':
                if (this.diagnosticHandler) {
                    this.diagnosticHandler(
                        params.uri as string,
                        params.diagnostics as LspDiagnostic[]
                    );
                }
                break;
            case 'window/logMessage':
                this.logHandler?.(params.message as string);
                break;
            default:
                this.logHandler?.(`Unhandled notification: ${method}`);
        }
    }

    /** Handle server→client requests (must respond). */
    private async handleServerRequest(
        id: number,
        method: string,
        params: unknown
    ): Promise<void> {
        let result: unknown = null;

        switch (method) {
            case 'workspace/configuration': {
                // The GPC server asks for configuration sections
                const items = (params as { items: Array<{ section: string }> }).items;
                result = items.map((item) => {
                    switch (item.section) {
                        case 'gpc.inlayHints.enabled':
                            return true;
                        case 'gpc.inlayHints.parameterNames':
                            return true;
                        case 'gpc.mainFile':
                            return '';
                        case 'gpc.searchForMainFunction':
                            return true;
                        case 'gpc.mainFileNameOnly':
                            return false;
                        default:
                            return null;
                    }
                });
                break;
            }
            default:
                this.logHandler?.(`Unhandled server request: ${method}`);
        }

        // Send response back
        const response = JSON.stringify({ jsonrpc: '2.0', id, result });
        await invoke('lsp_send', { message: response });
    }

    // --- Event handlers ---

    onDiagnostics(handler: DiagnosticHandler): void {
        this.diagnosticHandler = handler;
    }

    onLog(handler: LogHandler): void {
        this.logHandler = handler;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    // --- High-level LSP methods ---

    async textDocumentDidOpen(uri: string, text: string): Promise<void> {
        await this.sendNotification('textDocument/didOpen', {
            textDocument: { uri, languageId: 'gpc', version: 1, text },
        });
    }

    async textDocumentDidChange(
        uri: string,
        version: number,
        text: string
    ): Promise<void> {
        // Full document sync — send entire content
        await this.sendNotification('textDocument/didChange', {
            textDocument: { uri, version },
            contentChanges: [{ text }],
        });
    }

    async textDocumentDidClose(uri: string): Promise<void> {
        await this.sendNotification('textDocument/didClose', {
            textDocument: { uri },
        });
    }

    async completion(
        uri: string,
        position: LspPosition
    ): Promise<unknown> {
        return this.sendRequest('textDocument/completion', {
            textDocument: { uri },
            position,
        });
    }

    async hover(uri: string, position: LspPosition): Promise<unknown> {
        return this.sendRequest('textDocument/hover', {
            textDocument: { uri },
            position,
        });
    }

    async definition(
        uri: string,
        position: LspPosition
    ): Promise<unknown> {
        return this.sendRequest('textDocument/definition', {
            textDocument: { uri },
            position,
        });
    }

    async references(
        uri: string,
        position: LspPosition,
        includeDeclaration: boolean
    ): Promise<unknown> {
        return this.sendRequest('textDocument/references', {
            textDocument: { uri },
            position,
            context: { includeDeclaration },
        });
    }

    async signatureHelp(
        uri: string,
        position: LspPosition
    ): Promise<unknown> {
        return this.sendRequest('textDocument/signatureHelp', {
            textDocument: { uri },
            position,
        });
    }

    async documentSymbols(uri: string): Promise<unknown> {
        return this.sendRequest('textDocument/documentSymbol', {
            textDocument: { uri },
        });
    }
}
