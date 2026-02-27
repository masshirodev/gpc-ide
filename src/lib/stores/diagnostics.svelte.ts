import type { LspDiagnostic } from '$lib/lsp/LspClient';
import { uriToPath } from '$lib/lsp/MonacoLspBridge';

export interface FileDiagnostics {
	path: string;
	uri: string;
	diagnostics: LspDiagnostic[];
}

interface DiagnosticsStore {
	byUri: Map<string, FileDiagnostics>;
}

let store = $state<DiagnosticsStore>({ byUri: new Map() });

export function getDiagnosticsStore() {
	return store;
}

export function setDiagnostics(uri: string, diagnostics: LspDiagnostic[]) {
	const next = new Map(store.byUri);
	if (diagnostics.length === 0) {
		next.delete(uri);
	} else {
		const path = uriToPath(uri);
		next.set(uri, { path, uri, diagnostics });
	}
	store.byUri = next;
}

export function clearAllDiagnostics() {
	store.byUri = new Map();
}

export function getDiagnosticCounts(byUri: Map<string, FileDiagnostics>) {
	let errors = 0;
	let warnings = 0;
	let infos = 0;
	for (const file of byUri.values()) {
		for (const d of file.diagnostics) {
			const sev = d.severity ?? 1;
			if (sev === 1) errors++;
			else if (sev === 2) warnings++;
			else infos++;
		}
	}
	return { errors, warnings, infos, total: errors + warnings + infos };
}

/** Get a map of file path → worst severity (1=error, 2=warning, 3=info) */
export function getFileSeverityMap(byUri: Map<string, FileDiagnostics>): Map<string, number> {
	const result = new Map<string, number>();
	for (const file of byUri.values()) {
		let worst = Infinity;
		for (const d of file.diagnostics) {
			const sev = d.severity ?? 1;
			if (sev < worst) worst = sev;
		}
		if (worst !== Infinity) {
			result.set(file.path, worst);
		}
	}
	return result;
}

export function getAllDiagnosticsGrouped(byUri: Map<string, FileDiagnostics>): FileDiagnostics[] {
	const files = Array.from(byUri.values());
	// Sort files by most severe diagnostic first
	files.sort((a, b) => {
		const aMin = Math.min(...a.diagnostics.map((d) => d.severity ?? 1));
		const bMin = Math.min(...b.diagnostics.map((d) => d.severity ?? 1));
		return aMin - bMin;
	});
	// Sort diagnostics within each file by line number
	for (const file of files) {
		file.diagnostics.sort((a, b) => a.range.start.line - b.range.start.line);
	}
	return files;
}
