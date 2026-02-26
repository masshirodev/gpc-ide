<script lang="ts">
	import type { FileDiff } from '$lib/tauri/commands';
	import { computeLineDiff } from '$lib/utils/editor-helpers';

	interface Props {
		diff: FileDiff | null;
		regenerating: boolean;
		regenFileLoading: boolean;
		onCancel: () => void;
		onCommit: () => void;
	}

	let { diff, regenerating, regenFileLoading, onCancel, onCommit }: Props = $props();

	let diffLines = $derived(
		diff
			? computeLineDiff(diff.old_content.split('\n'), diff.new_content.split('\n'))
			: []
	);
</script>

{#if diff}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onmousedown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
		onkeydown={(e) => { if (e.key === 'Escape') onCancel(); }}
	>
		<div class="flex max-h-[80vh] w-[800px] max-w-[90vw] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-zinc-200">
					Regenerate: {diff.path.split('/').pop()}
				</h2>
				<button
					class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					onclick={onCancel}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Diff Content -->
			<div class="flex-1 overflow-auto">
				<div class="bg-zinc-950 p-0 font-mono text-xs">
					<table class="w-full border-collapse">
						{#each diffLines as line}
							<tr class={line.type === 'removed' ? 'bg-red-950/40' : line.type === 'added' ? 'bg-emerald-950/40' : ''}>
								<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
									{line.oldNum ?? ''}
								</td>
								<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
									{line.newNum ?? ''}
								</td>
								<td class="select-none px-1 py-0 {line.type === 'removed' ? 'text-red-500' : line.type === 'added' ? 'text-emerald-500' : 'text-zinc-700'}" style="width: 1rem">
									{line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
								</td>
								<td class="whitespace-pre py-0 pr-4 {line.type === 'removed' ? 'text-red-300/80' : line.type === 'added' ? 'text-emerald-300/80' : 'text-zinc-400'}">
									{line.text}
								</td>
							</tr>
						{/each}
					</table>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
				<button
					class="rounded bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
					onclick={onCancel}
				>
					Cancel
				</button>
				<button
					class="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					onclick={onCommit}
					disabled={regenerating}
				>
					{regenerating ? 'Committing...' : 'Commit'}
				</button>
			</div>
		</div>
	</div>
{/if}
