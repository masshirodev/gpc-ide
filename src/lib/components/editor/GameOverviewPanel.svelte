<script lang="ts">
	import type { GameConfig, GameSummary, GameMeta } from '$lib/types/config';
	import { saveGameMeta } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';

	interface Props {
		game: GameSummary;
		meta: GameMeta | null;
		config: GameConfig | null;
		onTagsChanged?: (tags: string[]) => void;
		onSaveAsTemplate?: () => void;
		onExportZip?: () => void;
	}

	let { game, meta, config, onTagsChanged, onSaveAsTemplate, onExportZip }: Props = $props();

	let isFlowGame = $derived(game.generation_mode === 'flow');

	// --- Tags editing ---
	let newTag = $state('');
	let tags = $state<string[]>([]);

	// Sync tags from meta/game when they change
	$effect(() => {
		tags = [...(meta?.tags ?? game.tags ?? [])];
	});

	async function addTag() {
		const tag = newTag.trim().toLowerCase();
		if (!tag || tags.includes(tag)) {
			newTag = '';
			return;
		}
		tags = [...tags, tag];
		newTag = '';
		await saveTags();
	}

	async function removeTag(tag: string) {
		tags = tags.filter(t => t !== tag);
		await saveTags();
	}

	async function saveTags() {
		if (!meta) return;
		try {
			await saveGameMeta(game.path, { ...meta, tags });
			onTagsChanged?.(tags);
		} catch (e) {
			addToast(`Failed to save tags: ${e}`, 'error');
		}
	}
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

<!-- Tags -->
<div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
	<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">Tags</h2>
	<div class="flex flex-wrap items-center gap-2">
		{#each tags as tag}
			<span class="group flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
				{tag}
				<button
					class="text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
					onclick={() => removeTag(tag)}
				>
					<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</span>
		{/each}
		<form
			class="flex items-center gap-1"
			onsubmit={(e) => { e.preventDefault(); addTag(); }}
		>
			<input
				class="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
				placeholder="Add tag..."
				bind:value={newTag}
			/>
			<button
				type="submit"
				class="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
				disabled={!newTag.trim()}
			>
				+
			</button>
		</form>
	</div>
</div>

<!-- Actions -->
<div class="mt-4 flex items-center gap-3">
	{#if onSaveAsTemplate}
		<button
			class="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
			onclick={onSaveAsTemplate}
		>
			Save as Template
		</button>
	{/if}
	{#if onExportZip}
		<button
			class="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
			onclick={onExportZip}
		>
			Export as Zip
		</button>
	{/if}
	<span class="flex-1 truncate text-xs text-zinc-600">{game.path}</span>
</div>
