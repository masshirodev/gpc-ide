<script lang="ts">
	import {
		getUiStore,
		setBottomPanelHeight,
		setBottomPanelActiveTab,
		setBottomPanelOpen,
		type BottomPanelTab
	} from '$lib/stores/ui.svelte';
	import { getDiagnosticsStore, getDiagnosticCounts } from '$lib/stores/diagnostics.svelte';
	import { clearLogs } from '$lib/stores/logs.svelte';
	import ProblemsPanel from './ProblemsPanel.svelte';
	import LogsPanel from './LogsPanel.svelte';

	let ui = getUiStore();
	let diagStore = getDiagnosticsStore();
	let counts = $derived(getDiagnosticCounts(diagStore.byUri));
	let dragging = $state(false);

	function onResizeStart(e: PointerEvent) {
		e.preventDefault();
		dragging = true;
		const startY = e.clientY;
		const startHeight = ui.bottomPanel.height;

		function onMove(e: PointerEvent) {
			const delta = startY - e.clientY;
			setBottomPanelHeight(startHeight + delta);
		}

		function onUp() {
			dragging = false;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	const tabs: { id: BottomPanelTab; label: string }[] = [
		{ id: 'problems', label: 'Problems' },
		{ id: 'logs', label: 'Logs' }
	];

	function tabLabel(tab: { id: BottomPanelTab; label: string }): string {
		if (tab.id === 'problems' && counts.total > 0) {
			return `${tab.label} (${counts.total})`;
		}
		return tab.label;
	}
</script>

{#if ui.bottomPanel.open}
	<div
		class="flex shrink-0 flex-col border-t border-zinc-700 bg-zinc-900"
		style:height="{ui.bottomPanel.height}px"
	>
		<!-- Resize handle -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-1 cursor-row-resize bg-zinc-800 transition-colors hover:bg-emerald-600 {dragging ? 'bg-emerald-600' : ''}"
			onpointerdown={onResizeStart}
		></div>

		<!-- Tab bar -->
		<div class="flex items-center border-b border-zinc-700 bg-zinc-900">
			{#each tabs as tab}
				<button
					class="border-b-2 px-3 py-1 text-xs font-medium transition-colors {ui.bottomPanel.activeTab === tab.id ? 'border-emerald-400 text-zinc-200' : 'border-transparent text-zinc-500 hover:text-zinc-400'}"
					onclick={() => setBottomPanelActiveTab(tab.id)}
				>
					{tabLabel(tab)}
				</button>
			{/each}
			<div class="flex-1"></div>

			<!-- Clear button (logs tab only) -->
			{#if ui.bottomPanel.activeTab === 'logs'}
				<button
					class="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
					onclick={clearLogs}
					title="Clear logs"
				>
					Clear
				</button>
			{/if}

			<!-- Close button -->
			<button
				class="px-2 py-1 text-zinc-500 hover:text-zinc-300"
				onclick={() => setBottomPanelOpen(false)}
				title="Close panel (Ctrl+J)"
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
					<path
						d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
					/>
				</svg>
			</button>
		</div>

		<!-- Tab content -->
		<div class="min-h-0 flex-1 overflow-hidden">
			{#if ui.bottomPanel.activeTab === 'problems'}
				<ProblemsPanel />
			{:else if ui.bottomPanel.activeTab === 'logs'}
				<LogsPanel />
			{/if}
		</div>
	</div>
{/if}
