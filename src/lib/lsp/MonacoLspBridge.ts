import type * as Monaco from 'monaco-editor';
import type { LspClient, LspDiagnostic, LspRange } from './LspClient';
import {
	setDiagnostics as storeDiagnostics,
	clearAllDiagnostics
} from '$lib/stores/diagnostics.svelte';
import { setReferences, type ReferenceLocation } from '$lib/stores/references.svelte';
import { setBottomPanelOpen, setBottomPanelActiveTab } from '$lib/stores/ui.svelte';

// LSP CompletionItemKind → Monaco CompletionItemKind
const COMPLETION_KIND_MAP: Record<number, number> = {
	1: 18, // Text
	2: 0, // Method
	3: 1, // Function
	4: 4, // Constructor
	5: 4, // Field
	6: 5, // Variable
	7: 7, // Class
	8: 8, // Interface
	9: 9, // Module
	10: 9, // Property
	11: 12, // Unit
	12: 11, // Value
	13: 15, // Enum
	14: 13, // Keyword
	15: 14, // Snippet
	16: 15, // Color
	17: 17, // File
	18: 18, // Reference
	19: 19, // Folder
	20: 15, // EnumMember
	21: 14, // Constant
	22: 22, // Struct
	23: 23, // Event
	24: 24, // Operator
	25: 25 // TypeParameter
};

// LSP DiagnosticSeverity → Monaco MarkerSeverity
const SEVERITY_MAP: Record<number, number> = {
	1: 8, // Error
	2: 4, // Warning
	3: 2, // Information
	4: 1 // Hint
};

/** Convert an absolute file path to a file:// URI */
export function pathToUri(path: string): string {
	return `file://${path}`;
}

/** Convert a file:// URI back to an absolute path */
export function uriToPath(uri: string): string {
	return uri.startsWith('file://') ? uri.slice(7) : uri;
}

export class MonacoLspBridge {
	private monaco: typeof Monaco;
	private client: LspClient;
	private disposables: Monaco.IDisposable[] = [];
	private showRefsCommandId: string | null = null;
	private pendingCodeLensRefs = new Map<
		string,
		{ symbol: string; definition: ReferenceLocation | null; references: ReferenceLocation[] }
	>();

	constructor(monaco: typeof Monaco, client: LspClient) {
		this.monaco = monaco;
		this.client = client;
	}

	/**
	 * Bind an editor instance so CodeLens "N references" clicks
	 * populate the References panel.  Call whenever the active editor changes.
	 */
	setEditor(editor: Monaco.editor.IStandaloneCodeEditor): void {
		this.showRefsCommandId =
			editor.addCommand(0, (_ctx: unknown, refKey: string) => {
				const data = this.pendingCodeLensRefs.get(refKey);
				if (data) {
					setReferences(data.symbol, data.definition, data.references);
					setBottomPanelOpen(true);
					setBottomPanelActiveTab('references');
					this.pendingCodeLensRefs.delete(refKey);
				}
			}) ?? null;
	}

	/**
	 * Register all Monaco language providers for GPC.
	 * Call once after Monaco and LSP are both ready.
	 */
	registerProviders(): void {
		this.disposables = [
			this.registerCompletionProvider(),
			this.registerHoverProvider(),
			this.registerDefinitionProvider(),
			this.registerReferenceProvider(),
			this.registerSignatureHelpProvider(),
			this.registerDocumentSymbolProvider(),
			this.registerDocumentHighlightProvider(),
			this.registerRenameProvider(),
			this.registerFoldingRangeProvider(),
			this.registerInlayHintsProvider(),
			this.registerSemanticTokensProvider(),
			this.registerCodeLensProvider(),
			this.registerDocumentFormattingProvider()
		];

		// Register diagnostic handler
		this.client.onDiagnostics((uri, diagnostics) => {
			this.setDiagnostics(uri, diagnostics);
			storeDiagnostics(uri, diagnostics);
		});
	}

