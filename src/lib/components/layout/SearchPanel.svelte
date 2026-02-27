<script lang="ts">
	import {
		getSearchStore,
		performSearch,
		setSearchQuery,
		setSearchReplacement,
		setSearchCaseSensitive,
		setSearchUseRegex,
		removeFileFromResults
	} from '$lib/stores/search.svelte';
	import { replaceInFile } from '$lib/tauri/commands';
	import { requestFileNavigation } from '$lib/stores/ui.svelte';
	import { getGameStore } from '$lib/stores/game.svelte';
	import { addToast } from '$lib/stores/toast.svelte';

	let search = getSearchStore();
	let gameStore = getGameStore();
	let collapsedFiles = $state<Set<string>>(new Set());
	let searchInput: HTMLInputElement | undefined = $state();

	function toggleFile(path: string) {
		const next = new Set(collapsedFiles);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		collapsedFiles = next;
	}

	function handleSearch() {
		if (!gameStore.selectedGame) return;
		performSearch(gameStore.selectedGame.path);
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSearch();
		}
	}

	function handleClick(path: string, line: number, col: number) {
		requestFileNavigation(path, line, col);
	}

	async function handleReplaceAllInFile(path: string) {
		if (!search.replacement && search.replacement !== '') return;
		try {
			const count = await replaceInFile(
				path,
				search.query,
				search.replacement,
				search.caseSensitive,
				search.useRegex
			);
			if (count > 0) {
				addToast(`Replaced ${count} occurrence${count === 1 ? '' : 's'} in ${basename(path)}`, 'success');
				removeFileFromResults(path);
			}
		} catch (e) {
			addToast(`Replace failed: ${e}`, 'error');
		}
	}

	async function handleReplaceAll() {
		if (!gameStore.selectedGame) return;
		let totalCount = 0;
		const paths = search.results.map((f) => f.path);
		for (const path of paths) {
			try {
				const count = await replaceInFile(
					path,
					search.query,
					search.replacement,
					search.caseSensitive,
					search.useRegex
				);
				totalCount += count;
				if (count > 0) {
					removeFileFromResults(path);
				}
			} catch (e) {
				addToast(`Replace failed in ${basename(path)}: ${e}`, 'error');
			}
		}
		if (totalCount > 0) {
			addToast(`Replaced ${totalCount} occurrence${totalCount === 1 ? '' : 's'} across files`, 'success');
		}
	}

	function basename(path: string): string {
		return path.split('/').pop() || path;
	}

	export function focusSearchInput() {
		searchInput?.focus();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Search inputs -->
	<div class="space-y-1 border-b border-zinc-700 px-3 py-2">
		<div class="flex items-center gap-1">
			<input
				bind:this={searchInput}
				type="text"
				placeholder="Search"
				class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-600 focus:outline-none"
				value={search.query}
				oninput={(e) => setSearchQuery(e.currentTarget.value)}
				onkeydown={handleSearchKeydown}
			/>
			<button
				class="rounded px-1.5 py-1 text-xs font-mono {search.caseSensitive ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-500 hover:text-zinc-400'}"
				onclick={() => setSearchCaseSensitive(!search.caseSensitive)}
				title="Match Case"
			>Aa</button>
			<button
				class="rounded px-1.5 py-1 text-xs font-mono {search.useRegex ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-500 hover:text-zinc-400'}"
				onclick={() => setSearchUseRegex(!search.useRegex)}
				title="Use Regular Expression"
			>.*</button>
		</div>
		<div class="flex items-center gap-1">
			<input
				type="text"
				placeholder="Replace"
				class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-600 focus:outline-none"
				value={search.replacement}
				oninput={(e) => setSearchReplacement(e.currentTarget.value)}
			/>
			{#if search.results.length > 0}
				<button
					class="rounded border border-zinc-700 px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
					onclick={handleReplaceAll}
					title="Replace All"
				>
					Replace All
				</button>
			{/if}
		</div>
	</div>

	<!-- Results -->
	<div class="flex-1 overflow-y-auto select-text">
		{#if search.searching}
			<div class="flex h-full items-center justify-center text-sm text-zinc-500">
				Searching...
			</div>
		{:else if search.query && search.results.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-zinc-500">
				No results found
			</div>
		{:else if search.results.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-zinc-500">
				Search across files in the script folder
			</div>
		{:else}
			<div class="px-1 py-1 text-xs text-zinc-500">
				{search.totalMatches} result{search.totalMatches === 1 ? '' : 's'} in {search.results.length} file{search.results.length === 1 ? '' : 's'}
			</div>
			{#each search.results as file}
				<div>
					<!-- File header -->
					<div class="flex items-center">
						<button
							class="flex flex-1 items-center gap-2 px-3 py-1 text-left text-xs hover:bg-zinc-800"
							onclick={() => toggleFile(file.path)}
						>
							<svg
								class="h-3 w-3 shrink-0 text-zinc-500 transition-transform {collapsedFiles.has(file.path) ? '' : 'rotate-90'}"
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
							<span class="text-zinc-500">{file.matches.length}</span>
						</button>
						{#if search.replacement !== undefined}
							<button
								class="mr-2 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
								onclick={() => handleReplaceAllInFile(file.path)}
								title="Replace all in this file"
							>
								Replace
							</button>
						{/if}
					</div>

					<!-- Matches -->
					{#if !collapsedFiles.has(file.path)}
						{#each file.matches as match}
							<button
								class="flex w-full items-center gap-2 py-0.5 pl-8 pr-3 text-left text-xs hover:bg-zinc-800/50"
								onclick={() => handleClick(file.path, match.line_number, match.match_start + 1)}
							>
								<span class="shrink-0 w-8 text-right text-zinc-600">{match.line_number}</span>
								<span class="flex-1 truncate font-mono text-zinc-400">
									{match.line_content.slice(0, match.match_start)}<span class="bg-amber-500/30 text-amber-200">{match.line_content.slice(match.match_start, match.match_end)}</span>{match.line_content.slice(match.match_end)}
								</span>
							</button>
						{/each}
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
