import { writable } from 'svelte/store';

interface AppSettings {
    customLspCommand: string;
    editorFontSize: number;
    editorTabSize: number;
    editorFontFamily: string;
    editorTheme: string;
    workspaces: string[];
}

const DEFAULTS: AppSettings = {
    customLspCommand: '',
    editorFontSize: 13,
    editorTabSize: 4,
    editorFontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, monospace',
    editorTheme: 'gpc-dark',
    workspaces: [],
};

const STORAGE_KEY = 'gpc-ide-settings';

function loadSettings(): AppSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            return { ...DEFAULTS, ...JSON.parse(raw) };
        }
    } catch {
        // Ignore parse errors
    }
    return { ...DEFAULTS };
}

const store = writable<AppSettings>(loadSettings());

function persist(settings: AppSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getSettings() {
    return store;
}

export function updateSettings(partial: Partial<AppSettings>) {
    store.update(current => {
        const updated = { ...current, ...partial };
        persist(updated);
        return updated;
    });
}

export function resetSettings() {
    store.set(DEFAULTS);
    persist(DEFAULTS);
}

export function addWorkspace(path: string) {
    store.update(current => {
        if (!current.workspaces.includes(path)) {
            const updated = { ...current, workspaces: [...current.workspaces, path] };
            persist(updated);
            return updated;
        }
        return current;
    });
}

export function removeWorkspace(path: string) {
    store.update(current => {
        const updated = { ...current, workspaces: current.workspaces.filter(w => w !== path) };
        persist(updated);
        return updated;
    });
}
