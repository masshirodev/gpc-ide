import type * as Monaco from 'monaco-editor';
import type { LspClient, LspDiagnostic, LspRange } from './LspClient';

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
    25: 25, // TypeParameter
};

// LSP DiagnosticSeverity → Monaco MarkerSeverity
const SEVERITY_MAP: Record<number, number> = {
    1: 8, // Error
    2: 4, // Warning
    3: 2, // Information
    4: 1, // Hint
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

    constructor(monaco: typeof Monaco, client: LspClient) {
        this.monaco = monaco;
        this.client = client;
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
        ];

        // Register diagnostic handler
        this.client.onDiagnostics((uri, diagnostics) => {
            this.setDiagnostics(uri, diagnostics);
        });
    }

    /** Dispose all registered providers. */
    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
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
                        character: position.column - 1,
                    });
                    if (!result) return { suggestions: [] };

                    // Handle both CompletionList and CompletionItem[]
                    const items = Array.isArray(result)
                        ? result
                        : ((result as { items?: unknown[] }).items || []);

                    const suggestions = (items as any[]).map((item) =>
                        this.convertCompletionItem(item, model, position)
                    );
                    return { suggestions };
                } catch {
                    return { suggestions: [] };
                }
            },
        });
    }

    private registerHoverProvider(): Monaco.IDisposable {
        return this.monaco.languages.registerHoverProvider('gpc', {
            provideHover: async (model, position) => {
                const uri = pathToUri(model.uri.path);
                try {
                    const result = await this.client.hover(uri, {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    });
                    if (!result) return null;

                    const hover = result as {
                        contents: { kind?: string; value: string } | string;
                        range?: LspRange;
                    };

                    const value =
                        typeof hover.contents === 'string'
                            ? hover.contents
                            : hover.contents.value;

                    return {
                        contents: [{ value }],
                        range: hover.range
                            ? this.convertRange(hover.range)
                            : undefined,
                    };
                } catch {
                    return null;
                }
            },
        });
    }

    private registerDefinitionProvider(): Monaco.IDisposable {
        return this.monaco.languages.registerDefinitionProvider('gpc', {
            provideDefinition: async (model, position) => {
                const uri = pathToUri(model.uri.path);
                try {
                    const result = await this.client.definition(uri, {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    });
                    if (!result) return null;

                    const locations = Array.isArray(result) ? result : [result];
                    return locations.map((loc: any) => ({
                        uri: this.monaco.Uri.parse(loc.uri),
                        range: this.convertRange(loc.range),
                    }));
                } catch {
                    return null;
                }
            },
        });
    }

    private registerReferenceProvider(): Monaco.IDisposable {
        return this.monaco.languages.registerReferenceProvider('gpc', {
            provideReferences: async (model, position, context) => {
                const uri = pathToUri(model.uri.path);
                try {
                    const result = await this.client.references(
                        uri,
                        {
                            line: position.lineNumber - 1,
                            character: position.column - 1,
                        },
                        context.includeDeclaration
                    );
                    if (!result) return null;

                    const locations = Array.isArray(result) ? result : [result];
                    return locations.map((loc: any) => ({
                        uri: this.monaco.Uri.parse(loc.uri),
                        range: this.convertRange(loc.range),
                    }));
                } catch {
                    return null;
                }
            },
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
                        character: position.column - 1,
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
                                    documentation: p.documentation,
                                })),
                            })),
                            activeSignature: sigHelp.activeSignature,
                            activeParameter: sigHelp.activeParameter,
                        },
                        dispose: () => {},
                    };
                } catch {
                    return null;
                }
            },
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
                        tags: [],
                    }));
                } catch {
                    return [];
                }
            },
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
                    source: d.source || 'GPC',
                }));

                this.monaco.editor.setModelMarkers(model, 'gpc-lsp', markers);
                return;
            }
        }
    }

    // --- Type Conversion ---

    private convertRange(range: LspRange): Monaco.IRange {
        return {
            startLineNumber: range.start.line + 1,
            startColumn: range.start.character + 1,
            endLineNumber: range.end.line + 1,
            endColumn: range.end.character + 1,
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
                endColumn: word.endColumn,
            },
        };
    }
}
