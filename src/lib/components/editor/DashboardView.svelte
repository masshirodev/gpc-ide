<script lang="ts">
	import type { GameSummary } from '$lib/types/config';
	import * as m from '$lib/paraglide/messages.js';

	interface WorkspaceGroup {
		workspace: string;
		games: GameSummary[];
	}

	interface Props {
		games: GameSummary[];
		workspaceGrouped: WorkspaceGroup[];
		recent: GameSummary[];
		loading: boolean;
		error: string | null;
		onSelectGame: (game: GameSummary) => void;
		onDeleteGame: (e: MouseEvent, game: GameSummary) => void;
	}

	let { games, workspaceGrouped, recent, loading, error, onSelectGame, onDeleteGame }: Props =
		$props();

	let searchQuery = $state('');

	let filteredGroups = $derived.by(() => {
		if (!searchQuery.trim()) return workspaceGrouped;
		const q = searchQuery.toLowerCase();
		const result: WorkspaceGroup[] = [];
		for (const group of workspaceGrouped) {
			const filtered = group.games.filter(
				(g) =>
					g.name.toLowerCase().includes(q) ||
					g.title.toLowerCase().includes(q) ||
					g.game_type.toLowerCase().includes(q)
			);
			if (filtered.length > 0) result.push({ workspace: group.workspace, games: filtered });
		}
		return result;
	});

	function timeAgo(ms: number): string {
		if (!ms) return '';
		const diff = Date.now() - ms;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days}d ago`;
		return `${Math.floor(days / 30)}mo ago`;
	}
</script>

<div class="mx-auto max-w-3xl p-6">
	<!-- Hero -->
	<div class="mb-8 text-center">
		<h1 class="text-3xl font-bold text-zinc-100">GPC IDE</h1>
		<p class="mt-1 text-sm text-zinc-500">{m.dashboard_subtitle()}</p>

		<!-- Quick actions -->
		<div class="mt-5 flex justify-center gap-3">
			<a
				href="/wizard"
				class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				{m.dashboard_new_game()}
			</a>
			<a
				href="/tools/flow"
				class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
					/>
				</svg>
				{m.dashboard_flow_editor()}
			</a>
		</div>
	</div>

	{#if loading}
		<div class="text-center text-zinc-500">{m.dashboard_loading()}</div>
	{:else if error}
		<div class="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
			{error}
		</div>
	{:else if games.length === 0}
		<!-- Empty state -->
		<div class="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
			<svg
				class="mx-auto h-12 w-12 text-zinc-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
				/>
			</svg>
			<h3 class="mt-3 text-sm font-medium text-zinc-300">{m.dashboard_no_games_title()}</h3>
			<p class="mt-1 text-xs text-zinc-500">{m.dashboard_no_games_description()}</p>
			<a
				href="/wizard"
				class="mt-4 inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				{m.dashboard_create_game()}
			</a>
		</div>
	{:else}
		<!-- Recent games -->
		{#if recent.length > 0 && !searchQuery.trim()}
			<div class="mb-6">
				<h2
					class="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase"
				>
					{m.dashboard_recently_edited()}
				</h2>
				<div class="grid gap-1.5">
					{#each recent as game}
						<div
							class="group flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
						>
							<button
								class="flex min-w-0 flex-1 items-center justify-between gap-3"
								onclick={() => onSelectGame(game)}
							>
								<div class="min-w-0 text-left">
									<div class="truncate text-sm font-medium text-zinc-200">
										{game.name}
									</div>
									<div class="truncate text-xs text-zinc-500">
										{game.title}
										{#if game.updated_at}
											<span class="ml-1 text-zinc-600">&middot; {timeAgo(game.updated_at)}</span>
										{/if}
									</div>
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 uppercase">
										{game.game_type}
									</span>
									{#if game.generation_mode === 'flow'}
										<span
											class="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400"
										>
											flow
										</span>
									{:else}
										<span
											class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500"
										>
											config
										</span>
									{/if}
								</div>
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Search -->
		<div class="mb-4">
			<input
				type="text"
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
				placeholder={m.dashboard_search_placeholder()}
				bind:value={searchQuery}
			/>
		</div>

		<!-- Game list grouped by workspace -->
		<div class="space-y-5">
			{#each filteredGroups as group}
				<div>
					<h2
						class="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-600"
					>
						<svg
							class="h-3.5 w-3.5 shrink-0 text-zinc-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
							/>
						</svg>
						<span class="truncate">{group.workspace}</span>
						<span
							class="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-normal text-zinc-500"
						>
							{group.games.length}
						</span>
					</h2>
					<div class="grid gap-1.5">
						{#each group.games as game}
							<div
								class="group flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
							>
								<button
									class="flex min-w-0 flex-1 items-center justify-between gap-3"
									onclick={() => onSelectGame(game)}
								>
									<div class="min-w-0 text-left">
										<div class="truncate text-sm font-medium text-zinc-200">
											{game.name}
										</div>
										<div class="truncate text-xs text-zinc-500">{game.title}</div>
									</div>
									<div class="flex shrink-0 items-center gap-1.5">
										<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 uppercase">
											{game.game_type}
										</span>
										{#if game.generation_mode === 'flow'}
											<span
												class="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400"
											>
												flow
											</span>
										{:else}
											<span
												class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500"
											>
												config
											</span>
										{/if}
									</div>
								</button>
								<button
									class="ml-1.5 shrink-0 rounded p-1.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-red-400"
									onclick={(e) => onDeleteGame(e, game)}
									title={m.dashboard_delete_game()}
								>
									<svg
										class="h-3.5 w-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
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

			{#if filteredGroups.length === 0 && searchQuery.trim()}
				<div class="py-8 text-center text-sm text-zinc-500">
					{m.dashboard_no_matches({ query: searchQuery })}
				</div>
			{/if}
		</div>
	{/if}
</div>
