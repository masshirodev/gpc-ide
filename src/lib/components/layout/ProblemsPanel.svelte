<script lang="ts">
	import {
		getDiagnosticsStore,
		getDiagnosticCounts,
		getAllDiagnosticsGrouped
	} from '$lib/stores/diagnostics.svelte';
	import { requestFileNavigation } from '$lib/stores/ui.svelte';

	let store = getDiagnosticsStore();
	let grouped = $derived(getAllDiagnosticsGrouped(store.byUri));
	let counts = $derived(getDiagnosticCounts(store.byUri));

	let showErrors = $state(true);
	let showWarnings = $state(true);
	let showInfos = $state(true);

	let collapsedFiles = $state<Set<string>>(new Set());

	function toggleFile(uri: string) {
		const next = new Set(collapsedFiles);
		if (next.has(uri)) {
			next.delete(uri);
		} else {
			next.add(uri);
		}
		collapsedFiles = next;
	}

	function severityVisible(severity: number | undefined): boolean {
		const sev = severity ?? 1;
		if (sev === 1) return showErrors;
		if (sev === 2) return showWarnings;
		return showInfos;
	}

	function severityIcon(severity: number | undefined): { char: string; class: string } {
		const sev = severity ?? 1;
		if (sev === 1) return { char: '\u2716', class: 'text-red-400' };
		if (sev === 2) return { char: '\u26A0', class: 'text-amber-400' };
		return { char: '\u2139', class: 'text-blue-400' };
	}

	function basename(path: string): string {
		return path.split('/').pop() || path;
	}

	function handleClick(path: string, line: number, column: number) {
		requestFileNavigation(path, line + 1, column + 1);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Filter bar -->
	<div class="flex items-center gap-2 border-b border-zinc-700 px-3 py-1">
		<button
			class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {showErrors ? 'bg-zinc-700 text-red-400' : 'text-zinc-500 hover:text-zinc-400'}"
			onclick={() => (showErrors = !showErrors)}
		>
			<span>&#x2716;</span>
			{counts.errors}
		</button>
		<button
			class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {showWarnings ? 'bg-zinc-700 text-amber-400' : 'text-zinc-500 hover:text-zinc-400'}"
			onclick={() => (showWarnings = !showWarnings)}
		>
			<span>&#x26A0;</span>
			{counts.warnings}
		</button>
		<button
			class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {showInfos ? 'bg-zinc-700 text-blue-400' : 'text-zinc-500 hover:text-zinc-400'}"
			onclick={() => (showInfos = !showInfos)}
		>
			<span>&#x2139;</span>
			{counts.infos}
		</button>
	</div>

	<!-- Diagnostics list -->
	<div class="flex-1 overflow-y-auto">
		{#if grouped.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-zinc-500">
				No problems detected
			</div>
		{:else}
			{#each grouped as file}
				{@const visibleDiags = file.diagnostics.filter((d) => severityVisible(d.severity))}
				{#if visibleDiags.length > 0}
					<div>
						<!-- File header -->
						<button
							class="flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-zinc-800"
							onclick={() => toggleFile(file.uri)}
						>
							<svg
								class="h-3 w-3 shrink-0 text-zinc-500 transition-transform {collapsedFiles.has(file.uri) ? '' : 'rotate-90'}"
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
							<span class="ml-auto text-zinc-500">{visibleDiags.length}</span>
						</button>

						<!-- Diagnostics -->
						{#if !collapsedFiles.has(file.uri)}
							{#each visibleDiags as diag}
								{@const icon = severityIcon(diag.severity)}
								<button
									class="flex w-full items-center gap-2 py-0.5 pl-8 pr-3 text-left text-xs hover:bg-zinc-800/50"
									onclick={() =>
										handleClick(
											file.path,
											diag.range.start.line,
											diag.range.start.character
										)}
								>
									<span class={icon.class}>{icon.char}</span>
									<span class="flex-1 truncate text-zinc-300">{diag.message}</span>
									<span class="shrink-0 text-zinc-500"
										>[Ln {diag.range.start.line + 1}, Col {diag.range.start.character + 1}]</span
									>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			{/each}
		{/if}
	</div>
</div>