	/** Dispose all registered providers. */
	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables = [];
		clearAllDiagnostics();
	}

	// --- Provider Registration ---

	private registerCompletionProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerCompletionItemProvider('gpc', {
			triggerCharacters: ['.', '(', '"', "'", '<', '/', '#'],
			provideCompletionItems: async (model, position) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.completion(uri, {
						line: position.lineNumber - 1,
						character: position.column - 1
					});
					if (!result) return { suggestions: [] };

					// Handle both CompletionList and CompletionItem[]
					const items = Array.isArray(result)
						? result
						: (result as { items?: unknown[] }).items || [];

					const suggestions = (items as any[]).map((item) =>
						this.convertCompletionItem(item, model, position)
					);
					return { suggestions };
				} catch {
					return { suggestions: [] };
				}
			}
		});
	}

	private registerHoverProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerHoverProvider('gpc', {
			provideHover: async (model, position) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.hover(uri, {
						line: position.lineNumber - 1,
						character: position.column - 1
					});
					if (!result) return null;

					const hover = result as {
						contents: { kind?: string; value: string } | string;
						range?: LspRange;
					};

					const value = typeof hover.contents === 'string' ? hover.contents : hover.contents.value;

					return {
						contents: [{ value }],
						range: hover.range ? this.convertRange(hover.range) : undefined
					};
				} catch {
					return null;
				}
			}
		});
	}

	private registerDefinitionProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerDefinitionProvider('gpc', {
			provideDefinition: async (model, position) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.definition(uri, {
						line: position.lineNumber - 1,
						character: position.column - 1
					});
					if (!result) return null;

					const locations = Array.isArray(result) ? result : [result];
					return locations.map((loc: any) => ({
						uri: this.monaco.Uri.parse(loc.uri),
						range: this.convertRange(loc.range)
					}));
				} catch {
					return null;
				}
			}
		});
	}

	private registerReferenceProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerReferenceProvider('gpc', {
			provideReferences: async (model, position, context) => {
				const uri = pathToUri(model.uri.path);
				const lspPos = {
					line: position.lineNumber - 1,
					character: position.column - 1
				};
				try {
					const result = await this.client.references(uri, lspPos, context.includeDeclaration);
					if (!result) return null;

					const locations = Array.isArray(result) ? result : [result];
					const monacoLocations = locations.map((loc: any) => ({
						uri: this.monaco.Uri.parse(loc.uri),
						range: this.convertRange(loc.range)
					}));

					// Also fetch definition to show as first entry
					const symbol = model.getWordAtPosition(position)?.word || '';
					let defLocation: ReferenceLocation | null = null;
					try {
						const defResult = await this.client.definition(uri, lspPos);
						if (defResult) {
							const defs = Array.isArray(defResult) ? defResult : [defResult];
							if (defs.length > 0) {
								defLocation = this.toLspRefLocation(defs[0]);
							}
						}
					} catch {
						// definition lookup is best-effort
					}

					const refLocations = locations.map((loc: any) => this.toLspRefLocation(loc));
					setReferences(symbol, defLocation, refLocations);
					setBottomPanelOpen(true);
					setBottomPanelActiveTab('references');

					return monacoLocations;
				} catch {
					return null;
				}
			}
		});
	}

	private registerSignatureHelpProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerSignatureHelpProvider('gpc', {
			signatureHelpTriggerCharacters: ['(', ','],
			provideSignatureHelp: async (model, position) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.signatureHelp(uri, {
						line: position.lineNumber - 1,
						character: position.column - 1
					});
					if (!result) return null;

					const sigHelp = result as {
						signatures: Array<{
							label: string;
							documentation?: string | { value: string };
							parameters?: Array<{
								label: string;
								documentation?: string;
							}>;
						}>;
						activeSignature: number;
						activeParameter: number;
					};

					return {
						value: {
							signatures: sigHelp.signatures.map((sig) => ({
								label: sig.label,
								documentation:
									typeof sig.documentation === 'string'
										? sig.documentation
										: sig.documentation?.value,
								parameters: (sig.parameters || []).map((p) => ({
									label: p.label,
									documentation: p.documentation
								}))
							})),
							activeSignature: sigHelp.activeSignature,
							activeParameter: sigHelp.activeParameter
						},
						dispose: () => {}
					};
				} catch {
					return null;
				}
			}
		});
	}

	private registerDocumentSymbolProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerDocumentSymbolProvider('gpc', {
			provideDocumentSymbols: async (model) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.documentSymbols(uri);
					if (!result) return [];

					const symbols = result as Array<{
						name: string;
						kind: number;
						range: LspRange;
						selectionRange: LspRange;
						detail?: string;
					}>;

					return symbols.map((sym) => ({
						name: sym.name,
						kind: sym.kind, // Monaco SymbolKind values match LSP
						range: this.convertRange(sym.range),
						selectionRange: this.convertRange(sym.selectionRange),
						detail: sym.detail || '',
						tags: []
					}));
				} catch {
					return [];
				}
			}
		});
	}

	private registerDocumentHighlightProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerDocumentHighlightProvider('gpc', {
			provideDocumentHighlights: async (model, position) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.documentHighlight(uri, {
						line: position.lineNumber - 1,
						character: position.column - 1
					});
					if (!result) return null;

					const highlights = result as Array<{
						range: LspRange;
						kind?: number;
					}>;
					return highlights.map((h) => ({
						range: this.convertRange(h.range),
						kind: h.kind
					}));
				} catch {
					return null;
				}
			}
		});
	}

	private registerRenameProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerRenameProvider('gpc', {
			provideRenameEdits: async (model, position, newName) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.rename(
						uri,
						{
							line: position.lineNumber - 1,
							character: position.column - 1
						},
						newName
					);
					if (!result) return null;

					const workspaceEdit = result as {
						changes?: Record<string, Array<{ range: LspRange; newText: string }>>;
					};

					const edits: Monaco.languages.IWorkspaceTextEdit[] = [];
					if (workspaceEdit.changes) {
						for (const [docUri, textEdits] of Object.entries(workspaceEdit.changes)) {
							for (const edit of textEdits) {
								edits.push({
									resource: this.monaco.Uri.parse(docUri),
									textEdit: {
										range: this.convertRange(edit.range),
										text: edit.newText
									},
									versionId: undefined
								});
							}
						}
					}
					return { edits };
				} catch {
					return null;
				}
			}
		});
	}

	private registerFoldingRangeProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerFoldingRangeProvider('gpc', {
			provideFoldingRanges: async (model) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.foldingRange(uri);
					if (!result) return [];

					const ranges = result as Array<{
						startLine: number;
						startCharacter?: number;
						endLine: number;
						endCharacter?: number;
						kind?: string;
					}>;
					return ranges.map((r) => ({
						start: r.startLine + 1,
						end: r.endLine + 1,
						kind: r.kind ? new this.monaco.languages.FoldingRangeKind(r.kind) : undefined
					}));
				} catch {
					return [];
				}
			}
		});
	}

	private registerInlayHintsProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerInlayHintsProvider('gpc', {
			provideInlayHints: async (model, range) => {
				const uri = pathToUri(model.uri.path);
				try {
					const lspRange: LspRange = {
						start: {
							line: range.startLineNumber - 1,
							character: range.startColumn - 1
						},
						end: {
							line: range.endLineNumber - 1,
							character: range.endColumn - 1
						}
					};
					const result = await this.client.inlayHint(uri, lspRange);
					if (!result) return { hints: [], dispose: () => {} };

					const hints = result as Array<{
						position: { line: number; character: number };
						label: string;
						kind?: number;
						paddingLeft?: boolean;
						paddingRight?: boolean;
					}>;
					return {
						hints: hints.map((h) => ({
							position: {
								lineNumber: h.position.line + 1,
								column: h.position.character + 1
							},
							label: h.label,
							kind: h.kind as Monaco.languages.InlayHintKind,
							paddingLeft: h.paddingLeft,
							paddingRight: h.paddingRight
						})),
						dispose: () => {}
					};
				} catch {
					return { hints: [], dispose: () => {} };
				}
			}
		});
	}

	private registerSemanticTokensProvider(): Monaco.IDisposable {
		const legend: Monaco.languages.SemanticTokensLegend = {
			tokenTypes: ['function', 'variable', 'enumMember', 'parameter'],
			tokenModifiers: ['declaration', 'readonly']
		};

		return this.monaco.languages.registerDocumentSemanticTokensProvider('gpc', {
			getLegend: () => legend,
			provideDocumentSemanticTokens: async (model) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.semanticTokensFull(uri);
					if (!result) return null;

					const tokens = result as {
						resultId?: string;
						data?: number[];
					};
					if (!tokens.data || !Array.isArray(tokens.data)) return null;

					return {
						resultId: tokens.resultId,
						data: new Uint32Array(tokens.data)
					};
				} catch {
					return null;
				}
			},
			releaseDocumentSemanticTokens: () => {}
		});
	}

	private registerCodeLensProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerCodeLensProvider('gpc', {
			provideCodeLenses: async (model) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.codeLens(uri);
					if (!result) return { lenses: [], dispose: () => {} };

					const lenses = result as Array<{
						range: LspRange;
						command?: {
							title: string;
							command: string;
							arguments?: unknown[];
						};
					}>;
					return {
						lenses: lenses.map((lens) => {
							const range = this.convertRange(lens.range);
							if (
								lens.command &&
								lens.command.command === 'editor.action.showReferences' &&
								this.showRefsCommandId
							) {
								return {
									range,
									command: this.buildShowRefsCommand(
										lens.command.title,
										lens.command.arguments,
										model
									)
								};
							}
							return {
								range,
								command: lens.command
									? {
											id: lens.command.command,
											title: lens.command.title,
											arguments: lens.command.arguments
										}
									: undefined
							};
						}),
						dispose: () => {}
					};
				} catch {
					return { lenses: [], dispose: () => {} };
				}
			}
		});
	}

	/**
	 * Build a CodeLens command that populates the References panel
	 * instead of opening Monaco's peek widget.
	 */
	private buildShowRefsCommand(
		title: string,
		args: unknown[] | undefined,
		model: Monaco.editor.ITextModel
	): Monaco.languages.Command {
		const refKey = `codelens-${Date.now()}-${Math.random()}`;

		// Parse locations from the command arguments
		// Typical shape: [uri, position, Location[]]
		let locations: Array<{ uri: string; range: LspRange }> = [];
		if (args && args.length >= 3 && Array.isArray(args[2])) {
			locations = args[2] as Array<{ uri: string; range: LspRange }>;
		} else if (args && args.length >= 1 && Array.isArray(args[0])) {
			// Some LSPs send locations as the first argument
			locations = args[0] as Array<{ uri: string; range: LspRange }>;
		}

		// Determine symbol name from model or fall back to parsing title
		let symbol = '';
		if (locations.length > 0 && locations[0]?.range?.start) {
			symbol =
				model.getWordAtPosition({
					lineNumber: (locations[0].range.start.line ?? 0) + 1,
					column: (locations[0].range.start.character ?? 0) + 1
				})?.word ?? '';
		}
		if (!symbol) {
			// Fall back to extracting symbol from the codelens title
			// (the line where the codelens sits likely defines the symbol)
			const lensLine = model.getLineContent(1);
			const match = lensLine?.match(/\b(\w+)\s*\(/);
			if (match) symbol = match[1];
		}

		let definition: ReferenceLocation | null = null;
		const refs: ReferenceLocation[] = [];

		for (const loc of locations) {
			if (loc && loc.uri && loc.range) {
				const refLoc = this.toLspRefLocation(loc);
				refs.push(refLoc);
			}
		}

		// Try to find the definition among references
		// (the position from the CodeLens args[1] points to the definition)
		if (args && args.length >= 2 && args[1] && typeof args[1] === 'object') {
			const defPos = args[1] as { lineNumber?: number; line?: number; character?: number };
			const defLine = defPos.lineNumber ?? (defPos.line != null ? defPos.line + 1 : 0);
			const defCol = defPos.character != null ? defPos.character + 1 : 1;
			definition = refs.find((r) => r.line === defLine && r.column === defCol) ?? refs[0] ?? null;
		} else if (refs.length > 0) {
			definition = refs[0];
		}

		this.pendingCodeLensRefs.set(refKey, { symbol, definition, references: refs });

		return {
			id: this.showRefsCommandId!,
			title,
			arguments: [refKey]
		};
	}

	private registerDocumentFormattingProvider(): Monaco.IDisposable {
		return this.monaco.languages.registerDocumentFormattingEditProvider('gpc', {
			provideDocumentFormattingEdits: async (model, options) => {
				const uri = pathToUri(model.uri.path);
				try {
					const result = await this.client.documentFormatting(
						uri,
						options.tabSize,
						options.insertSpaces
					);
					if (!result) return [];

					const edits = result as Array<{
						range: LspRange;
						newText: string;
					}>;
					return edits.map((e) => ({
						range: this.convertRange(e.range),
						text: e.newText
					}));
				} catch {
					return [];
				}
			}
		});
	}

	// --- Diagnostics ---

	setDiagnostics(uri: string, diagnostics: LspDiagnostic[]): void {
		const path = uriToPath(uri);
		const models = this.monaco.editor.getModels();

		for (const model of models) {
			if (model.uri.path === path || model.uri.toString() === uri) {
				const markers = diagnostics.map((d) => ({
					severity: SEVERITY_MAP[d.severity || 1] || 8,
					startLineNumber: d.range.start.line + 1,
					startColumn: d.range.start.character + 1,
					endLineNumber: d.range.end.line + 1,
					endColumn: d.range.end.character + 1,
					message: d.message,
					source: d.source || 'GPC'
				}));

				this.monaco.editor.setModelMarkers(model, 'gpc-lsp', markers);
				return;
			}
		}
	}

	// --- Type Conversion ---

	private toLspRefLocation(loc: any): ReferenceLocation {
		const path = uriToPath(loc.uri);
		const line = loc.range.start.line + 1;
		const column = loc.range.start.character + 1;
		const endLine = loc.range.end.line + 1;
		const endColumn = loc.range.end.character + 1;

		let linePreview = '';
		const models = this.monaco.editor.getModels();
		for (const model of models) {
			if (model.uri.path === path || model.uri.toString() === loc.uri) {
				linePreview = model.getLineContent(line).trim();
				break;
			}
		}

		// Fallback: show file basename + line number when model isn't open
		if (!linePreview) {
			const basename = path.split('/').pop() ?? path;
			linePreview = `${basename}:${line}`;
		}

		return { uri: loc.uri, path, line, column, endLine, endColumn, linePreview };
	}

	private convertRange(range: LspRange): Monaco.IRange {
		return {
			startLineNumber: range.start.line + 1,
			startColumn: range.start.character + 1,
			endLineNumber: range.end.line + 1,
			endColumn: range.end.character + 1
		};
	}

	private convertCompletionItem(
		item: any,
		model: Monaco.editor.ITextModel,
		position: Monaco.Position
	): Monaco.languages.CompletionItem {
		const kind = COMPLETION_KIND_MAP[item.kind || 1] || 18;
		const word = model.getWordUntilPosition(position);

		return {
			label: item.label,
			kind,
			detail: item.detail || '',
			documentation: item.documentation
				? typeof item.documentation === 'string'
					? item.documentation
					: { value: item.documentation.value }
				: undefined,
			insertText: item.insertText || item.label,
			range: {
				startLineNumber: position.lineNumber,
				startColumn: word.startColumn,
				endLineNumber: position.lineNumber,
				endColumn: word.endColumn
			}
		};
	}
}
