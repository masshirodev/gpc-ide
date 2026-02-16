<script lang="ts">
	import { getGameStore } from '$lib/stores/game.svelte';
	import { getLspStore } from '$lib/stores/lsp.svelte';
	import { getDiagnosticsStore, getDiagnosticCounts } from '$lib/stores/diagnostics.svelte';
	import { setBottomPanelActiveTab, setBottomPanelOpen } from '$lib/stores/ui.svelte';

	let { isScriptView = false }: { isScriptView?: boolean } = $props();

	let store = getGameStore();
	let lspStore = getLspStore();
	let diagStore = getDiagnosticsStore();
	let counts = $derived(getDiagnosticCounts(diagStore.byUri));

	function openProblems() {
		setBottomPanelActiveTab('problems');
		setBottomPanelOpen(true);
	}
</script>

<footer class="flex h-6 items-center justify-between border-t border-zinc-700 bg-zinc-900 px-4 text-xs text-zinc-500">
	<div class="flex items-center gap-4">
		{#if store.selectedGame}
			<span>{store.selectedGame.name} - {store.selectedGame.title}</span>
			{#if store.selectedGame.game_type}
				<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs uppercase">{store.selectedGame.game_type}</span>
			{/if}
		{:else}
			<span>No game selected</span>
		{/if}

		{#if isScriptView}
			<button class="flex items-center gap-2" onclick={openProblems}>
				{#if counts.errors > 0}
					<span class="flex items-center gap-0.5 text-red-400">&#x2716; {counts.errors}</span>
				{/if}
				{#if counts.warnings > 0}
					<span class="flex items-center gap-0.5 text-amber-400">&#x26A0; {counts.warnings}</span>
				{/if}
				{#if counts.errors === 0 && counts.warnings === 0}
					<span class="flex items-center gap-0.5 text-zinc-600">&#x2714; 0</span>
				{/if}
			</button>
		{/if}
	</div>
	<div class="flex items-center gap-3">
		{#if lspStore.status === 'running'}
			<span class="flex items-center gap-1">
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
				<span class="text-zinc-400">GPC LSP</span>
			</span>
		{:else if lspStore.status === 'starting'}
			<span class="flex items-center gap-1">
				<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"></span>
				<span class="text-zinc-500">LSP Starting...</span>
			</span>
		{:else if lspStore.status === 'error'}
			<span class="flex items-center gap-1" title={lspStore.error ?? 'Unknown error'}>
				<span class="h-1.5 w-1.5 rounded-full bg-red-400"></span>
				<span class="text-red-400">LSP Error</span>
			</span>
		{/if}
		<span>GPC IDE v0.1.0</span>
	</div>
</footer>
