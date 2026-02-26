<script lang="ts">
	import type { GameSummary } from '$lib/types/config';

	interface Props {
		games: GameSummary[];
		grouped: Record<string, GameSummary[]>;
		types: string[];
		loading: boolean;
		error: string | null;
		onSelectGame: (game: GameSummary) => void;
		onDeleteGame: (e: MouseEvent, game: GameSummary) => void;
	}

	let { games, grouped, types, loading, error, onSelectGame, onDeleteGame }: Props = $props();

	let totalGames = $derived(games.length);
</script>

<div class="mx-auto max-w-2xl p-6">
	<div class="mb-8 text-center">
		<h1 class="text-3xl font-bold text-zinc-100">GPC IDE</h1>
		<p class="mt-2 text-zinc-400">Desktop IDE for Cronus Zen game scripts</p>
	</div>

	{#if loading}
		<div class="text-center text-zinc-500">Loading games...</div>
	{:else if error}
		<div class="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
			{error}
		</div>
	{:else}
		<div class="mb-8 grid grid-cols-3 gap-4">
			<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
				<div class="text-2xl font-bold text-emerald-400">{totalGames}</div>
				<div class="text-xs text-zinc-500 uppercase">Games</div>
			</div>
			<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
				<div class="text-2xl font-bold text-amber-400">{types.length}</div>
				<div class="text-xs text-zinc-500 uppercase">Types</div>
			</div>
			<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
				<div class="text-2xl font-bold text-blue-400">
					{games.reduce((sum, g) => sum + g.module_count, 0)}
				</div>
				<div class="text-xs text-zinc-500 uppercase">Total Menu Items</div>
			</div>
		</div>

		<div class="space-y-4">
			{#each types as type}
				<div>
					<h2 class="mb-2 text-sm font-semibold tracking-wider text-zinc-500 uppercase">
						{type}
					</h2>
					<div class="grid gap-2">
						{#each grouped[type] as game}
							<div
								class="group flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
							>
								<button
									class="flex min-w-0 flex-1 items-center justify-between gap-3"
									onclick={() => onSelectGame(game)}
								>
									<div class="min-w-0 text-left">
										<div class="truncate font-medium text-zinc-200">{game.name}</div>
										<div class="truncate text-xs text-zinc-500">{game.title}</div>
									</div>
									<div class="flex shrink-0 items-center gap-3">
										<span
											class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 uppercase"
										>
											{game.game_type}
										</span>
										<span class="text-sm text-zinc-500">{game.module_count} items</span>
									</div>
								</button>
								<button
									class="ml-2 shrink-0 rounded p-1.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-red-400"
									onclick={(e) => onDeleteGame(e, game)}
									title="Delete game"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
