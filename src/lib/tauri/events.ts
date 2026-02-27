import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Listen for LSP JSON-RPC messages emitted by the Rust backend.
 * The backend emits raw JSON strings on the 'lsp://message' event.
 */
export function onLspMessage(callback: (message: string) => void): Promise<UnlistenFn> {
    return listen<string>('lsp://message', (event) => {
        callback(event.payload);
    });
}

export interface FileChangeEvent {
    paths: string[];
    kind: 'create' | 'modify' | 'remove' | 'other';
}

/**
 * Listen for file system change events from the Rust file watcher.
 */
export function onFileChange(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
    return listen<FileChangeEvent>('fs://change', (event) => {
        callback(event.payload);
    });
}

/**
 * Listen for workspace-level file system changes (folder create/remove).
 */
export function onWorkspaceChange(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
    return listen<FileChangeEvent>('fs://workspace-change', (event) => {
        callback(event.payload);
    });
}

// === Command Runner Events ===

export function onRunnerStdout(callback: (line: string) => void): Promise<UnlistenFn> {
    return listen<string>('runner:stdout', (event) => {
        callback(event.payload);
    });
}

export function onRunnerStderr(callback: (line: string) => void): Promise<UnlistenFn> {
    return listen<string>('runner:stderr', (event) => {
        callback(event.payload);
    });
}

export function onRunnerExit(callback: (exitCode: number) => void): Promise<UnlistenFn> {
    return listen<number>('runner:exit', (event) => {
        callback(event.payload);
    });
}
