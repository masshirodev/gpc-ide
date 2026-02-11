import type { GameSummary, GameConfig } from '$lib/types/config';
import { listGames, getGameConfig } from '$lib/tauri/commands';

interface GameStore {
	games: GameSummary[];
	selectedGame: GameSummary | null;
	selectedConfig: GameConfig | null;
	loading: boolean;
	error: string | null;
}

let store = $state<GameStore>({
	games: [],
	selectedGame: null,
	selectedConfig: null,
	loading: false,
	error: null
});

export function getGameStore() {
	return store;
}

export async function loadGames(workspacePaths?: string[]) {
	store.loading = true;
	store.error = null;
	try {
		store.games = await listGames(workspacePaths);
	} catch (e) {
		store.error = e instanceof Error ? e.message : String(e);
	} finally {
		store.loading = false;
	}
}

export async function selectGame(game: GameSummary) {
	store.error = null;
	store.selectedGame = game;
	store.selectedConfig = null;
	try {
		store.selectedConfig = await getGameConfig(game.path);
	} catch (e) {
		store.error = e instanceof Error ? e.message : String(e);
	}
}

export function clearSelection() {
	store.selectedGame = null;
	store.selectedConfig = null;
}

/** Group games by type (fps, tps, fgs) */
export function gamesByType(games: GameSummary[]): Record<string, GameSummary[]> {
	const grouped: Record<string, GameSummary[]> = {};
	for (const game of games) {
		const type = game.game_type.toUpperCase();
		if (!grouped[type]) grouped[type] = [];
		grouped[type].push(game);
	}
	return grouped;
}
