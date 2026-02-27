<script lang="ts">
	import type * as Monaco from 'monaco-editor';

	interface Props {
		editor: Monaco.editor.IStandaloneCodeEditor | null;
		filePath: string | null;
		gamePath: string;
	}

	let { editor, filePath, gamePath }: Props = $props();

	interface BreadcrumbSymbol {
		name: string;
		kind: number;
		startLine: number;
		endLine: number;
	}

	let symbols = $state<BreadcrumbSymbol[]>([]);
	let activeSymbol = $state<BreadcrumbSymbol | null>(null);
	let cursorLine = $state(1);

	// Symbol kind labels (matching Monaco/LSP SymbolKind)
	function symbolKindIcon(kind: number): string {
		switch (kind) {
			case 12: return 'fn'; // Function
			case 14: return 'cb'; // Combo (mapped as Constructor or similar)
			case 5: return 'cl'; // Class
			case 13: return 'var'; // Variable
			case 10: return 'en'; // Enum
			case 23: return 'ev'; // Event
			default: return '';
		}
	}

	// Get relative path from gamePath
	let relativePath = $derived.by(() => {
		if (!filePath || !gamePath) return filePath ?? '';
		if (filePath.startsWith(gamePath)) {
			return filePath.slice(gamePath.length + 1);
		}
		return filePath.split('/').pop() ?? '';
	});

	// Fetch symbols when editor or file changes
	$effect(() => {
		const ed = editor;
		const fp = filePath;
		if (!ed || !fp) {
			symbols = [];
			return;
		}

		const model = ed.getModel();
		if (!model) {
			symbols = [];
			return;
		}

		// Use Monaco's built-in document symbol provider
		const fetchSymbols = async () => {
			try {
				// Access Monaco's internal API to get document symbols
				const monacoModule = await import('monaco-editor');
				const result = await (monacoModule.editor as any).getDocumentSymbols(model);
				if (result && Array.isArray(result)) {
					symbols = result.map((s: any) => ({
						name: s.name,
						kind: s.kind,
						startLine: s.range.startLineNumber,
						endLine: s.range.endLineNumber
					}));
				} else {
					symbols = [];
				}
			} catch {
				symbols = [];
			}
		};

		fetchSymbols();

		// Re-fetch on content changes (debounced)
		let timer: ReturnType<typeof setTimeout>;
		const disposable = model.onDidChangeContent(() => {
			clearTimeout(timer);
			timer = setTimeout(fetchSymbols, 500);
		});

		return () => {
			clearTimeout(timer);
			disposable.dispose();
		};
	});

	// Track cursor position
	$effect(() => {
		const ed = editor;
		if (!ed) return;

		const disposable = ed.onDidChangeCursorPosition((e) => {
			cursorLine = e.position.lineNumber;
		});

		return () => disposable.dispose();
	});

	// Find which symbol the cursor is inside
	$effect(() => {
		const line = cursorLine;
		// Find the innermost (most specific) symbol containing the cursor
		let best: BreadcrumbSymbol | null = null;
		for (const sym of symbols) {
			if (line >= sym.startLine && line <= sym.endLine) {
				if (!best || (sym.endLine - sym.startLine) < (best.endLine - best.startLine)) {
					best = sym;
				}
			}
		}
		activeSymbol = best;
	});

	function handleSymbolClick(sym: BreadcrumbSymbol) {
		if (editor) {
			editor.revealLineInCenter(sym.startLine);
			editor.setPosition({ lineNumber: sym.startLine, column: 1 });
			editor.focus();
		}
	}
</script>

{#if filePath}
	<div class="flex items-center gap-1 overflow-hidden border-b border-zinc-700/50 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-500">
		<span class="shrink-0">{relativePath}</span>
		{#if activeSymbol}
			<svg class="h-3 w-3 shrink-0 text-zinc-600" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
			</svg>
			<button
				class="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-zinc-300 hover:bg-zinc-800"
				onclick={() => handleSymbolClick(activeSymbol!)}
			>
				{#if symbolKindIcon(activeSymbol.kind)}
					<span class="text-emerald-500/70">{symbolKindIcon(activeSymbol.kind)}</span>
				{/if}
				{activeSymbol.name}
			</button>
		{/if}
	</div>
{/if}
