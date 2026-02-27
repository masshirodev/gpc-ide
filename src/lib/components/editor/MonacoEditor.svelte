<script lang="ts">
	import { onMount } from 'svelte';
	import type * as Monaco from 'monaco-editor';
	import { consumePendingJump } from '$lib/stores/editor.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';

	export interface GitLineChange {
		type: 'added' | 'modified' | 'deleted';
		startLine: number;
		endLine: number;
	}

	interface Props {
		value: string;
		language?: string;
		readonly?: boolean;
		filePath?: string;
		gitChanges?: GitLineChange[];
		onchange?: (value: string) => void;
		onready?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
	}

	let { value, language = 'gpc', readonly = false, filePath, gitChanges, onchange, onready }: Props = $props();

	let container: HTMLDivElement;
	let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
	let monaco: typeof Monaco | undefined;
	let suppressChangeEvent = false;
	let gitDecorations: string[] = [];

	// Global flag shared across instances — register GPC language only once
	let languageRegistered = false;

	let settingsStore = getSettings();

	// React to setting changes
	$effect(() => {
		const settings = $settingsStore;
		if (editor && monaco && settings) {
			editor.updateOptions({
				fontSize: settings.editorFontSize,
				tabSize: settings.editorTabSize,
				fontFamily: settings.editorFontFamily,
				minimap: { enabled: settings.editorMinimap },
				stickyScroll: { enabled: settings.editorStickyScroll }
			});
			monaco.editor.setTheme(settings.editorTheme);
		}
	});

	// Apply git diff gutter decorations
	$effect(() => {
		if (!editor || !monaco) return;
		const changes = gitChanges ?? [];
		const decorations: Monaco.editor.IModelDeltaDecoration[] = changes.map(c => ({
			range: new monaco!.Range(c.startLine, 1, c.endLine, 1),
			options: {
				isWholeLine: true,
				linesDecorationsClassName:
					c.type === 'added' ? 'git-gutter-added' :
					c.type === 'deleted' ? 'git-gutter-deleted' :
					'git-gutter-modified'
			}
		}));
		gitDecorations = editor.deltaDecorations(gitDecorations, decorations);
	});

	// Sync value prop changes into the editor
	$effect(() => {
		const v = value;
		if (editor && editor.getValue() !== v) {
			suppressChangeEvent = true;
			editor.setValue(v);
			suppressChangeEvent = false;
		}
	});

	onMount(() => {
		initMonaco();
		return () => {
			editor?.dispose();
			// Don't dispose models with file:// URIs — they persist for LSP diagnostics
		};
	});

	async function initMonaco() {
		const monacoModule = await import('monaco-editor');
		monaco = monacoModule;

		if (!languageRegistered) {
			const { registerGpcLanguage } = await import('./gpc-language');
			registerGpcLanguage(monaco);
			languageRegistered = true;
		}

		self.MonacoEnvironment = {
			getWorker(_: string, label: string) {
				if (label === 'json') {
					return new Worker(
						new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
						{ type: 'module' }
					);
				}
				if (label === 'css' || label === 'scss' || label === 'less') {
					return new Worker(
						new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
						{ type: 'module' }
					);
				}
				if (label === 'html' || label === 'handlebars' || label === 'razor') {
					return new Worker(
						new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
						{ type: 'module' }
					);
				}
				if (label === 'typescript' || label === 'javascript') {
					return new Worker(
						new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
						{ type: 'module' }
					);
				}
				return new Worker(
					new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
					{ type: 'module' }
				);
			}
		};

		// Create or reuse a model with file:// URI for LSP integration
		let model: Monaco.editor.ITextModel | undefined;
		if (filePath) {
			const uri = monaco.Uri.parse(`file://${filePath}`);
			model = monaco.editor.getModel(uri) ?? undefined;
			if (!model) {
				model = monaco.editor.createModel(value, language, uri);
			} else {
				suppressChangeEvent = true;
				model.setValue(value);
				suppressChangeEvent = false;
			}
		}

		const currentSettings = $settingsStore;
		editor = monaco.editor.create(container, {
			...(model ? { model } : { value, language }),
			theme: currentSettings.editorTheme,
			readOnly: readonly,
			automaticLayout: true,
			fontSize: currentSettings.editorFontSize,
			fontFamily: currentSettings.editorFontFamily,
			fontLigatures: true,
			lineNumbers: 'on',
			minimap: { enabled: currentSettings.editorMinimap },
			stickyScroll: { enabled: currentSettings.editorStickyScroll },
			scrollBeyondLastLine: false,
			renderWhitespace: 'selection',
			tabSize: currentSettings.editorTabSize,
			insertSpaces: true,
			wordWrap: 'off',
			bracketPairColorization: { enabled: true },
			guides: {
				bracketPairs: true,
				indentation: true
			},
			padding: { top: 8 },
			smoothScrolling: true,
			cursorBlinking: 'smooth',
			cursorSmoothCaretAnimation: 'on'
		});

		editor.onDidChangeModelContent(() => {
			if (!suppressChangeEvent && onchange) {
				onchange(editor!.getValue());
			}
		});

		// Check for pending line jump (e.g. from build error click)
		if (filePath) {
			const jumpLine = consumePendingJump(filePath);
			if (jumpLine !== null) {
				editor.revealLineInCenter(jumpLine);
				editor.setPosition({ lineNumber: jumpLine, column: 1 });
			}
		}

		// Notify parent that the editor instance is ready
		if (onready) onready(editor);
	}

	export function getEditor() {
		return editor;
	}

	export function focus() {
		editor?.focus();
	}

	export function revealLine(line: number) {
		if (editor) {
			editor.revealLineInCenter(line);
			editor.setPosition({ lineNumber: line, column: 1 });
			editor.focus();
		}
	}
</script>

<div class="monaco-container select-text" bind:this={container}></div>

<style>
	.monaco-container {
		width: 100%;
		height: 100%;
	}
	:global(.git-gutter-added) {
		background: #2ea04370;
		width: 3px !important;
		margin-left: 3px;
	}
	:global(.git-gutter-modified) {
		background: #d29922a0;
		width: 3px !important;
		margin-left: 3px;
	}
	:global(.git-gutter-deleted) {
		background: #f8514970;
		width: 3px !important;
		margin-left: 3px;
	}
</style>
