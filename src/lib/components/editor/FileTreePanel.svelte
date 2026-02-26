<script lang="ts">
	import type { FileTreeEntry } from '$lib/tauri/commands';
	import { getFileIconColor, canDeleteFile } from '$lib/utils/editor-helpers';

	interface ThemeAccent {
		bg: string;
		text: string;
		bgHover: string;
		treeBg: string;
		treeBorder: string;
		treeHover: string;
		treeHeaderBg: string;
		tabBarBg: string;
		tabActiveBg: string;
		tabInactiveBg: string;
	}

	interface Props {
		fileTree: FileTreeEntry[];
		expandedDirs: Set<string>;
		activeFilePath: string | null;
		themeAccent: ThemeAccent;
		onToggleDir: (path: string) => void;
		onFileClick: (path: string) => void;
		onDeleteFile: (e: MouseEvent, path: string) => void;
		onAddModule: () => void;
		onNewFile: () => void;
		onImportTemplate: () => void;
	}

	let {
		fileTree,
		expandedDirs,
		activeFilePath,
		themeAccent,
		onToggleDir,
		onFileClick,
		onDeleteFile,
		onAddModule,
		onNewFile,
		onImportTemplate
	}: Props = $props();
</script>

<div class="file-tree flex w-52 shrink-0 flex-col" style="background: {themeAccent.treeBg}; border-right: 1px solid {themeAccent.treeBorder}; --tree-hover: {themeAccent.treeHover}; --tree-border: {themeAccent.treeBorder}">
	<!-- File Tree Header -->
	<div class="p-2" style="border-bottom: 1px solid {themeAccent.treeBorder}; background: {themeAccent.treeHeaderBg}">
		<div class="flex gap-1">
			<button
				class="flex-1 rounded border border-emerald-600/50 bg-emerald-600/10 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:border-emerald-500 hover:bg-emerald-600/20"
				onclick={onAddModule}
				title="Add Module"
			>
				+
			</button>
			<button
				class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700"
				onclick={onNewFile}
				title="New File"
			>
				📄
			</button>
			<button
				class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700"
				onclick={onImportTemplate}
				title="Import Template"
			>
				📋
			</button>
		</div>
	</div>
	<!-- File Tree Content -->
	<div class="flex-1 overflow-y-auto p-1.5">
		{#each fileTree as entry}
			{#if entry.is_dir}
				<div class="mb-0.5">
					<button
						class="tree-item flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:text-zinc-300"
						onclick={() => onToggleDir(entry.path)}
					>
						<svg class="h-3.5 w-3.5 shrink-0 text-amber-500/70" fill="currentColor" viewBox="0 0 20 20">
							{#if expandedDirs.has(entry.path)}
								<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H8.586A2 2 0 006.9 9.7L2 14V6z" />
								<path fill-rule="evenodd" d="M4 9.5a.5.5 0 01.5-.42h13a.5.5 0 01.49.58l-1.33 8a.5.5 0 01-.49.42H3.33a.5.5 0 01-.49-.58L4 9.5z" clip-rule="evenodd" />
							{:else}
								<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
							{/if}
						</svg>
						{entry.name}
					</button>
					{#if expandedDirs.has(entry.path) && entry.children}
						{#each entry.children as child}
							{#if child.is_dir}
								<div class="ml-2">
									<button
										class="tree-item flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-zinc-400 hover:text-zinc-300"
										onclick={() => onToggleDir(child.path)}
									>
										<svg class="h-3.5 w-3.5 shrink-0 text-amber-500/70" fill="currentColor" viewBox="0 0 20 20">
											{#if expandedDirs.has(child.path)}
												<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H8.586A2 2 0 006.9 9.7L2 14V6z" />
												<path fill-rule="evenodd" d="M4 9.5a.5.5 0 01.5-.42h13a.5.5 0 01.49.58l-1.33 8a.5.5 0 01-.49.42H3.33a.5.5 0 01-.49-.58L4 9.5z" clip-rule="evenodd" />
											{:else}
												<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
											{/if}
										</svg>
										{child.name}
									</button>
									{#if expandedDirs.has(child.path) && child.children}
										{#each child.children as grandchild}
											{#if !grandchild.is_dir}
												<div
													class="tree-item group flex items-center rounded"
													style={activeFilePath === grandchild.path ? `background: ${themeAccent.bg}` : ''}
												>
													<button
														class="flex flex-1 items-center gap-1.5 py-0.5 pr-2 pl-6 text-left text-xs {activeFilePath === grandchild.path ? '' : 'text-zinc-300'}"
														style={activeFilePath === grandchild.path ? `color: ${themeAccent.text}` : ''}
														onclick={() => onFileClick(grandchild.path)}
													>
														<svg class="h-3 w-3 shrink-0 {activeFilePath === grandchild.path ? '' : getFileIconColor(grandchild.name)}" style={activeFilePath === grandchild.path ? `color: ${themeAccent.text}` : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
															<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
														</svg>
														{grandchild.name}
													</button>
													{#if canDeleteFile(grandchild.path)}
														<button
															class="p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
															onclick={(e) => onDeleteFile(e, grandchild.path)}
															title="Delete file"
														>
															<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
															</svg>
														</button>
													{/if}
												</div>
											{/if}
										{/each}
									{/if}
								</div>
							{:else}
								<div
									class="tree-item group flex items-center rounded"
									style={activeFilePath === child.path ? `background: ${themeAccent.bg}` : ''}
								>
									<button
										class="flex flex-1 items-center gap-1.5 py-0.5 pr-2 pl-5 text-left text-xs {activeFilePath === child.path ? '' : 'text-zinc-300'}"
										style={activeFilePath === child.path ? `color: ${themeAccent.text}` : ''}
										onclick={() => onFileClick(child.path)}
									>
										<svg class="h-3 w-3 shrink-0 {activeFilePath === child.path ? '' : getFileIconColor(child.name)}" style={activeFilePath === child.path ? `color: ${themeAccent.text}` : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
										{child.name}
									</button>
									{#if canDeleteFile(child.path)}
										<button
											class="p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
											onclick={(e) => onDeleteFile(e, child.path)}
											title="Delete file"
										>
											<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									{/if}
								</div>
							{/if}
						{/each}
					{/if}
				</div>
			{:else}
				<div
					class="tree-item group flex items-center rounded"
					style={activeFilePath === entry.path ? `background: ${themeAccent.bg}` : ''}
				>
					<button
						class="flex flex-1 items-center gap-1.5 px-2 py-0.5 text-left text-xs {activeFilePath === entry.path ? '' : 'text-zinc-300'}"
						style={activeFilePath === entry.path ? `color: ${themeAccent.text}` : ''}
						onclick={() => onFileClick(entry.path)}
					>
						<svg class="h-3 w-3 shrink-0 {activeFilePath === entry.path ? '' : getFileIconColor(entry.name)}" style={activeFilePath === entry.path ? `color: ${themeAccent.text}` : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						{entry.name}
					</button>
					{#if canDeleteFile(entry.path)}
						<button
							class="p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
							onclick={(e) => onDeleteFile(e, entry.path)}
							title="Delete file"
						>
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	/* Theme-aware tree view hover */
	:global(.file-tree) .tree-item:hover {
		background: var(--tree-hover) !important;
	}
</style>
