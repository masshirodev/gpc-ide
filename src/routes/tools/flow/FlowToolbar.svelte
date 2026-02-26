<script lang="ts">
	import type { FlowNodeType, FlowType } from '$lib/types/flow';
	import { NODE_LABELS } from '$lib/types/flow';
	import type { ModuleSummary } from '$lib/types/module';

	interface Props {
		onAddNode: (type: FlowNodeType) => void;
		onAddModule: (moduleId: string) => void;
		onDeleteSelected: () => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onZoomFit: () => void;
		onUndo: () => void;
		onRedo: () => void;
		onSave: () => void;
		onBuildToGame: () => Promise<void>;
		onNewGraph: () => void;
		onLoadGraph: () => void;
		onEmulator: () => void;
		canUndo: boolean;
		canRedo: boolean;
		hasSelection: boolean;
		dirty: boolean;
		building: boolean;
		graphName: string;
		flowType: FlowType;
		availableModules: ModuleSummary[];
	}

	let {
		onAddNode,
		onAddModule,
		onDeleteSelected,
		onZoomIn,
		onZoomOut,
		onZoomFit,
		onUndo,
		onRedo,
		onSave,
		onBuildToGame,
		onNewGraph,
		onLoadGraph,
		onEmulator,
		canUndo,
		canRedo,
		hasSelection,
		dirty,
		building,
		graphName,
		flowType,
		availableModules,
	}: Props = $props();

	let showAddMenu = $state(false);

	const menuNodeTypes: FlowNodeType[] = ['intro', 'home', 'menu', 'submenu', 'custom', 'screensaver'];
</script>

<div class="flex items-center gap-1 border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
	<!-- Graph name -->
	<span class="mr-2 text-sm font-medium text-zinc-200">
		{graphName || 'Untitled Flow'}
		{#if dirty}<span class="text-amber-400">*</span>{/if}
	</span>

	<div class="mx-2 h-5 w-px bg-zinc-700"></div>

	<!-- Add Node -->
	<div class="relative">
		<button
			class="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
			onclick={() => (showAddMenu = !showAddMenu)}
			title="Add node"
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
			</svg>
			{flowType === 'gameplay' ? 'Add Module' : 'Add Node'}
		</button>
		{#if showAddMenu}
			<button class="fixed inset-0 z-40" onclick={() => (showAddMenu = false)}></button>
			<div class="absolute left-0 top-full z-50 mt-1 max-h-72 w-48 overflow-y-auto rounded border border-zinc-700 bg-zinc-800 py-1 shadow-lg">
				{#if flowType === 'gameplay'}
					{#if availableModules.length > 0}
						{#each availableModules as mod}
							<button
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700"
								onclick={() => {
									onAddModule(mod.id);
									showAddMenu = false;
								}}
								title={mod.description || ''}
							>
								<span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
								{mod.display_name}
							</button>
						{/each}
					{:else}
						<div class="px-3 py-2 text-xs text-zinc-500">No modules available</div>
					{/if}
					<div class="my-1 border-t border-zinc-700"></div>
					<button
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700"
						onclick={() => {
							onAddNode('custom');
							showAddMenu = false;
						}}
					>
						{NODE_LABELS['custom']}
					</button>
				{:else}
					{#each menuNodeTypes as type}
						<button
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700"
							onclick={() => {
								onAddNode(type);
								showAddMenu = false;
							}}
						>
							{NODE_LABELS[type]}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Delete -->
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
		disabled={!hasSelection}
		onclick={onDeleteSelected}
		title="Delete selected (Del)"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
		</svg>
	</button>

	<div class="mx-2 h-5 w-px bg-zinc-700"></div>

	<!-- Undo / Redo -->
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
		disabled={!canUndo}
		onclick={onUndo}
		title="Undo (Ctrl+Z)"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6" />
		</svg>
	</button>
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
		disabled={!canRedo}
		onclick={onRedo}
		title="Redo (Ctrl+Shift+Z)"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2m15-7l-6 6m6-6l-6-6" />
		</svg>
	</button>

	<div class="mx-2 h-5 w-px bg-zinc-700"></div>

	<!-- Zoom -->
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
		onclick={onZoomIn}
		title="Zoom in"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
		</svg>
	</button>
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
		onclick={onZoomOut}
		title="Zoom out"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
		</svg>
	</button>
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
		onclick={onZoomFit}
		title="Zoom to fit"
	>
		<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
			<path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13 0a1 1 0 012 0v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15.586 13V12z" />
		</svg>
	</button>

	<div class="flex-1"></div>

	<!-- File operations -->
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
		onclick={onNewGraph}
		title="New flow graph"
	>
		New
	</button>
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
		onclick={onLoadGraph}
		title="Load flow graph"
	>
		Load
	</button>
	<button
		class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
		onclick={onSave}
		title="Save (Ctrl+S)"
	>
		Save
	</button>
	{#if flowType === 'menu'}
		<button
			class="rounded border border-amber-700 bg-amber-900 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-800"
			onclick={onEmulator}
			title="Open OLED emulator"
		>
			Emulator
		</button>
	{/if}
	<button
		class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
		disabled={building}
		onclick={() => onBuildToGame()}
		title="Write flow code to main.gpc and build"
	>
		{building ? 'Building...' : 'Build to Game'}
	</button>
</div>
