<script lang="ts">
	import type { GameConfig, GameSummary, GameMeta } from '$lib/types/config';

	interface Props {
		game: GameSummary;
		meta: GameMeta | null;
		config: GameConfig | null;
	}

	let { game, meta, config }: Props = $props();

	let isFlowGame = $derived(game.generation_mode === 'flow');
</script>

{#if isFlowGame && meta}
	<!-- Flow-based game overview -->
	<div class="grid grid-cols-2 gap-4">
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
				Game Metadata
			</h2>
			<div class="space-y-2">
				<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
					<span class="text-sm text-zinc-400">Name</span>
					<span class="text-sm text-zinc-200">{meta.name}</span>
				</div>
				<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
					<span class="text-sm text-zinc-400">Game Type</span>
					<span class="rounded bg-emerald-900/50 px-1.5 py-0.5 text-xs font-medium text-emerald-400 uppercase">{meta.game_type}</span>
				</div>
				<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
					<span class="text-sm text-zinc-400">Console</span>
					<span class="text-sm text-zinc-200 uppercase">{meta.console_type}</span>
				</div>
				<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
					<span class="text-sm text-zinc-400">Version</span>
					<span class="text-sm text-zinc-200">{meta.version}</span>
				</div>
				{#if meta.username}
					<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
						<span class="text-sm text-zinc-400">Username</span>
						<span class="text-sm text-zinc-200">{meta.username}</span>
					</div>
				{/if}
				<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
					<span class="text-sm text-zinc-400">Filename Template</span>
					<code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">{meta.filename}</code>
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
				Generation
			</h2>
			<div class="space-y-3">
				<div class="rounded bg-zinc-800/50 px-3 py-2">
					<span class="text-sm text-zinc-400">Mode</span>
					<span class="ml-2 rounded bg-blue-900/50 px-1.5 py-0.5 text-xs font-medium text-blue-400">Flow Editor</span>
				</div>
				<p class="text-xs text-zinc-500">
					This game uses the flow editor to generate code. Open the Flow tab to edit the game logic.
				</p>
			</div>
		</div>
	</div>
{:else if config}
	<!-- Legacy config-based game overview (read-only) -->
	<div class="mb-3 rounded border border-amber-800/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-400">
		This is a legacy config-based game. Config editing is read-only. Use the Files tab to view and edit files directly.
	</div>
	<div class="grid grid-cols-2 gap-4">
		<!-- Menu Items (read-only) -->
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
				Menu Items ({config.menu.length})
			</h2>
			<div class="space-y-2">
				{#each config.menu as item}
					<div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
						<span class="text-sm text-zinc-200">{item.name}</span>
						<span class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
							{item.type}
						</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Button Mappings (read-only) -->
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
			<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
				Button Mappings
			</h2>
			<div class="space-y-1.5">
				{#each Object.entries(config.buttons) as [key, value]}
					<div class="flex items-center justify-between rounded px-2 py-1 text-sm">
						<span class="text-zinc-400">{key.replace(/_/g, ' ')}</span>
						<code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">{value}</code>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- File Path -->
<div
	class="mt-4 rounded border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500"
>
	{game.path}
</div>
