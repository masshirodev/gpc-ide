<script lang="ts">
	import type { FlowChunk, FlowNodeType } from '$lib/types/flow';
	import { createFlowNode } from '$lib/types/flow';
	import { BUILTIN_CHUNKS, getChunksByCategory } from '$lib/flow/chunks';
	import { listChunks } from '$lib/tauri/commands';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { onMount } from 'svelte';

	interface Props {
		onInsertChunk: (chunk: FlowChunk) => void;
	}

	let { onInsertChunk }: Props = $props();

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);
	let userChunks = $state<FlowChunk[]>([]);
	let search = $state('');
	let expandedCategories = $state<Set<string>>(new Set(['intro', 'menu', 'home', 'screensaver']));

	onMount(async () => {
		try {
			userChunks = await listChunks(settings.workspaces);
		} catch {
			// No chunks yet
		}
	});

	let allChunks = $derived([...BUILTIN_CHUNKS, ...userChunks]);

	let filteredChunks = $derived.by(() => {
		if (!search.trim()) return allChunks;
		const q = search.toLowerCase();
		return allChunks.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.tags.some((t) => t.toLowerCase().includes(q))
		);
	});

	let grouped = $derived(getChunksByCategory(filteredChunks));
	let categories = $derived(Object.keys(grouped).sort());

	function toggleCategory(cat: string) {
		const next = new Set(expandedCategories);
		if (next.has(cat)) next.delete(cat);
		else next.add(cat);
		expandedCategories = next;
	}

	const categoryLabels: Record<string, string> = {
		intro: 'Intro / Splash',
		menu: 'Menu Pages',
		home: 'Home / Status',
		screensaver: 'Screensaver',
		utility: 'Utility',
		uncategorized: 'Other',
	};
</script>

<div class="flex h-full w-56 flex-col border-r border-zinc-800 bg-zinc-900">
	<div class="border-b border-zinc-800 px-3 py-2">
		<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Chunks</h3>
	</div>

	<!-- Search -->
	<div class="px-2 py-2">
		<input
			type="text"
			class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
			placeholder="Search chunks..."
			bind:value={search}
		/>
	</div>

	<!-- Category list -->
	<div class="flex-1 overflow-y-auto px-2">
		{#each categories as cat}
			<div class="mb-1">
				<button
					class="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
					onclick={() => toggleCategory(cat)}
				>
					<svg
						class="h-3 w-3 transition-transform {expandedCategories.has(cat) ? 'rotate-90' : ''}"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
					</svg>
					{categoryLabels[cat] || cat}
					<span class="ml-auto text-zinc-600">{grouped[cat].length}</span>
				</button>
				{#if expandedCategories.has(cat)}
					<div class="ml-2 space-y-0.5">
						{#each grouped[cat] as chunk}
							<button
								class="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-zinc-800"
								onclick={() => onInsertChunk(chunk)}
								title={chunk.description}
							>
								<span class="text-xs text-zinc-300">{chunk.name}</span>
								<span class="line-clamp-1 text-[10px] text-zinc-600">{chunk.description}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if filteredChunks.length === 0}
			<p class="px-2 py-4 text-center text-xs text-zinc-600">
				{search ? 'No chunks match your search' : 'No chunks available'}
			</p>
		{/if}
	</div>
</div>
