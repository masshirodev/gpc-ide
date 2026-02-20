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

// === Built-in Snippets ===

export const BUILTIN_SNIPPETS: Snippet[] = [
    {
        id: 'builtin-hashmap',
        name: 'HashMap (Array-based)',
        description: 'Simple array-based hash map for integer keys and values',
        tags: ['data-structure', 'built-in'],
        createdAt: 0,
        code: `// Array-based HashMap
// Keys and values stored in parallel arrays
define MAP_SIZE = 32;
int map_keys[MAP_SIZE];
int map_values[MAP_SIZE];
int map_count = 0;

function map_put(key, value) {
    int i;
    for(i = 0; i < map_count; i++) {
        if(map_keys[i] == key) {
            map_values[i] = value;
            return;
        }
    }
    if(map_count < MAP_SIZE) {
        map_keys[map_count] = key;
        map_values[map_count] = value;
        map_count = map_count + 1;
    }
}

function map_get(key) {
    int i;
    for(i = 0; i < map_count; i++) {
        if(map_keys[i] == key) return map_values[i];
    }
    return -1;
}

function map_remove(key) {
    int i;
    for(i = 0; i < map_count; i++) {
        if(map_keys[i] == key) {
            map_count = map_count - 1;
            map_keys[i] = map_keys[map_count];
            map_values[i] = map_values[map_count];
            return;
        }
    }
}`,
    },
    {
        id: 'builtin-string-utils',
        name: 'String Manipulation',
        description: 'Utility functions for working with int8 character arrays',
        tags: ['data-structure', 'string', 'built-in'],
        createdAt: 0,
        code: `// String utility functions for int8 arrays
// Strings are null-terminated int8 arrays

function str_len(str) {
    int i = 0;
    while(str[i] != 0) i = i + 1;
    return i;
}

function str_copy(dest, src) {
    int i = 0;
    while(src[i] != 0) {
        dest[i] = src[i];
        i = i + 1;
    }
    dest[i] = 0;
}

function str_equal(a, b) {
    int i = 0;
    while(a[i] != 0 && b[i] != 0) {
        if(a[i] != b[i]) return FALSE;
        i = i + 1;
    }
    return a[i] == b[i];
}

function str_to_upper(str) {
    int i = 0;
    while(str[i] != 0) {
        if(str[i] >= 97 && str[i] <= 122) {
            str[i] = str[i] - 32;
        }
        i = i + 1;
    }
}`,
    },
    {
        id: 'builtin-list',
        name: 'List (Array-indexed)',
        description: 'Dynamic list with add, remove, and search operations',
        tags: ['data-structure', 'built-in'],
        createdAt: 0,
        code: `// Array-indexed List
define LIST_MAX = 64;
int list_data[LIST_MAX];
int list_size = 0;

function list_add(value) {
    if(list_size >= LIST_MAX) return FALSE;
    list_data[list_size] = value;
    list_size = list_size + 1;
    return TRUE;
}

function list_remove_at(index) {
    if(index < 0 || index >= list_size) return;
    int i;
    for(i = index; i < list_size - 1; i++) {
        list_data[i] = list_data[i + 1];
    }
    list_size = list_size - 1;
}

function list_find(value) {
    int i;
    for(i = 0; i < list_size; i++) {
        if(list_data[i] == value) return i;
    }
    return -1;
}

function list_contains(value) {
    return list_find(value) >= 0;
}

function list_clear() {
    list_size = 0;
}`,
    },
    {
        id: 'builtin-memory-pool',
        name: 'Memory Pool',
        description: 'Fixed-size object pool with alloc/free operations',
        tags: ['data-structure', 'built-in'],
        createdAt: 0,
        code: `// Fixed-size Memory Pool
// Each "object" is FIELDS_PER_OBJ consecutive array elements
define POOL_SIZE = 16;
define FIELDS_PER_OBJ = 4;
int pool_data[POOL_SIZE * FIELDS_PER_OBJ];
int pool_used[POOL_SIZE]; // 0 = free, 1 = allocated

function pool_init() {
    int i;
    for(i = 0; i < POOL_SIZE; i++) pool_used[i] = 0;
}

// Returns index (0-based) or -1 if full
function pool_alloc() {
    int i;
    for(i = 0; i < POOL_SIZE; i++) {
        if(pool_used[i] == 0) {
            pool_used[i] = 1;
            return i;
        }
    }
    return -1;
}

function pool_free(index) {
    if(index >= 0 && index < POOL_SIZE) {
        pool_used[index] = 0;
    }
}

// Access: pool_data[index * FIELDS_PER_OBJ + fieldIdx]
function pool_set(index, field, value) {
    pool_data[index * FIELDS_PER_OBJ + field] = value;
}

function pool_get(index, field) {
    return pool_data[index * FIELDS_PER_OBJ + field];
}`,
    },
];

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

export function getAllSnippets(settings: AppSettings): Snippet[] {
    return [...BUILTIN_SNIPPETS, ...settings.snippets];
}

export function isBuiltinSnippet(id: string): boolean {
    return id.startsWith('builtin-');
}
