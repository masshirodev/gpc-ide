import { writable } from 'svelte/store';

interface AppSettings {
    username: string;
    customLspCommand: string;
    editorFontSize: number;
    editorTabSize: number;
    editorFontFamily: string;
    editorTheme: string;
    workspaces: string[];
    customGameTypes: string[];
}

const BUILTIN_GAME_TYPES = ['fps', 'tps', 'fgs'];

const DEFAULTS: AppSettings = {
    username: '',
    customLspCommand: '',
    editorFontSize: 13,
    editorTabSize: 4,
    editorFontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, monospace',
    editorTheme: 'gpc-dark',
    workspaces: [],
    customGameTypes: [],
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

export function getAllGameTypes(settings: AppSettings): string[] {
    return [...BUILTIN_GAME_TYPES, ...settings.customGameTypes];
}

export function addGameType(type: string) {
    store.update(current => {
        const normalized = type.toLowerCase().trim();
        if (!normalized || BUILTIN_GAME_TYPES.includes(normalized) || current.customGameTypes.includes(normalized)) {
            return current;
        }
        const updated = { ...current, customGameTypes: [...current.customGameTypes, normalized] };
        persist(updated);
        return updated;
    });
}

export function removeGameType(type: string) {
    store.update(current => {
        const updated = { ...current, customGameTypes: current.customGameTypes.filter(t => t !== type) };
        persist(updated);
        return updated;
    });
}
