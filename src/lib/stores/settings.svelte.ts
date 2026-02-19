import { writable } from 'svelte/store';

export interface Snippet {
    id: string;
    name: string;
    description: string;
    code: string;
    tags: string[];
    createdAt: number;
}

interface AppSettings {
    username: string;
    customLspCommand: string;
    editorFontSize: number;
    editorTabSize: number;
    editorFontFamily: string;
    editorTheme: string;
    workspaces: string[];
    customGameTypes: string[];
    snippets: Snippet[];
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
    snippets: [],
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

// === Snippet Management ===

export function addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt'>): Snippet {
    const newSnippet: Snippet = {
        ...snippet,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
    };
    store.update(current => {
        const updated = { ...current, snippets: [...current.snippets, newSnippet] };
        persist(updated);
        return updated;
    });
    return newSnippet;
}

export function updateSnippet(id: string, partial: Partial<Omit<Snippet, 'id' | 'createdAt'>>) {
    store.update(current => {
        const updated = {
            ...current,
            snippets: current.snippets.map(s => s.id === id ? { ...s, ...partial } : s),
        };
        persist(updated);
        return updated;
    });
}

export function removeSnippet(id: string) {
    store.update(current => {
        const updated = { ...current, snippets: current.snippets.filter(s => s.id !== id) };
        persist(updated);
        return updated;
    });
}
