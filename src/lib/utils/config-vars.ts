import type { GameConfig } from '$lib/types/config';

/**
 * Parse and replace variables in state screen text.
 * Supports: {version}, {filename}, {type}
 *
 * Example: "Game v{version}" with version=8 → "Game v8"
 */
export function parseStateScreenText(text: string, config: GameConfig): string {
	return text
		.replace(/{version}/g, String(config.version || 1))
		.replace(/{filename}/g, config.filename || '')
		.replace(/{type}/g, config.type || 'fps');
}
