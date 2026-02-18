import { get } from 'svelte/store';
import { LspClient } from '$lib/lsp/LspClient';
import { getSettings } from '$lib/stores/settings.svelte';
import { addLog } from '$lib/stores/logs.svelte';

interface LspStore {
	status: 'stopped' | 'starting' | 'running' | 'error';
	error: string | null;
	workspaceRoot: string | null;
}

let store = $state<LspStore>({
	status: 'stopped',
	error: null,
	workspaceRoot: null
});

let client: LspClient | null = null;

export function getLspStore() {
	return store;
}

export function getLspClient(): LspClient | null {
	return client;
}

export async function startLsp(workspaceRoot: string): Promise<void> {
	// Don't restart if already running for the same workspace
	if (store.status === 'running' && store.workspaceRoot === workspaceRoot) {
		return;
	}

	// Stop existing instance
	if (client) {
		await stopLsp();
	}

	store.status = 'starting';
	store.error = null;
	store.workspaceRoot = workspaceRoot;

	client = new LspClient();
	client.onLog((msg) => {
		console.log('[LSP]', msg);
		addLog('info', 'LSP', msg);
	});

	try {
		const settings = get(getSettings());
		await client.start(workspaceRoot, settings.customLspCommand || undefined);
		store.status = 'running';
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		store.status = 'error';
		store.error = msg;
		addLog('error', 'LSP', `Failed to start: ${msg}`);
		client = null;
	}
}

export async function restartLsp(): Promise<void> {
	const workspaceRoot = store.workspaceRoot;
	if (!workspaceRoot) return;
	await stopLsp();
	await startLsp(workspaceRoot);
}

export async function stopLsp(): Promise<void> {
	if (client) {
		try {
			await client.stop();
		} catch (e) {
			console.error('Error stopping LSP:', e);
		}
		client = null;
	}
	store.status = 'stopped';
	store.error = null;
	store.workspaceRoot = null;
}
