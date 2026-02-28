import type { GameSummary, GameConfig, GameMeta } from '$lib/types/config';
import { listGames, getGameConfig, loadGameMeta } from '$lib/tauri/commands';

interface GameStore {
	games: GameSummary[];
	selectedGame: GameSummary | null;
	/** Game metadata from game.json (flow-based games) */
	selectedMeta: GameMeta | null;
	/** Legacy config from config.toml (config-based games, read-only) */
	selectedConfig: GameConfig | null;
	loading: boolean;
	error: string | null;
}

let store = $state<GameStore>({
	games: [],
	selectedGame: null,
	selectedMeta: null,
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
		// Keep selectedGame in sync with refreshed game list
		if (store.selectedGame) {
			const updated = store.games.find((g) => g.path === store.selectedGame!.path);
			if (updated) {
				store.selectedGame = updated;
			}
		}
	} catch (e) {
		store.error = e instanceof Error ? e.message : String(e);
	} finally {
		store.loading = false;
	}
}

export async function selectGame(game: GameSummary) {
	store.error = null;
	store.selectedGame = game;
	// Keep previous meta/config visible until the new one loads to avoid dashboard flash
	try {
		if (game.generation_mode === 'flow') {
			const meta = await loadGameMeta(game.path);
			store.selectedMeta = meta;
			store.selectedConfig = null;
		} else {
			// Legacy config-based game (read-only support)
			const config = await getGameConfig(game.path);
			store.selectedConfig = config;
			store.selectedMeta = null;
		}
	} catch (e) {
		store.selectedMeta = null;
		store.selectedConfig = null;
		store.error = e instanceof Error ? e.message : String(e);
	}
}

export function clearSelection() {
	store.selectedGame = null;
	store.selectedMeta = null;
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

/** Group games by workspace path */
export function gamesByWorkspace(
	games: GameSummary[],
	workspaces: string[]
): { workspace: string; games: GameSummary[] }[] {
	const groups: Map<string, GameSummary[]> = new Map();
	for (const game of games) {
		const ws = workspaces.find((w) => game.path.startsWith(w)) ?? 'Other';
		if (!groups.has(ws)) groups.set(ws, []);
		groups.get(ws)!.push(game);
	}
	// Sort each group by name
	const result: { workspace: string; games: GameSummary[] }[] = [];
	for (const [workspace, list] of groups) {
		list.sort((a, b) => a.name.localeCompare(b.name));
		result.push({ workspace, games: list });
	}
	return result;
}

/** Get N most recently edited games */
export function recentGames(games: GameSummary[], count: number): GameSummary[] {
	return [...games].sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0)).slice(0, count);
}
