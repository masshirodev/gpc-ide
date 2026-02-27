import { readFile, writeFile } from '$lib/tauri/commands';
import { getLspClient } from '$lib/stores/lsp.svelte';
import { pathToUri } from '$lib/lsp/MonacoLspBridge';
import { addToast } from '$lib/stores/toast.svelte';
import { addRecentFile, getSettings } from '$lib/stores/settings.svelte';

export interface EditorTab {
    path: string;
    name: string;
    content: string;
    originalContent: string;
    dirty: boolean;
}

interface EditorStore {
    tabs: EditorTab[];
    activeTabPath: string | null;
    saving: boolean;
}

let store = $state<EditorStore>({
    tabs: [],
    activeTabPath: null,
    saving: false,
});

// Debounce timers for LSP didChange notifications
const changeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const documentVersions = new Map<string, number>();

// Track paths recently written by the app to suppress false watcher events
const recentWrites = new Set<string>();

/** Check if a file was recently saved by the app (suppresses false "modified externally" alerts) */
export function wasRecentlySaved(path: string): boolean {
    return recentWrites.has(path);
}

export function getEditorStore() {
    return store;
}

export function getActiveTab(): EditorTab | undefined {
    return store.tabs.find((t) => t.path === store.activeTabPath);
}

function getFileName(path: string): string {
    return path.split('/').pop() || path;
}

