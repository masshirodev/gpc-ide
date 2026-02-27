/**
 * Keyboard shortcut customization store.
 *
 * Each action has a unique id, a human-friendly label, a default keybinding,
 * and an optional user-override persisted in localStorage.
 */

interface KeyBinding {
	id: string;
	label: string;
	/** Default combo, e.g. "Ctrl+S" */
	defaultKey: string;
	/** Category for grouping in the settings UI */
	category: string;
}

interface KeyBindingState {
	/** user overrides: actionId → combo string (e.g. "Ctrl+Shift+B") */
	overrides: Record<string, string>;
}

const STORAGE_KEY = 'gpc-ide-keybindings';

/** Registry of all known actions */
export const actions: KeyBinding[] = [
	{ id: 'save', label: 'Save File', defaultKey: 'Ctrl+S', category: 'Editor' },
	{ id: 'build', label: 'Build Game', defaultKey: 'Ctrl+B', category: 'Build' },
	{ id: 'toggleBottomPanel', label: 'Toggle Bottom Panel', defaultKey: 'Ctrl+J', category: 'UI' },
	{ id: 'globalSearch', label: 'Global Search', defaultKey: 'Ctrl+Shift+F', category: 'Search' },
	{ id: 'commandPalette', label: 'Command Palette', defaultKey: 'Ctrl+Shift+P', category: 'UI' }
];

function loadOverrides(): Record<string, string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch { /* ignore */ }
	return {};
}

function saveOverrides(overrides: Record<string, string>) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

let state = $state<KeyBindingState>({ overrides: loadOverrides() });

/** Get the effective key combo for an action */
export function getKeyCombo(actionId: string): string {
	if (state.overrides[actionId]) return state.overrides[actionId];
	const action = actions.find(a => a.id === actionId);
	return action?.defaultKey ?? '';
}

/** Set a custom override for an action */
export function setKeyCombo(actionId: string, combo: string) {
	state.overrides[actionId] = combo;
	saveOverrides(state.overrides);
}

/** Reset an action to its default */
export function resetKeyCombo(actionId: string) {
	delete state.overrides[actionId];
	state.overrides = { ...state.overrides }; // trigger reactivity
	saveOverrides(state.overrides);
}

/** Reset all overrides */
export function resetAllKeybindings() {
	state.overrides = {};
	saveOverrides(state.overrides);
}

/**
 * Parse a combo string like "Ctrl+Shift+F" and check if a KeyboardEvent matches it.
 */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
	if (!combo) return false;
	const parts = combo.split('+').map(p => p.trim().toLowerCase());

	const needCtrl = parts.includes('ctrl') || parts.includes('cmd');
	const needShift = parts.includes('shift');
	const needAlt = parts.includes('alt');

	// The actual key is the last non-modifier part
	const modifiers = new Set(['ctrl', 'cmd', 'shift', 'alt']);
	const keyPart = parts.find(p => !modifiers.has(p));
	if (!keyPart) return false;

	const ctrlMatch = (e.ctrlKey || e.metaKey) === needCtrl;
	const shiftMatch = e.shiftKey === needShift;
	const altMatch = e.altKey === needAlt;

	// Normalize the event key for comparison
	const eventKey = e.key.toLowerCase();

	return ctrlMatch && shiftMatch && altMatch && eventKey === keyPart;
}

/** Get the overrides record (reactive) */
export function getOverrides(): Record<string, string> {
	return state.overrides;
}

/**
 * Format a KeyboardEvent into a combo string like "Ctrl+Shift+F".
 * Useful for recording shortcuts in the settings UI.
 */
export function eventToCombo(e: KeyboardEvent): string | null {
	// Skip if only a modifier was pressed
	const modifierKeys = new Set(['Control', 'Shift', 'Alt', 'Meta']);
	if (modifierKeys.has(e.key)) return null;

	const parts: string[] = [];
	if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
	if (e.shiftKey) parts.push('Shift');
	if (e.altKey) parts.push('Alt');

	// Capitalize single characters, use key name for special keys
	let key = e.key;
	if (key.length === 1) {
		key = key.toUpperCase();
	}
	parts.push(key);

	return parts.join('+');
}
