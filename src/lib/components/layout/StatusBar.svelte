<script lang="ts">
	import { getGameStore } from '$lib/stores/game.svelte';
	import { getLspStore } from '$lib/stores/lsp.svelte';
	import { getDiagnosticsStore, getDiagnosticCounts } from '$lib/stores/diagnostics.svelte';
	import { setBottomPanelActiveTab, setBottomPanelOpen } from '$lib/stores/ui.svelte';
	import { getVersion } from '@tauri-apps/api/app';
	import { getUnreadCount } from '$lib/stores/toast.svelte';

	interface Props {
		isScriptView?: boolean;
		onToggleNotifications?: () => void;
	}

	let { isScriptView = false, onToggleNotifications }: Props = $props();

	let appVersion = $state('');
	getVersion().then((v) => (appVersion = v));

	let store = getGameStore();
	let lspStore = getLspStore();
	let diagStore = getDiagnosticsStore();
	let counts = $derived(getDiagnosticCounts(diagStore.byUri));
	let unread = $derived(getUnreadCount());

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
		{#if onToggleNotifications}
			<button class="relative flex items-center p-0.5 hover:text-zinc-300" onclick={onToggleNotifications} title="Notifications">
				<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
					<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
				</svg>
				{#if unread > 0}
					<span class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
				{/if}
			</button>
		{/if}
		<span>GPC IDE {appVersion ? `v${appVersion}` : ''}</span>
	</div>
</footer>