export async function openTab(path: string) {
    // If already open, just activate
    const existing = store.tabs.find((t) => t.path === path);
    if (existing) {
        store.activeTabPath = path;
        return;
    }

    // Load file content
    try {
        const content = await readFile(path);
        const tab: EditorTab = {
            path,
            name: getFileName(path),
            content,
            originalContent: content,
            dirty: false,
        };
        store.tabs = [...store.tabs, tab];
        store.activeTabPath = path;
        addRecentFile(path);
        persistSession();

        // Notify LSP that the document was opened (GPC files only)
        if (path.endsWith('.gpc')) {
            const client = getLspClient();
            if (client?.isInitialized()) {
                const uri = pathToUri(path);
                documentVersions.set(path, 1);
                client.textDocumentDidOpen(uri, content);
            }
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addToast(`Failed to open file: ${msg}`, 'error');
    }
}

export function closeTab(path: string) {
    const tab = store.tabs.find((t) => t.path === path);
    if (tab?.dirty && !confirm(`Discard unsaved changes to ${tab.name}?`)) {
        return;
    }

    const idx = store.tabs.findIndex((t) => t.path === path);
    store.tabs = store.tabs.filter((t) => t.path !== path);

    // If closing the active tab, switch to an adjacent one
    if (store.activeTabPath === path) {
        if (store.tabs.length === 0) {
            store.activeTabPath = null;
        } else {
            const newIdx = Math.min(idx, store.tabs.length - 1);
            store.activeTabPath = store.tabs[newIdx].path;
        }
    }
    persistSession();

    // Clear debounce timer
    const timer = changeTimers.get(path);
    if (timer) {
        clearTimeout(timer);
        changeTimers.delete(path);
    }
    documentVersions.delete(path);

    // Notify LSP that the document was closed (GPC files only)
    if (path.endsWith('.gpc')) {
        const client = getLspClient();
        if (client?.isInitialized()) {
            client.textDocumentDidClose(pathToUri(path));
        }
    }
}

export function activateTab(path: string) {
    store.activeTabPath = path;
    persistSession();
}

export function updateTabContent(path: string, content: string) {
    const tab = store.tabs.find((t) => t.path === path);
    if (tab) {
        tab.content = content;
        tab.dirty = content !== tab.originalContent;

        // Schedule auto-save if enabled
        if (tab.dirty) {
            scheduleAutoSave(path);
        } else {
            cancelAutoSave(path);
        }
    }

    // Debounced LSP didChange notification (150ms, GPC files only)
    if (path.endsWith('.gpc')) {
        const existing = changeTimers.get(path);
        if (existing) clearTimeout(existing);

        changeTimers.set(
            path,
            setTimeout(() => {
                changeTimers.delete(path);
                const client = getLspClient();
                if (client?.isInitialized()) {
                    const version = (documentVersions.get(path) || 1) + 1;
                    documentVersions.set(path, version);
                    client.textDocumentDidChange(pathToUri(path), version, content);
                }
            }, 150)
        );
    }
}

export async function saveTab(path?: string) {
    const targetPath = path ?? store.activeTabPath;
    if (!targetPath || store.saving) return;

    const tab = store.tabs.find((t) => t.path === targetPath);
    if (!tab || !tab.dirty) return;

    store.saving = true;
    try {
        recentWrites.add(targetPath);
        await writeFile(targetPath, tab.content);
        tab.originalContent = tab.content;
        tab.dirty = false;
        setTimeout(() => recentWrites.delete(targetPath), 1000);

        // Notify LSP that the document was saved (GPC files only)
        if (targetPath.endsWith('.gpc')) {
            const client = getLspClient();
            if (client?.isInitialized()) {
                client.textDocumentDidSave(pathToUri(targetPath));
            }
        }

        addToast(`Saved ${tab.name}`, 'success', 2000);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addToast(`Failed to save ${tab.name}: ${msg}`, 'error');
    } finally {
        store.saving = false;
    }
}

export function closeAllTabs() {
    const dirtyTabs = store.tabs.filter((t) => t.dirty);
    if (dirtyTabs.length > 0) {
        if (!confirm(`Discard unsaved changes in ${dirtyTabs.length} file(s)?`)) {
            return;
        }
    }

    // Notify LSP about all closing GPC documents
    const client = getLspClient();
    if (client?.isInitialized()) {
        for (const tab of store.tabs) {
            if (tab.path.endsWith('.gpc')) {
                client.textDocumentDidClose(pathToUri(tab.path));
            }
        }
    }

    // Clear all timers
    for (const timer of changeTimers.values()) {
        clearTimeout(timer);
    }
    changeTimers.clear();
    documentVersions.clear();

    store.tabs = [];
    store.activeTabPath = null;
    persistSession();
}

export function hasUnsavedChanges(): boolean {
    return store.tabs.some((t) => t.dirty);
}

/** Reload a tab's content from disk (e.g., after external edit) */
export async function reloadTab(path: string) {
    const tab = store.tabs.find((t) => t.path === path);
    if (!tab) return;

    try {
        const content = await readFile(path);
        tab.content = content;
        tab.originalContent = content;
        tab.dirty = false;

        // Notify LSP about the change (GPC files only)
        if (path.endsWith('.gpc')) {
            const client = getLspClient();
            if (client?.isInitialized()) {
                const version = (documentVersions.get(path) || 1) + 1;
                documentVersions.set(path, version);
                client.textDocumentDidChange(pathToUri(path), version, content);
            }
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addToast(`Failed to reload ${tab.name}: ${msg}`, 'error');
    }
}

/** Get a tab by path */
export function getTab(path: string): EditorTab | undefined {
    return store.tabs.find((t) => t.path === path);
}

// --- Pending line jump (for build error → editor navigation) ---

let _pendingJump: { path: string; line: number } | null = null;

export async function openTabAtLine(path: string, line: number) {
    _pendingJump = { path, line };
    await openTab(path);
}

export function consumePendingJump(forPath: string): number | null {
    if (_pendingJump && _pendingJump.path === forPath) {
        const line = _pendingJump.line;
        _pendingJump = null;
        return line;
    }
    return null;
}

// --- Auto-save ---

let autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleAutoSave(path: string) {
    const existing = autoSaveTimers.get(path);
    if (existing) clearTimeout(existing);

    let delay: number;
    try {
        const settings = getSettings();
        let currentSettings: { autoSave: boolean; autoSaveDelay: number } | undefined;
        const unsub = settings.subscribe(s => { currentSettings = s; });
        unsub();
        if (!currentSettings?.autoSave) return;
        delay = currentSettings.autoSaveDelay;
    } catch {
        return;
    }

    autoSaveTimers.set(
        path,
        setTimeout(() => {
            autoSaveTimers.delete(path);
            saveTab(path);
        }, delay)
    );
}

export function cancelAutoSave(path: string) {
    const timer = autoSaveTimers.get(path);
    if (timer) {
        clearTimeout(timer);
        autoSaveTimers.delete(path);
    }
}

// --- Session persistence ---

const SESSION_KEY = 'gpc-ide-session';

interface SessionData {
    tabPaths: string[];
    activeTabPath: string | null;
}

function persistSession() {
    try {
        const data: SessionData = {
            tabPaths: store.tabs.map(t => t.path),
            activeTabPath: store.activeTabPath,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
        // Ignore write errors
    }
}

export async function restoreSession(): Promise<boolean> {
    try {
        let enabled = true;
        const settings = getSettings();
        const unsub = settings.subscribe(s => { enabled = s.sessionRestore; });
        unsub();
        if (!enabled) return false;

        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return false;

        const data: SessionData = JSON.parse(raw);
        if (!data.tabPaths?.length) return false;

        for (const path of data.tabPaths) {
            try {
                await openTab(path);
            } catch {
                // Skip files that no longer exist
            }
        }

        if (data.activeTabPath && store.tabs.some(t => t.path === data.activeTabPath)) {
            store.activeTabPath = data.activeTabPath;
        }

        return store.tabs.length > 0;
    } catch {
        return false;
    }
}
