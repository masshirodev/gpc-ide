import type { GameConfig } from '$lib/types/config';

/** Normalize a string for filename use: keep alphanumeric, dash, underscore */
function normalizeForFilename(s: string): string {
	return s.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Resolve template variables in a config string.
 * Supports: {version}, {game}, {gameabbr}, {username}, {type}, {filename}
 *
 * Example: "{game}-v{version}" with name="R6S", version=8 → "R6S-v8"
 */
export function resolveConfigVars(text: string, config: GameConfig): string {
	const game = config.name || '';
	const gameabbr = normalizeForFilename(game);
	const username = config.username || '';

	return text
		.replace(/{version}/g, String(config.version || 1))
		.replace(/{game}/g, game)
		.replace(/{gameabbr}/g, gameabbr)
		.replace(/{username}/g, username)
		.replace(/{filename}/g, config.filename || '')
		.replace(/{type}/g, config.type || 'fps');
}

/** @deprecated Use resolveConfigVars instead */
export function parseStateScreenText(text: string, config: GameConfig): string {
	return resolveConfigVars(text, config);
}
