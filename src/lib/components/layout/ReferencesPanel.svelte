<script lang="ts">
	import {
		getReferencesStore,
		getReferencesGrouped,
		type ReferencesGrouped
	} from '$lib/stores/references.svelte';
	import { requestFileNavigation } from '$lib/stores/ui.svelte';

	let store = getReferencesStore();
	let grouped: ReferencesGrouped[] = $derived(getReferencesGrouped());

	let collapsedFiles = $state<Set<string>>(new Set());

	function toggleFile(path: string) {
		const next = new Set(collapsedFiles);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		collapsedFiles = next;
	}

	function basename(path: string): string {
		return path.split('/').pop() || path;
	}

	function handleClick(path: string, line: number, column: number) {
		requestFileNavigation(path, line, column);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	{#if store.symbol}
		<div class="flex items-center gap-2 border-b border-zinc-700 px-3 py-1">
			<span class="text-xs text-zinc-400">Symbol:</span>
			<span class="text-xs font-medium text-zinc-200">{store.symbol}</span>
		</div>
	{/if}

	<!-- References list -->
	<div class="flex-1 overflow-y-auto select-text">
		{#if grouped.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-zinc-500">
				No references to show
			</div>
		{:else}
			{#each grouped as file}
				<div>
					<!-- File header -->
					<button
						class="flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-zinc-800"
						onclick={() => toggleFile(file.path)}
					>
						<svg
							class="h-3 w-3 shrink-0 text-zinc-500 transition-transform {collapsedFiles.has(
								file.path
							)
								? ''
								: 'rotate-90'}"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
								clip-rule="evenodd"
							/>
						</svg>
						<span class="font-medium text-zinc-200">{basename(file.path)}</span>
						<span class="text-zinc-500">{file.path}</span>
						<span class="ml-auto text-zinc-500">{file.items.length}</span>
					</button>

					<!-- Entries -->
					{#if !collapsedFiles.has(file.path)}
						{#each file.items as item}
							<button
								class="flex w-full items-center gap-2 py-0.5 pr-3 pl-8 text-left text-xs hover:bg-zinc-800/50"
								onclick={() =>
									handleClick(item.location.path, item.location.line, item.location.column)}
							>
								{#if item.isDefinition}
									<span
										class="shrink-0 rounded bg-emerald-900/50 px-1 py-0.5 text-[10px] font-bold text-emerald-400"
										>DEF</span
									>
								{:else}
									<span
										class="shrink-0 rounded bg-zinc-700/50 px-1 py-0.5 text-[10px] font-bold text-zinc-400"
										>REF</span
									>
								{/if}
								<span class="flex-1 truncate text-zinc-300">{item.location.linePreview}</span>
								<span class="shrink-0 text-zinc-500"
									>[Ln {item.location.line}, Col {item.location.column}]</span
								>
							</button>
						{/each}
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
