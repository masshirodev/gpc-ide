<script lang="ts">
	import MonacoEditor from './MonacoEditor.svelte';
	import Breadcrumbs from './Breadcrumbs.svelte';
	import RecoilTableEditor from './RecoilTableEditor.svelte';
	import KeyboardMapperEditor from './KeyboardMapperEditor.svelte';
	import ConfigEditor from './ConfigEditor.svelte';
	import {
		getEditorStore,
		activateTab,
		saveTab,
		type EditorTab
	} from '$lib/stores/editor.svelte';
	import { getLanguageForFile } from '$lib/utils/editor-helpers';
	import type { ConsoleType } from '$lib/utils/console-buttons';
	import type { GitLineChange } from './MonacoEditor.svelte';
	import type * as Monaco from 'monaco-editor';

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
		currentTab: EditorTab | undefined;
		gamePath: string;
		consoleType: ConsoleType;
		themeAccent: ThemeAccent;
		onCloseTab: (e: MouseEvent, path: string) => void;
		onContentChange: (path: string, content: string) => void;
		onEditorReady: (editor: import('monaco-editor').editor.IStandaloneCodeEditor) => void;
		onOpenExternal: () => void;
		gitChanges?: GitLineChange[];
		editorComponent?: MonacoEditor;
	}

	let {
		currentTab,
		gamePath,
		consoleType,
		themeAccent,
		onCloseTab,
		onContentChange,
		onEditorReady,
		onOpenExternal,
		gitChanges,
		editorComponent = $bindable()
	}: Props = $props();

	let editorStore = getEditorStore();

	// Editor subtab for files with visual editors (recoiltable.gpc etc.)
	let editorSubTab = $state<'visual' | 'code'>('visual');

	// Config editor subtab for config.toml files
	let configSubTab = $state<'gui' | 'editor'>('gui');

	// Reset subtab when switching files
	$effect(() => {
		void editorStore.activeTabPath;
		editorSubTab = 'visual';
		configSubTab = 'gui';
	});

	// Check if current file has a visual editor
	let hasVisualEditor = $derived(
		(currentTab?.path.endsWith('recoiltable.gpc') ||
			currentTab?.path.endsWith('keyboard.gpc')) ??
			false
	);
	let isKeyboardFile = $derived(currentTab?.path.endsWith('keyboard.gpc') ?? false);

	// Check if current file is config.toml
	let isConfigFile = $derived(currentTab?.path.endsWith('config.toml') ?? false);

	// Track current Monaco editor instance for breadcrumbs
	let currentMonacoEditor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null);

	// Show breadcrumbs only when viewing a code file (not visual/GUI subtab)
	let showBreadcrumbs = $derived(
		currentTab &&
		!isConfigFile &&
		!(hasVisualEditor && editorSubTab === 'visual')
	);

	// Split view state
	let splitMode = $state(false);
	let splitTabPath = $state<string | null>(null);
	let splitTab = $derived(
		splitTabPath ? editorStore.tabs.find((t) => t.path === splitTabPath) : undefined
	);

	// Auto-pick a split tab when entering split mode
	$effect(() => {
		if (splitMode && !splitTab && editorStore.tabs.length > 1 && currentTab) {
			const other = editorStore.tabs.find((t) => t.path !== currentTab.path);
			if (other) splitTabPath = other.path;
		}
	});

	function toggleSplit() {
		splitMode = !splitMode;
		if (!splitMode) splitTabPath = null;
	}

	// Expose configSubTab for external use (overview panel clicks)
	export function setConfigSubTab(tab: 'gui' | 'editor') {
		configSubTab = tab;
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Editor Tab Bar -->
	{#if editorStore.tabs.length > 0}
		<div class="flex items-center" style="background: {themeAccent.tabBarBg}; border-bottom: 1px solid {themeAccent.treeBorder}">
			<div class="flex flex-1 overflow-x-auto scrollbar-none">
				{#each editorStore.tabs as tab (tab.path)}
					<button
						class="group flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs transition-colors {editorStore.activeTabPath === tab.path ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}"
						style="background: {editorStore.activeTabPath === tab.path ? themeAccent.tabActiveBg : themeAccent.tabInactiveBg}; border-right: 1px solid {themeAccent.treeBorder}"
						onclick={() => activateTab(tab.path)}
						onauxclick={(e) => {
							if (e.button === 1) {
								e.preventDefault();
								onCloseTab(e, tab.path);
							}
						}}
					>
						<span>{tab.name}</span>
						{#if tab.dirty}
							<span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
						{/if}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<span
							class="ml-1 rounded p-0.5 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-300"
							style="--tree-hover: {themeAccent.treeHover}"
							role="button"
							tabindex="-1"
							onclick={(e) => onCloseTab(e, tab.path)}
						>
							✕
						</span>
					</button>
				{/each}
			</div>
			<div class="flex shrink-0 items-center gap-2 px-2">
				{#if currentTab && editorStore.tabs.length > 1}
					<button
						class="p-1.5 transition-colors {splitMode ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}"
						onclick={toggleSplit}
						title={splitMode ? 'Close split view' : 'Split editor'}
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<line x1="12" y1="3" x2="12" y2="21" />
						</svg>
					</button>
				{/if}
				{#if currentTab}
					<button
						class="p-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
						onclick={onOpenExternal}
						title="Open in external editor"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</button>
				{/if}
				{#if currentTab?.dirty}
					<button
						class="px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
						onclick={() => saveTab()}
						disabled={editorStore.saving}
					>
						{editorStore.saving ? 'Saving...' : 'Save'}
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Editor Area (with optional Visual/Code or GUI/Editor subtabs) -->
	<div class="flex flex-1 flex-col overflow-hidden">
		{#if currentTab}
			{#if hasVisualEditor || isConfigFile}
				<div class="flex" style="background: {themeAccent.tabBarBg}; border-bottom: 1px solid {themeAccent.treeBorder}">
					{#if hasVisualEditor}
						<button
							class="px-4 py-1.5 text-xs font-medium transition-colors {editorSubTab === 'visual' ? '' : 'text-zinc-500 hover:text-zinc-300'}"
							style={editorSubTab === 'visual' ? `color: ${themeAccent.text}; border-bottom: 2px solid ${themeAccent.text}` : ''}
							onclick={() => (editorSubTab = 'visual')}
						>
							Visual
						</button>
						<button
							class="px-4 py-1.5 text-xs font-medium transition-colors {editorSubTab === 'code' ? '' : 'text-zinc-500 hover:text-zinc-300'}"
							style={editorSubTab === 'code' ? `color: ${themeAccent.text}; border-bottom: 2px solid ${themeAccent.text}` : ''}
							onclick={() => (editorSubTab = 'code')}
						>
							Code
						</button>
					{:else if isConfigFile}
						<button
							class="px-4 py-1.5 text-xs font-medium transition-colors {configSubTab === 'gui' ? '' : 'text-zinc-500 hover:text-zinc-300'}"
							style={configSubTab === 'gui' ? `color: ${themeAccent.text}; border-bottom: 2px solid ${themeAccent.text}` : ''}
							onclick={() => (configSubTab = 'gui')}
						>
							GUI
						</button>
						<button
							class="px-4 py-1.5 text-xs font-medium transition-colors {configSubTab === 'editor' ? '' : 'text-zinc-500 hover:text-zinc-300'}"
							style={configSubTab === 'editor' ? `color: ${themeAccent.text}; border-bottom: 2px solid ${themeAccent.text}` : ''}
							onclick={() => (configSubTab = 'editor')}
						>
							Editor
						</button>
					{/if}
				</div>
			{/if}

			{#if showBreadcrumbs}
				<Breadcrumbs editor={currentMonacoEditor} filePath={currentTab?.path ?? null} {gamePath} />
			{/if}

			<div class="flex flex-1 overflow-hidden {splitMode ? 'flex-row' : 'flex-col'}">
				<!-- Primary editor pane -->
				<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
					{#if hasVisualEditor && editorSubTab === 'visual' && isKeyboardFile}
						{#key editorStore.activeTabPath}
							<KeyboardMapperEditor
								content={currentTab.content}
								gamePath={gamePath}
								filePath={currentTab.path}
								consoleType={consoleType}
								onchange={(v) => onContentChange(currentTab!.path, v)}
							/>
						{/key}
					{:else if hasVisualEditor && editorSubTab === 'visual'}
						{#key editorStore.activeTabPath}
							<RecoilTableEditor
								content={currentTab.content}
								gamePath={gamePath}
								filePath={currentTab.path}
								onchange={(v) => onContentChange(currentTab!.path, v)}
							/>
						{/key}
					{:else if isConfigFile && configSubTab === 'gui'}
						{#key editorStore.activeTabPath}
							<ConfigEditor gamePath={gamePath} />
						{/key}
					{:else}
						{#key editorStore.activeTabPath}
							<MonacoEditor
								bind:this={editorComponent}
								value={currentTab.content}
								language={getLanguageForFile(currentTab.path)}
								filePath={currentTab.path}
								{gitChanges}
								onchange={(v) => onContentChange(currentTab!.path, v)}
								onready={(ed) => { currentMonacoEditor = ed; onEditorReady(ed); }}
							/>
						{/key}
					{/if}
				</div>

				<!-- Split pane -->
				{#if splitMode}
					<div class="w-px shrink-0" style="background: {themeAccent.treeBorder}"></div>
					<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
						<!-- Split pane tab selector -->
						<div class="flex items-center" style="background: {themeAccent.tabBarBg}; border-bottom: 1px solid {themeAccent.treeBorder}">
							<select
								class="flex-1 border-none bg-transparent px-2 py-1 text-xs text-zinc-300 outline-none"
								bind:value={splitTabPath}
							>
								{#each editorStore.tabs.filter(t => t.path !== currentTab?.path) as tab}
									<option value={tab.path}>{tab.name}</option>
								{/each}
							</select>
						</div>
						{#if splitTab}
							{#key splitTabPath}
								<MonacoEditor
									value={splitTab.content}
									language={getLanguageForFile(splitTab.path)}
									filePath={splitTab.path}
									onchange={(v) => onContentChange(splitTab!.path, v)}
									onready={() => {}}
								/>
							{/key}
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<div
				class="flex h-full items-center justify-center bg-zinc-950 text-sm text-zinc-600"
			>
				Select a file to edit
			</div>
		{/if}
	</div>
</div>
