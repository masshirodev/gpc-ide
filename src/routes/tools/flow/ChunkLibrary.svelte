<script lang="ts">
	import type { FlowChunk, FlowNodeType, FlowType } from '$lib/types/flow';
	import { createFlowNode } from '$lib/types/flow';
	import { BUILTIN_CHUNKS, getChunksByCategory } from '$lib/flow/chunks';
	import { listChunks } from '$lib/tauri/commands';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { onMount } from 'svelte';
	import type { ModuleSummary } from '$lib/types/module';

	interface Props {
		flowType: FlowType;
		onInsertChunk: (chunk: FlowChunk) => void;
		availableModules: ModuleSummary[];
		onAddModule: (moduleId: string) => void;
	}

	let { flowType, onInsertChunk, availableModules, onAddModule }: Props = $props();

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);
	let userChunks = $state<FlowChunk[]>([]);
	let search = $state('');
	let expandedCategories = $state<Set<string>>(new Set(['intro', 'menu', 'home', 'screensaver', 'utility', 'code', 'modules']));

	onMount(async () => {
		try {
			userChunks = await listChunks(settings.workspaces);
		} catch {
			// No chunks yet
		}
	});

	let allChunks = $derived([...BUILTIN_CHUNKS, ...userChunks]);

	// Filter chunks by flow type — chunks without explicit flowType default to 'menu'
	let flowFilteredChunks = $derived.by(() => {
		return allChunks.filter((c) => {
			const chunkFlow = c.flowType ?? 'menu';
			return chunkFlow === flowType;
		});
	});

	let filteredChunks = $derived.by(() => {
		if (!search.trim()) return flowFilteredChunks;
		const q = search.toLowerCase();
		return flowFilteredChunks.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.tags.some((t) => t.toLowerCase().includes(q))
		);
	});

	// Filter modules by search too
	let filteredModules = $derived.by(() => {
		if (!search.trim()) return availableModules;
		const q = search.toLowerCase();
		return availableModules.filter(
			(m) =>
				m.display_name.toLowerCase().includes(q) ||
				m.id.toLowerCase().includes(q) ||
				(m.description ?? '').toLowerCase().includes(q)
		);
	});

	let grouped = $derived(getChunksByCategory(filteredChunks));
	let categories = $derived(Object.keys(grouped).sort());

	let hasChunks = $derived(filteredChunks.length > 0);
	let hasModules = $derived(flowType === 'gameplay' && filteredModules.length > 0);

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
		code: 'Code Snippets',
		utility: 'Utility',
		uncategorized: 'Other',
	};
</script>

<div class="flex h-full w-56 flex-col border-r border-zinc-800 bg-zinc-900">
	<div class="border-b border-zinc-800 px-3 py-2">
		<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">
			{flowType === 'gameplay' ? 'Modules & Chunks' : 'Chunks'}
		</h3>
	</div>

	<!-- Search -->
	<div class="px-2 py-2">
		<input
			type="text"
			class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
			placeholder={flowType === 'gameplay' ? 'Search modules & chunks...' : 'Search chunks...'}
			bind:value={search}
		/>
	</div>

	<div class="flex-1 overflow-y-auto px-2">
		<!-- Modules section (gameplay flow only) -->
		{#if flowType === 'gameplay'}
			<div class="mb-1">
				<button
					class="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-medium text-red-400 hover:bg-zinc-800 hover:text-red-300"
					onclick={() => toggleCategory('modules')}
				>
					<svg
						class="h-3 w-3 transition-transform {expandedCategories.has('modules') ? 'rotate-90' : ''}"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
					</svg>
					Modules
					<span class="ml-auto text-zinc-600">{filteredModules.length}</span>
				</button>
				{#if expandedCategories.has('modules')}
					<div class="ml-2 space-y-0.5">
						{#each filteredModules as mod}
							<button
								class="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-zinc-800"
								onclick={() => onAddModule(mod.id)}
								title={mod.description || mod.display_name}
							>
								<span class="flex items-center gap-1.5 text-xs text-zinc-300">
									<span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500"></span>
									{mod.display_name}
								</span>
								{#if mod.description}
									<span class="line-clamp-1 pl-3 text-[10px] text-zinc-600">{mod.description}</span>
								{/if}
							</button>
						{/each}
						{#if filteredModules.length === 0}
							<p class="px-2 py-2 text-[10px] text-zinc-600">No modules found</p>
						{/if}
					</div>
				{/if}
			</div>

			{#if hasChunks}
				<div class="my-1.5 border-t border-zinc-800"></div>
			{/if}
		{/if}

		<!-- Chunk categories -->
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
								{#if chunk.creator}
									<span class="text-[10px] text-zinc-700">By {chunk.creator}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if !hasChunks && !hasModules}
			<p class="px-2 py-4 text-center text-xs text-zinc-600">
				{search ? 'No results match your search' : 'No items available'}
			</p>
		{/if}
	</div>
</div>
