<script lang="ts">
	import { getLogs, clearLogs } from '$lib/stores/logs.svelte';

	let { onClear }: { onClear?: () => void } = $props();

	let logs = getLogs();
	let container: HTMLDivElement | undefined = $state();

	$effect(() => {
		// Auto-scroll to bottom when new logs arrive
		if (logs.length && container) {
			container.scrollTop = container.scrollHeight;
		}
	});

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleTimeString('en-US', { hour12: false });
	}

	const levelColors: Record<string, string> = {
		info: 'text-blue-400',
		warn: 'text-amber-400',
		error: 'text-red-400',
		debug: 'text-zinc-500'
	};

	const sourceColors: Record<string, string> = {
		LSP: 'bg-emerald-900 text-emerald-300',
		Build: 'bg-blue-900 text-blue-300',
		App: 'bg-zinc-700 text-zinc-300'
	};
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto font-mono text-xs" bind:this={container}>
		{#if logs.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-zinc-500">
				No log entries
			</div>
		{:else}
			{#each logs as entry (entry.id)}
				<div class="flex items-start gap-2 px-3 py-0.5 hover:bg-zinc-800/30">
					<span class="shrink-0 text-zinc-600">{formatTime(entry.timestamp)}</span>
					<span
						class="shrink-0 rounded px-1 py-0 text-[10px] {sourceColors[entry.source] ?? 'bg-zinc-700 text-zinc-300'}"
						>{entry.source}</span
					>
					<span class="whitespace-pre-wrap break-all {levelColors[entry.level] ?? 'text-zinc-300'}"
						>{entry.message}</span
					>
				</div>
			{/each}
		{/if}
	</div>
</div>
