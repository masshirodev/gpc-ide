<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { readFileTree, readFile, getAppRoot } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';
	import type { FileTreeEntry } from '$lib/tauri/commands';

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	interface BuildFile {
		name: string;
		path: string;
		source: string;
	}

	let files = $state<BuildFile[]>([]);
	let loading = $state(true);
	let selectedFile = $state<BuildFile | null>(null);
	let fileContent = $state<string | null>(null);
	let loadingContent = $state(false);
	let copied = $state(false);
	let searchQuery = $state('');

	let filteredFiles = $derived.by(() => {
		if (!searchQuery.trim()) return files;
		const q = searchQuery.toLowerCase();
		return files.filter((f) => f.name.toLowerCase().includes(q));
	});

	onMount(() => {
		loadBuilds();
	});

	async function loadBuilds() {
		loading = true;
		files = [];
		try {
			const sources: Array<{ path: string; label: string }> = [];

			for (const ws of settings.workspaces) {
				sources.push({ path: `${ws}/dist`, label: ws.split('/').pop() ?? ws });
			}

			try {
				const appRoot = await getAppRoot();
				const appDist = `${appRoot}/dist`;
				if (!sources.some((s) => s.path === appDist)) {
					sources.push({ path: appDist, label: 'app' });
				}
			} catch {
				// ignore if getAppRoot fails
			}

			const allFiles: BuildFile[] = [];

			for (const src of sources) {
				try {
					const entries = await readFileTree(src.path);
					flattenGpcFiles(entries, src.label, allFiles);
				} catch {
					// dist dir might not exist yet, that's fine
				}
			}

			allFiles.sort((a, b) => a.name.localeCompare(b.name));
			files = allFiles;
		} catch (e) {
			addToast(`Failed to scan dist directories: ${e}`, 'error');
		} finally {
			loading = false;
		}
	}

	function flattenGpcFiles(entries: FileTreeEntry[], source: string, out: BuildFile[]) {
		for (const entry of entries) {
			if (entry.is_dir && entry.children) {
				flattenGpcFiles(entry.children, source, out);
			} else if (entry.name.endsWith('.gpc')) {
				out.push({ name: entry.name, path: entry.path, source });
			}
		}
	}

	async function selectFile(file: BuildFile) {
		selectedFile = file;
		fileContent = null;
		loadingContent = true;
		copied = false;
		try {
			fileContent = await readFile(file.path);
		} catch (e) {
			addToast(`Failed to read file: ${e}`, 'error');
			fileContent = null;
		} finally {
			loadingContent = false;
		}
	}

	async function handleCopy() {
		if (!fileContent) return;
		try {
			await navigator.clipboard.writeText(fileContent);
			copied = true;
			addToast('Copied to clipboard', 'success');
			setTimeout(() => (copied = false), 2000);
		} catch {
			addToast('Failed to copy to clipboard', 'error');
		}
	}

	async function handleDelete(file: BuildFile) {
		try {
			const { deleteFile } = await import('$lib/tauri/commands');
			await deleteFile(file.path);
			addToast(`Deleted ${file.name}`, 'success');
			if (selectedFile?.path === file.path) {
				selectedFile = null;
				fileContent = null;
			}
			await loadBuilds();
		} catch (e) {
			addToast(`Failed to delete: ${e}`, 'error');
		}
	}
</script>

<div class="flex h-full flex-col bg-zinc-950 text-zinc-200">
	<!-- Top Bar -->
	<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
		<div class="flex items-center gap-3">
			<button
				class="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={() => goto('/')}
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				Dashboard
			</button>
			<h1 class="text-sm font-semibold text-zinc-100">Built Games</h1>
		</div>
		<button
			class="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
			onclick={loadBuilds}
			disabled={loading}
		>
			<svg
				class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
			Refresh
		</button>
	</div>

	<!-- Main Content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left Panel: File List -->
		<div class="flex w-72 shrink-0 flex-col border-r border-zinc-800">
			<!-- Search -->
			<div class="border-b border-zinc-800 p-3">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search builds..."
					class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
				/>
			</div>

			<!-- File List -->
			<div class="flex-1 overflow-y-auto">
				{#if loading}
					<div class="px-3 py-6 text-center text-xs text-zinc-500">
						Scanning dist directories...
					</div>
				{:else if filteredFiles.length === 0}
					<div class="px-3 py-6 text-center text-xs text-zinc-500">
						{files.length === 0 ? 'No built files found. Build a game first.' : 'No matches'}
					</div>
				{:else}
					{#each filteredFiles as file (file.path)}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div
							class="group flex w-full cursor-pointer items-center gap-2 border-b border-zinc-800/50 px-3 py-2.5 text-left transition-colors {selectedFile?.path ===
							file.path
								? 'bg-zinc-800/80'
								: 'hover:bg-zinc-900'}"
							onclick={() => selectFile(file)}
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<svg
										class="h-3.5 w-3.5 shrink-0 text-emerald-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
									<span class="truncate text-xs font-medium text-zinc-200"
										>{file.name}</span
									>
								</div>
								<div class="mt-0.5 pl-5.5 text-[10px] text-zinc-600">
									{file.source}
								</div>
							</div>
							<button
								class="shrink-0 rounded p-1 text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
								onclick={(e) => {
									e.stopPropagation();
									handleDelete(file);
								}}
								title="Delete build file"
							>
								<svg
									class="h-3.5 w-3.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
				{filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
			</div>
		</div>

		<!-- Right Panel: File Content -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if loadingContent}
				<div class="flex flex-1 items-center justify-center text-xs text-zinc-500">
					Loading file...
				</div>
			{:else if selectedFile && fileContent !== null}
				<!-- File header -->
				<div
					class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2"
				>
					<div class="flex items-center gap-3">
						<span class="text-xs font-medium text-zinc-200">{selectedFile.name}</span>
						<span class="text-xs text-zinc-600">
							{fileContent.split('\n').length} lines
						</span>
					</div>
					<div class="flex items-center gap-2">
						<button
							class="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
							onclick={handleCopy}
							title="Copy to clipboard"
						>
							<svg
								class="h-3 w-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
							{copied ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>

				<!-- Editor -->
				<div class="flex-1">
					<MonacoEditor value={fileContent} language="gpc" readonly={true} />
				</div>
			{:else}
				<!-- Empty state -->
				<div class="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
					<svg class="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<p class="text-xs">Select a built file to view its contents</p>
				</div>
			{/if}
		</div>
	</div>
</div>
