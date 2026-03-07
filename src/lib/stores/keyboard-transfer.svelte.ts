import type { KeyMapping } from '$lib/utils/keyboard-parser';
import type { ConsoleType } from '$lib/utils/console-buttons';

export interface KeyboardTransfer {
	mappings: KeyMapping[];
	returnTo: string | null;
	outputConsole: ConsoleType;
	inputConsole: ConsoleType;
	/** Route to navigate back to (e.g. '/tools/flow') */
	returnPath?: string;
	/** Flow node ID to update when returning from mapper */
	nodeId?: string;
}

const STORAGE_KEY = 'keyboard-transfer';

export function getKeyboardTransfer(): KeyboardTransfer | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as KeyboardTransfer;
	} catch {
		return null;
	}
}

export function setKeyboardTransfer(data: KeyboardTransfer): void {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearKeyboardTransfer(): void {
	sessionStorage.removeItem(STORAGE_KEY);
}
