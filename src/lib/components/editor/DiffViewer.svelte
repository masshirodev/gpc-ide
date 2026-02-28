<script lang="ts">
	import { onMount } from 'svelte';
	import type * as Monaco from 'monaco-editor';
	import { getSettings } from '$lib/stores/settings.svelte';

	interface Props {
		originalValue: string;
		modifiedValue: string;
		originalLabel?: string;
		modifiedLabel?: string;
		language?: string;
	}

	let { originalValue, modifiedValue, originalLabel = 'Original', modifiedLabel = 'Modified', language = 'ini' }: Props = $props();

	let container: HTMLDivElement;
	let diffEditor = $state<Monaco.editor.IStandaloneDiffEditor | undefined>();
	let settingsStore = getSettings();

	onMount(() => {
		initDiffEditor();
		return () => {
			diffEditor?.dispose();
		};
	});

	// Update models when values change
	$effect(() => {
		if (diffEditor) {
			const orig = originalValue;
			const mod = modifiedValue;
			const origModel = diffEditor.getModel()?.original;
			const modModel = diffEditor.getModel()?.modified;
			if (origModel && origModel.getValue() !== orig) {
				origModel.setValue(orig);
			}
			if (modModel && modModel.getValue() !== mod) {
				modModel.setValue(mod);
			}
		}
	});

	async function initDiffEditor() {
		const monaco = await import('monaco-editor');
		const currentSettings = $settingsStore;

		// Ensure GPC language and custom themes are registered
		const { registerGpcLanguage } = await import('./gpc-language');
		registerGpcLanguage(monaco);

		const originalModel = monaco.editor.createModel(originalValue, language);
		const modifiedModel = monaco.editor.createModel(modifiedValue, language);

		diffEditor = monaco.editor.createDiffEditor(container, {
			readOnly: true,
			automaticLayout: true,
			fontSize: currentSettings.editorFontSize,
			fontFamily: currentSettings.editorFontFamily,
			fontLigatures: true,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			renderSideBySide: true,
			enableSplitViewResizing: true,
			padding: { top: 8 },
			smoothScrolling: true
		});

		diffEditor.setModel({
			original: originalModel,
			modified: modifiedModel
		});

		// Apply theme globally after editor creation
		monaco.editor.setTheme(currentSettings.editorTheme);
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex items-center border-b border-zinc-700/50 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-500">
		<span class="flex-1 text-red-400/70">{originalLabel}</span>
		<span class="flex-1 text-right text-emerald-400/70">{modifiedLabel}</span>
	</div>
	<div class="min-h-[300px] w-full flex-1" bind:this={container}></div>
</div>
