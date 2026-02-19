<script lang="ts">
	import { goto } from '$app/navigation';
	import { getGameStore, gamesByType, loadGames, clearSelection } from '$lib/stores/game.svelte';
	import { selectGame } from '$lib/stores/game.svelte';
	import {
		getEditorStore,
		getActiveTab as getActiveEditorTab,
		openTab,
		openTabAtLine,
		closeTab,
		activateTab,
		updateTabContent,
		saveTab,
		closeAllTabs,
		reloadTab,
		getTab,
		wasRecentlySaved
	} from '$lib/stores/editor.svelte';
	import {
		getUiStore,
		setSidebarCollapsed,
		toggleBottomPanel,
		setBottomPanelOpen,
		setBottomPanelActiveTab,
		consumeFileNavigation
	} from '$lib/stores/ui.svelte';
	import { getLspStore, startLsp, stopLsp, restartLsp, getLspClient } from '$lib/stores/lsp.svelte';
	import { MonacoLspBridge } from '$lib/lsp/MonacoLspBridge';
	import {
		buildGame,
		readFileTree,
		readFile,
		watchDirectory,
		deleteFile,
		deleteGame,
		regenerateFile,
		regenerateAll,
		regeneratePreview,
		regenerateCommit,
		removeModule,
		openInDefaultApp,
		createSnapshot,
		listSnapshots,
		getSnapshot,
		rollbackSnapshot,
		deleteSnapshot,
		renameSnapshot
	} from '$lib/tauri/commands';
	import { onFileChange } from '$lib/tauri/events';
	import type { BuildResult, FileTreeEntry, FileDiff, SnapshotMeta } from '$lib/tauri/commands';
	import type { UnlistenFn } from '@tauri-apps/api/event';
	import { onMount } from 'svelte';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';
	import RecoilTableEditor from '$lib/components/editor/RecoilTableEditor.svelte';
	import KeyboardMapperEditor from '$lib/components/editor/KeyboardMapperEditor.svelte';
	import ConfigEditor from '$lib/components/editor/ConfigEditor.svelte';
	import PersistencePanel from '$lib/components/persistence/PersistencePanel.svelte';
	import AddModuleModal from '$lib/components/modals/AddModuleModal.svelte';
	import NewFileModal from '$lib/components/modals/NewFileModal.svelte';
	import TemplateImportModal from '$lib/components/modals/TemplateImportModal.svelte';
	import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { getRecoilTransfer, clearRecoilTransfer } from '$lib/stores/recoil-transfer.svelte';
	import {
		getKeyboardTransfer,
		clearKeyboardTransfer
	} from '$lib/stores/keyboard-transfer.svelte';
	import { getComboTransfer, clearComboTransfer } from '$lib/stores/combo-transfer.svelte';
	import {
		type KeyMapping,
		parseKeyboardMappings,
		serializeKeyboardMappings
	} from '$lib/utils/keyboard-parser';
	import {
		parseRecoilTable,
		serializeRecoilTable,
		updateWeaponValues
	} from '$lib/utils/recoil-parser';
	import { parseStateScreenText } from '$lib/utils/config-vars';

	let store = getGameStore();
	let editorStore = getEditorStore();
	let ui = getUiStore();
	let lspStore = getLspStore();
	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	// Theme accent colors for tree view
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
	const themeAccents: Record<string, ThemeAccent> = {
		'gpc-dark':         { bg: 'rgba(6, 78, 59, 0.3)',       text: '#34d399',  bgHover: 'rgba(6, 78, 59, 0.2)',       treeBg: '#0c0c0c', treeBorder: '#1f1f1f', treeHover: '#1a1a1a', treeHeaderBg: '#0a0a0a', tabBarBg: '#111111', tabActiveBg: '#0a0a0a', tabInactiveBg: '#111111' },
		'atom-one-dark':    { bg: 'rgba(40, 80, 180, 0.2)',     text: '#528bff',  bgHover: 'rgba(40, 80, 180, 0.15)',    treeBg: '#21252b', treeBorder: '#333842', treeHover: '#2c313c', treeHeaderBg: '#282c34', tabBarBg: '#21252b', tabActiveBg: '#282c34', tabInactiveBg: '#21252b' },
		'monokai':          { bg: 'rgba(166, 226, 46, 0.12)',   text: '#a6e22e',  bgHover: 'rgba(166, 226, 46, 0.08)',   treeBg: '#1e1f1c', treeBorder: '#3b3a32', treeHover: '#3e3d32', treeHeaderBg: '#272822', tabBarBg: '#1e1f1c', tabActiveBg: '#272822', tabInactiveBg: '#1e1f1c' },
		'kanagawa':         { bg: 'rgba(127, 180, 202, 0.15)',  text: '#7fb4ca',  bgHover: 'rgba(127, 180, 202, 0.1)',   treeBg: '#1a1a22', treeBorder: '#2a2a37', treeHover: '#2a2a37', treeHeaderBg: '#1f1f28', tabBarBg: '#1a1a22', tabActiveBg: '#1f1f28', tabInactiveBg: '#1a1a22' },
		'dracula':          { bg: 'rgba(189, 147, 249, 0.15)',  text: '#bd93f9',  bgHover: 'rgba(189, 147, 249, 0.1)',   treeBg: '#21222c', treeBorder: '#44475a', treeHover: '#44475a', treeHeaderBg: '#282a36', tabBarBg: '#21222c', tabActiveBg: '#282a36', tabInactiveBg: '#21222c' },
		'gruvbox-dark':     { bg: 'rgba(184, 187, 38, 0.15)',   text: '#b8bb26',  bgHover: 'rgba(184, 187, 38, 0.1)',    treeBg: '#1d2021', treeBorder: '#3c3836', treeHover: '#3c3836', treeHeaderBg: '#282828', tabBarBg: '#1d2021', tabActiveBg: '#282828', tabInactiveBg: '#1d2021' },
		'nord':             { bg: 'rgba(136, 192, 208, 0.15)',  text: '#88c0d0',  bgHover: 'rgba(136, 192, 208, 0.1)',   treeBg: '#272c36', treeBorder: '#3b4252', treeHover: '#3b4252', treeHeaderBg: '#2e3440', tabBarBg: '#272c36', tabActiveBg: '#2e3440', tabInactiveBg: '#272c36' },
		'catppuccin-mocha': { bg: 'rgba(203, 166, 247, 0.15)',  text: '#cba6f7',  bgHover: 'rgba(203, 166, 247, 0.1)',   treeBg: '#181825', treeBorder: '#313244', treeHover: '#313244', treeHeaderBg: '#1e1e2e', tabBarBg: '#181825', tabActiveBg: '#1e1e2e', tabInactiveBg: '#181825' }
	};
	let themeAccent = $derived(themeAccents[settings.editorTheme] ?? themeAccents['gpc-dark']);

	let grouped = $derived(gamesByType(store.games));
	let types = $derived(Object.keys(grouped).sort());
	let totalGames = $derived(store.games.length);
	let gameConsoleType = $derived(
		(store.selectedGame?.console_type ?? 'ps5') as import('$lib/utils/console-buttons').ConsoleType
	);

	// Active editor tab
	let currentEditorTab = $derived(getActiveEditorTab());

	// Profile state
	let activeProfile = $state(0);
	let profileCount = $derived(store.selectedConfig?.profile_count ?? 0);
	let profileLabels = $derived(store.selectedConfig?.state_screen?.profile_labels ?? []);

	// Build state
	let building = $state(false);
	let regeneratingAll = $state(false);
	let buildResult = $state<BuildResult | null>(null);
	let buildOutputContent = $state<string | null>(null);
	let buildOutputLoading = $state(false);

	// Build diff preview state
	let buildDiffs = $state<FileDiff[]>([]);
	let buildDiffMode = $state(false);
	let buildDiffSelectedFile = $state<number>(0);
	let buildDiffLoading = $state(false);

	// Modal state
	let showAddModuleModal = $state(false);
	let showNewFileModal = $state(false);
	let showTemplateImportModal = $state(false);
	// Confirm dialog state
	let confirmDialog = $state<{
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		variant: 'danger' | 'warning' | 'info';
		onconfirm: () => void;
	}>({
		open: false,
		title: '',
		message: '',
		confirmLabel: 'Confirm',
		variant: 'info',
		onconfirm: () => {}
	});

	function showConfirm(opts: {
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: 'danger' | 'warning' | 'info';
	}): Promise<boolean> {
		return new Promise((resolve) => {
			confirmDialog = {
				open: true,
				title: opts.title,
				message: opts.message,
				confirmLabel: opts.confirmLabel ?? 'Confirm',
				variant: opts.variant ?? 'info',
				onconfirm: () => {
					confirmDialog.open = false;
					resolve(true);
				}
			};
			// Store resolve for cancel path
			confirmDialogCancel = () => {
				confirmDialog.open = false;
				resolve(false);
			};
		});
	}

	let confirmDialogCancel = $state<() => void>(() => {});

	// File tree state
	let fileTree = $state<FileTreeEntry[]>([]);
	let expandedDirs = $state<Set<string>>(new Set());

	// Page tab state
	let activeTab = $state<'overview' | 'files' | 'build' | 'persistence' | 'history'>('overview');

	// History state
	let snapshots = $state<SnapshotMeta[]>([]);
	let snapshotsLoading = $state(false);
	let snapshotPreview = $state<{ id: string; content: string } | null>(null);
	let renamingSnapshotId = $state<string | null>(null);
	let renameLabel = $state('');

	async function loadSnapshots() {
		if (!store.selectedGame) return;
		snapshotsLoading = true;
		try {
			snapshots = await listSnapshots(store.selectedGame.path);
		} catch (e) {
			addToast(`Failed to load snapshots: ${e}`, 'error');
		} finally {
			snapshotsLoading = false;
		}
	}

	async function handleCreateSnapshot() {
		if (!store.selectedGame) return;
		try {
			const meta = await createSnapshot(store.selectedGame.path, 'Manual snapshot');
			addToast('Snapshot created', 'success');
			await loadSnapshots();
		} catch (e) {
			addToast(`Failed to create snapshot: ${e}`, 'error');
		}
	}

	async function handleRollback(snapshotId: string) {
		if (!store.selectedGame) return;
		const confirmed = await showConfirm({
			title: 'Rollback Config',
			message: 'Restore this snapshot? Your current config will be auto-saved first.',
			confirmLabel: 'Rollback',
			variant: 'warning'
		});
		if (!confirmed) return;
		try {
			await rollbackSnapshot(store.selectedGame.path, snapshotId);
			// Reload the game config
			await selectGame(store.selectedGame);
			await loadSnapshots();
			addToast('Config restored from snapshot', 'success');
		} catch (e) {
			addToast(`Rollback failed: ${e}`, 'error');
		}
	}

	async function handleDeleteSnapshot(snapshotId: string) {
		if (!store.selectedGame) return;
		const confirmed = await showConfirm({
			title: 'Delete Snapshot',
			message: 'Delete this snapshot? This cannot be undone.',
			confirmLabel: 'Delete',
			variant: 'danger'
		});
		if (!confirmed) return;
		try {
			await deleteSnapshot(store.selectedGame.path, snapshotId);
			if (snapshotPreview?.id === snapshotId) snapshotPreview = null;
			await loadSnapshots();
			addToast('Snapshot deleted', 'success');
		} catch (e) {
			addToast(`Failed to delete snapshot: ${e}`, 'error');
		}
	}

	async function handlePreviewSnapshot(snapshotId: string) {
		if (!store.selectedGame) return;
		if (snapshotPreview?.id === snapshotId) {
			snapshotPreview = null;
			return;
		}
		try {
			const content = await getSnapshot(store.selectedGame.path, snapshotId);
			snapshotPreview = { id: snapshotId, content };
		} catch (e) {
			addToast(`Failed to load snapshot: ${e}`, 'error');
		}
	}

	async function handleRenameSnapshot(snapshotId: string) {
		if (!store.selectedGame || !renameLabel.trim()) return;
		try {
			await renameSnapshot(store.selectedGame.path, snapshotId, renameLabel.trim());
			renamingSnapshotId = null;
			renameLabel = '';
			await loadSnapshots();
		} catch (e) {
			addToast(`Failed to rename snapshot: ${e}`, 'error');
		}
	}

	function formatSnapshotDate(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	// Track which game we loaded the file tree for to avoid re-loading
	let lastLoadedGamePath = $state<string | null>(null);

	// LSP bridge (registered once when LSP becomes running)
	let bridge: MonacoLspBridge | null = null;
	let currentEditor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;

	// File watcher — debounced refresh
	let fsUnlisten: UnlistenFn | null = null;
	let fsRefreshTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		const setupWatcher = async () => {
			fsUnlisten = await onFileChange((event) => {
				// Debounce file tree refresh (500ms)
				if (fsRefreshTimer) clearTimeout(fsRefreshTimer);
				fsRefreshTimer = setTimeout(() => {
					if (store.selectedGame) {
						refreshFileTree(store.selectedGame.path);
					}
				}, 500);

				// Auto-reload open tabs when files are modified externally
				if (event.kind === 'modify' && event.paths) {
					for (const changedPath of event.paths) {
						// Skip files we just saved ourselves
						if (wasRecentlySaved(changedPath)) continue;

						const tab = getTab(changedPath);
						if (tab) {
							if (tab.dirty) {
								// Tab has local changes — ask user
								showConfirm({
									title: 'File Changed',
									message: `"${tab.name}" was modified externally. Reload and discard local changes?`,
									confirmLabel: 'Reload',
									variant: 'warning'
								}).then((confirmed) => {
									if (confirmed) reloadTab(changedPath);
								});
							} else {
								// No local changes — reload silently
								reloadTab(changedPath);
							}
						}
					}
				}
			});
		};
		setupWatcher();

		return () => {
			fsUnlisten?.();
			if (fsRefreshTimer) clearTimeout(fsRefreshTimer);
		};
	});

	async function refreshFileTree(gamePath: string) {
		try {
			const newTree = await readFileTree(gamePath);
			fileTree = newTree;
			// Keep existing expanded dirs (don't reset on refresh)
		} catch (e) {
			console.error('Failed to refresh file tree:', e);
		}
	}

	// Auto-collapse sidebar when switching to files tab
	$effect(() => {
		if (activeTab === 'files') {
			setSidebarCollapsed(true);
		}
	});

	// Load snapshots when history tab is selected
	$effect(() => {
		if (activeTab === 'history' && store.selectedGame) {
			loadSnapshots();
		}
	});

	// Load file tree and start LSP when a game is selected
	$effect(() => {
		const game = store.selectedGame;
		if (game && game.path !== lastLoadedGamePath) {
			lastLoadedGamePath = game.path;
			loadFileTree(game.path);
			buildResult = null;
			buildOutputContent = null;
			closeAllTabs();
			activeTab = 'overview';
			// Dispose old LSP bridge and start LSP for new game
			if (bridge) {
				bridge.dispose();
				bridge = null;
			}
			startLsp(game.path);
			watchDirectory(game.path).catch((e) => console.warn('File watcher setup failed:', e));
		}
	});

	// Register MonacoLspBridge when LSP becomes running
	$effect(() => {
		if (lspStore.status === 'running' && !bridge) {
			initLspBridge();
		} else if (lspStore.status !== 'running' && bridge) {
			bridge.dispose();
			bridge = null;
		}
	});

	async function initLspBridge() {
		const monacoModule = await import('monaco-editor');
		const client = getLspClient();
		if (client) {
			bridge = new MonacoLspBridge(monacoModule, client);
			bridge.registerProviders();
			if (currentEditor) bridge.setEditor(currentEditor);
		}
	}

	function handleEditorReady(editor: import('monaco-editor').editor.IStandaloneCodeEditor) {
		currentEditor = editor;
		if (bridge) bridge.setEditor(editor);

		editor.addAction({
			id: 'gpc.lsp.restart',
			label: 'GPC: Restart Language Server',
			run: () => {
				restartLsp();
			}
		});

		editor.addAction({
			id: 'gpc.lsp.stop',
			label: 'GPC: Stop Language Server',
			run: () => {
				stopLsp();
			}
		});
	}

	async function loadFileTree(gamePath: string) {
		try {
			fileTree = await readFileTree(gamePath);
			// Auto-expand all top-level directories
			expandedDirs = new Set(fileTree.filter((e) => e.is_dir).map((e) => e.path));
		} catch (e) {
			console.error('Failed to load file tree:', e);
		}
	}

	async function handleRegenerateAll() {
		if (!store.selectedGame || regeneratingAll) return;

		const confirmed = await showConfirm({
			title: 'Regenerate',
			message:
				'Regenerate all generated files? Any custom changes to module files, core.gpc, and main.gpc will be lost.',
			confirmLabel: 'Regenerate',
			variant: 'warning'
		});
		if (!confirmed) return;

		regeneratingAll = true;
		try {
			const files = await regenerateAll(store.selectedGame.path);
			addToast(`Regenerated ${files.length} file(s)`, 'success');
			await loadFileTree(store.selectedGame.path);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Regenerate failed: ${msg}`, 'error');
		} finally {
			regeneratingAll = false;
		}
	}

	function getWorkspaceForGame(gamePath: string): string | undefined {
		return settings.workspaces.find((ws) => gamePath.startsWith(ws));
	}

	async function handleBuild(autoBuild = true) {
		if (!store.selectedGame || building) return;
		buildDiffLoading = true;
		buildResult = null;
		buildOutputContent = null;
		buildDiffs = [];
		buildDiffMode = false;
		buildDiffSelectedFile = 0;
		try {
			const diffs = await regeneratePreview(store.selectedGame.path);
			if (diffs.length === 0) {
				if (autoBuild) {
					// No changes needed, proceed directly to build
					await executeBuild();
				} else {
					addToast('No file changes detected', 'info');
				}
			} else {
				buildDiffs = diffs;
				buildDiffMode = true;
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Build preview error: ${msg}`, 'error');
		} finally {
			buildDiffLoading = false;
		}
	}

	function handleBuildCancel() {
		buildDiffMode = false;
		buildDiffs = [];
		buildDiffSelectedFile = 0;
	}

	async function handleBuildCommit() {
		if (!store.selectedGame) return;
		buildDiffMode = false;
		try {
			const files = buildDiffs.map((d) => ({ path: d.path, content: d.new_content }));
			const written = await regenerateCommit(store.selectedGame.path, files);
			addToast(`Regenerated ${written.length} file(s)`, 'success');
			await loadFileTree(store.selectedGame.path);
			buildDiffs = [];
			buildDiffSelectedFile = 0;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Commit failed: ${msg}`, 'error');
			return;
		}
		await executeBuild();
	}

	async function executeBuild() {
		if (!store.selectedGame) return;
		building = true;
		try {
			const workspacePath = getWorkspaceForGame(store.selectedGame.path);
			buildResult = await buildGame(store.selectedGame.path, workspacePath);
			if (buildResult.success && buildResult.output_path) {
				const fileName = buildResult.output_path.split('/').pop() || 'output';
				addToast(`Build succeeded: ${fileName}`, 'success');
				buildOutputLoading = true;
				try {
					buildOutputContent = await readFile(buildResult.output_path);
				} catch {
					buildOutputContent = null;
				} finally {
					buildOutputLoading = false;
				}
			} else if (!buildResult.success) {
				addToast(`Build failed with ${buildResult.errors.length} error(s)`, 'error');
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Build error: ${msg}`, 'error');
			buildResult = {
				output_path: '',
				success: false,
				errors: [msg],
				warnings: []
			};
		} finally {
			building = false;
		}
	}

	function handleFileClick(path: string) {
		openTab(path);
	}

	function canDeleteFile(path: string): boolean {
		// Check if file is in modules/ directory
		if (path.includes('/modules/') || path.includes('\\modules\\')) {
			return false;
		}

		// Only config.toml is protected
		const filename = path.split('/').pop() || '';
		if (filename === 'config.toml') {
			return false;
		}

		return true;
	}

	async function handleDeleteFile(e: MouseEvent, path: string) {
		e.stopPropagation();

		if (
			!(await showConfirm({
				title: 'Delete File',
				message: `Are you sure you want to delete ${path.split('/').pop()}?`,
				confirmLabel: 'Delete',
				variant: 'danger'
			}))
		) {
			return;
		}

		try {
			await deleteFile(path);
			addToast('File deleted successfully', 'success');
			if (store.selectedGame) {
				await loadFileTree(store.selectedGame.path);
			}
			// Close tab if it's open
			closeTab(path);
		} catch (e) {
			addToast(`Failed to delete file: ${e}`, 'error');
		}
	}

	async function handleDeleteGameFromDashboard(
		e: MouseEvent,
		game: import('$lib/types/config').GameSummary
	) {
		e.stopPropagation();
		if (
			!(await showConfirm({
				title: 'Delete Game',
				message: `Delete "${game.name}"? This will permanently delete all files in the game directory.`,
				confirmLabel: 'Delete',
				variant: 'danger'
			}))
		) {
			return;
		}
		try {
			await deleteGame(game.path);
			if (store.selectedGame?.path === game.path) {
				clearSelection();
			}
			await loadGames(settings.workspaces);
			addToast(`Game "${game.name}" deleted`, 'success');
		} catch (e) {
			addToast(`Failed to delete game: ${e}`, 'error');
		}
	}

	async function handleRemoveModule(index: number, name: string) {
		if (!store.selectedGame) return;

		const confirmed = await showConfirm({
			title: 'Remove Module',
			message: `Remove "${name}" from this game? This will delete the menu item, module parameters, and associated module file.`,
			confirmLabel: 'Remove',
			variant: 'danger'
		});
		if (!confirmed) return;

		try {
			const result = await removeModule(store.selectedGame.path, index);
			addToast(`Module removed (${result.length} files affected)`, 'success');
			await selectGame(store.selectedGame);
			await loadFileTree(store.selectedGame.path);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Failed to remove module: ${msg}`, 'error');
		}
	}

	function canRegenerateFile(path: string): boolean {
		const regenerable = [
			'/modules/core.gpc',
			'/main.gpc',
			'/define.gpc',
			'/menu.gpc',
			'/setting.gpc',
			'/persistence.gpc'
		];

		return (
			regenerable.some((pattern) => path.endsWith(pattern)) ||
			(path.includes('/modules/') && path.endsWith('.gpc') && !path.endsWith('/core.gpc'))
		);
	}

	let regenerating = $state(false);
	let regenFileDiff = $state<FileDiff | null>(null);
	let regenFileLoading = $state(false);
	let regenDiffLines = $derived(
		regenFileDiff
			? computeLineDiff(regenFileDiff.old_content.split('\n'), regenFileDiff.new_content.split('\n'))
			: []
	);

	async function handleRegenerateFile() {
		if (!currentEditorTab || !store.selectedGame || regenerating || regenFileLoading) return;

		try {
			regenFileLoading = true;
			const filePath = currentEditorTab.path;
			const diffs = await regeneratePreview(store.selectedGame.path);
			const diff = diffs.find((d) => filePath.endsWith(d.path) || d.path.endsWith(filePath.split('/').slice(-2).join('/')));

			if (!diff) {
				addToast('No changes detected for this file', 'info');
				return;
			}

			regenFileDiff = diff;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Failed to preview regeneration: ${msg}`, 'error');
		} finally {
			regenFileLoading = false;
		}
	}

	function handleRegenCancel() {
		regenFileDiff = null;
	}

	async function handleRegenCommit() {
		if (!regenFileDiff || !store.selectedGame) return;

		try {
			regenerating = true;
			const files = [{ path: regenFileDiff.path, content: regenFileDiff.new_content }];
			await regenerateCommit(store.selectedGame.path, files);

			const filePath = regenFileDiff.path;
			regenFileDiff = null;

			// Reload the tab if open
			const fullPath = `${store.selectedGame.path}/${filePath}`;
			const tab = getTab(fullPath);
			if (tab) {
				closeTab(fullPath);
				await openTab(fullPath);
			}
			await loadFileTree(store.selectedGame.path);

			addToast('File regenerated successfully', 'success');
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Failed to regenerate: ${msg}`, 'error');
		} finally {
			regenerating = false;
		}
	}

	function toggleDir(path: string) {
		const next = new Set(expandedDirs);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		expandedDirs = next;
	}

	function getLanguageForFile(path: string): string {
		if (path.endsWith('.gpc')) return 'gpc';
		if (path.endsWith('.toml')) return 'ini';
		if (path.endsWith('.json')) return 'json';
		return 'plaintext';
	}

	// --- Build error → editor navigation ---

	function getFileIconColor(name: string): string {
		const ext = name.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'gpc':
				return 'text-emerald-400';
			case 'toml':
				return 'text-amber-400';
			case 'txt':
			case 'md':
				return 'text-blue-400';
			case 'json':
				return 'text-yellow-400';
			default:
				return 'text-zinc-500';
		}
	}

	interface BuildErrorLink {
		path: string;
		line?: number;
	}

	function parseBuildErrorLink(error: string): BuildErrorLink | null {
		// "Referenced from: /path/to/file:123"
		const refMatch = error.match(/Referenced from:\s*(.+):(\d+)$/);
		if (refMatch) return { path: refMatch[1], line: parseInt(refMatch[2]) };

		// "File not found: /path/to/file"
		const notFoundMatch = error.match(/File not found:\s*(.+)$/);
		if (notFoundMatch) return { path: notFoundMatch[1] };

		// "Could not read /path/to/file: ..."
		const readMatch = error.match(/Could not read\s+(.+?):\s/);
		if (readMatch) return { path: readMatch[1] };

		return null;
	}

	let editorComponent = $state<MonacoEditor>();

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
		(currentEditorTab?.path.endsWith('recoiltable.gpc') ||
			currentEditorTab?.path.endsWith('keyboard.gpc')) ??
			false
	);
	let isKeyboardFile = $derived(currentEditorTab?.path.endsWith('keyboard.gpc') ?? false);

	// Check if current file is config.toml
	let isConfigFile = $derived(currentEditorTab?.path.endsWith('config.toml') ?? false);

	// Handle return from spray tool — apply updated values
	onMount(() => {
		const transfer = getRecoilTransfer();
		if (transfer?.returnTo) {
			const filePath = transfer.returnTo;
			const weaponIndex = transfer.weaponIndex;
			const newValues = transfer.values;
			clearRecoilTransfer();

			// Open the file and apply the values
			openTab(filePath).then(() => {
				activeTab = 'files';
				const tab = editorStore.tabs.find((t) => t.path === filePath);
				if (tab) {
					const entries = parseRecoilTable(tab.content);
					const updated = updateWeaponValues(entries, weaponIndex, newValues);
					const newContent = serializeRecoilTable(tab.content, updated);
					updateTabContent(filePath, newContent);
					addToast(`Applied recoil values for weapon #${weaponIndex}`, 'success');
				}
			});
		}

		// Handle return from keyboard mapper tool — apply updated mappings
		const kbTransfer = getKeyboardTransfer();
		if (kbTransfer?.returnTo) {
			const filePath = kbTransfer.returnTo;
			const newMappings = kbTransfer.mappings;
			clearKeyboardTransfer();

			openTab(filePath).then(() => {
				activeTab = 'files';
				const tab = editorStore.tabs.find((t) => t.path === filePath);
				if (tab) {
					const newContent = serializeKeyboardMappings(tab.content, newMappings);
					updateTabContent(filePath, newContent);
					addToast(`Applied ${newMappings.length} keyboard mapping(s)`, 'success');
				}
			});
		}

		// Handle return from combo editor — write combo GPC file into game
		const comboTransfer = getComboTransfer();
		if (comboTransfer?.returnTo && store.selectedGame?.path === comboTransfer.returnTo) {
			clearComboTransfer();
			const fileName = `${comboTransfer.comboName}.gpc`;
			const filePath = `${comboTransfer.returnTo}/${fileName}`;

			// Write the combo file
			import('$lib/tauri/commands').then(async ({ writeFile }) => {
				const header = `// ${fileName}\n// Generated by Combo Maker\n\n`;
				await writeFile(filePath, header + comboTransfer.gpcCode);
				await loadFileTree(comboTransfer.returnTo!);
				openTab(filePath).then(() => {
					activeTab = 'files';
				});
				addToast(`Combo "${comboTransfer.comboName}" added to game`, 'success');
			}).catch((e) => {
				addToast(`Failed to write combo: ${e}`, 'error');
			});
		}
	});

	async function handleBuildErrorClick(error: string) {
		const link = parseBuildErrorLink(error);
		if (!link) return;

		activeTab = 'files';
		if (link.line !== undefined) {
			if (editorStore.activeTabPath === link.path) {
				editorComponent?.revealLine(link.line);
			} else {
				await openTabAtLine(link.path, link.line);
			}
		} else {
			await openTab(link.path);
		}
	}

	async function handleOpenExternal() {
		if (!currentEditorTab) return;
		try {
			await openInDefaultApp(currentEditorTab.path);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Failed to open external editor: ${msg}`, 'error');
		}
	}

	// Simple line diff for build preview
	interface DiffLine {
		type: 'context' | 'added' | 'removed';
		text: string;
		oldNum?: number;
		newNum?: number;
	}

	function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
		// Myers-like diff using LCS for reasonable performance
		const result: DiffLine[] = [];
		const n = oldLines.length;
		const m = newLines.length;

		// For very large files, use a simplified approach
		if (n + m > 10000) {
			// Just show all old as removed, all new as added
			for (let i = 0; i < n; i++) {
				result.push({ type: 'removed', text: oldLines[i], oldNum: i + 1 });
			}
			for (let i = 0; i < m; i++) {
				result.push({ type: 'added', text: newLines[i], newNum: i + 1 });
			}
			return result;
		}

		// Simple O(nm) LCS-based diff
		const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
		for (let i = 1; i <= n; i++) {
			for (let j = 1; j <= m; j++) {
				if (oldLines[i - 1] === newLines[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1] + 1;
				} else {
					dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
				}
			}
		}

		// Backtrack to build diff
		const lines: DiffLine[] = [];
		let i = n,
			j = m;
		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
				lines.push({ type: 'context', text: oldLines[i - 1], oldNum: i, newNum: j });
				i--;
				j--;
			} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
				lines.push({ type: 'added', text: newLines[j - 1], newNum: j });
				j--;
			} else {
				lines.push({ type: 'removed', text: oldLines[i - 1], oldNum: i });
				i--;
			}
		}

		return lines.reverse();
	}

	async function handleCopyBuildOutput() {
		if (!buildOutputContent) return;
		try {
			await navigator.clipboard.writeText(buildOutputContent);
			addToast('Build output copied to clipboard', 'success');
		} catch {
			addToast('Failed to copy to clipboard', 'error');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			saveTab();
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			activeTab = 'build';
			handleBuild(false);
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
			e.preventDefault();
			toggleBottomPanel();
		}
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
			e.preventDefault();
			setBottomPanelActiveTab('search');
			setBottomPanelOpen(true);
		}
	}

	// Watch for file navigation requests from the bottom panel (Problems/Search tabs)
	$effect(() => {
		const nav = consumeFileNavigation();
		if (nav && store.selectedGame) {
			activeTab = 'files';
			if (editorStore.activeTabPath === nav.path) {
				editorComponent?.revealLine(nav.line);
			} else {
				openTabAtLine(nav.path, nav.line);
			}
		}
	});

	function handleCloseTab(e: MouseEvent, path: string) {
		e.stopPropagation();
		closeTab(path);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if store.selectedGame && store.selectedConfig}
	<!-- Game Detail View -->
	<div
		class={activeTab === 'files' ? 'flex h-full flex-col overflow-hidden' : 'mx-auto max-w-5xl p-6'}
	>
		<div class="mb-4 flex items-center justify-between {activeTab === 'files' ? 'px-4 pt-3' : ''}">
			<div>
				<h1 class="text-2xl font-bold text-zinc-100">{store.selectedGame.name}</h1>
				<p class="text-sm text-zinc-400">
					{parseStateScreenText(store.selectedConfig.state_screen.title, store.selectedConfig)}
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if store.selectedGame.game_type}
					<button
						class="cursor-pointer rounded bg-emerald-900/50 px-2 py-1 text-xs font-medium text-emerald-400 uppercase transition-colors hover:bg-emerald-900/70"
						onclick={() => {
							if (store.selectedGame) {
								const configPath = `${store.selectedGame.path}/config.toml`;
								openTab(configPath);
								activeTab = 'files';
								configSubTab = 'gui';
							}
						}}
						title="Click to edit in Config GUI"
					>
						{store.selectedGame.game_type}
					</button>
				{/if}
				<button
					class="cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700"
					onclick={() => {
						if (store.selectedGame) {
							const configPath = `${store.selectedGame.path}/config.toml`;
							openTab(configPath);
							activeTab = 'files';
							configSubTab = 'gui';
						}
					}}
					title="Click to edit in Config GUI"
				>
					v{store.selectedConfig.version}
				</button>
			</div>
		</div>

		<!-- Tab Bar -->
		<div class="mb-4 flex gap-1 border-b border-zinc-800 {activeTab === 'files' ? 'px-4' : ''}">
			{#each ['overview', 'files', 'persistence', 'build', 'history'] as tab}
				<button
					class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
					class:border-emerald-400={activeTab === tab}
					class:text-emerald-400={activeTab === tab}
					class:border-transparent={activeTab !== tab}
					class:text-zinc-400={activeTab !== tab}
					class:hover:text-zinc-200={activeTab !== tab}
					onclick={() => (activeTab = tab as typeof activeTab)}
				>
					{tab === 'overview'
						? 'Overview'
						: tab === 'files'
							? 'Files'
							: tab === 'build'
								? 'Build'
								: tab === 'history'
									? 'History'
									: 'Persistence'}
					{#if tab === 'build' && buildResult}
						<span
							class="ml-1 inline-block h-2 w-2 rounded-full"
							class:bg-emerald-400={buildResult.success}
							class:bg-red-400={!buildResult.success}
						></span>
					{/if}
				</button>
			{/each}
		</div>

		{#if profileCount > 0}
			<!-- Profile Selector -->
			<div class="mb-4 flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
				<span class="text-xs font-medium text-zinc-500">Profile:</span>
				<div class="flex gap-1">
					{#each Array.from({ length: profileCount }, (_, i) => i) as i}
						<button
							class="rounded px-3 py-1 text-xs font-medium transition-colors {activeProfile === i ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"
							onclick={() => (activeProfile = i)}
						>
							{profileLabels[i] ?? `Profile ${i + 1}`}
						</button>
					{/each}
				</div>
				<span class="text-xs text-zinc-600">
					Profile-aware settings will use index [{activeProfile}]
				</span>
			</div>
		{/if}

		{#if activeTab === 'overview'}
			<!-- Config Overview Cards -->
			<div class="grid grid-cols-2 gap-4">
				<!-- Menu Items -->
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
							Menu Items ({store.selectedConfig.menu.length})
						</h2>
						<div class="flex gap-2">
							<button
								class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
								onclick={() => (showAddModuleModal = true)}
							>
								+ Add Module
							</button>
							<button
								class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
								onclick={() => goto('/tools/modules')}
							>
								Module Manager
							</button>
						</div>
					</div>
					<div class="space-y-2">
						{#each store.selectedConfig.menu as item, index}
							<div class="group flex items-center gap-1 rounded bg-zinc-800/50 transition-colors hover:bg-zinc-700/50">
								<button
									class="flex flex-1 cursor-pointer items-center justify-between px-3 py-2"
									onclick={() => {
										if (store.selectedGame) {
											const configPath = `${store.selectedGame.path}/config.toml`;
											openTab(configPath);
											activeTab = 'files';
											configSubTab = 'gui';
										}
									}}
								>
									<span class="text-sm text-zinc-200">{item.name}</span>
									<div class="flex items-center gap-2">
										{#if item.profile_aware && profileCount > 0}
											<span class="rounded bg-blue-900/50 px-1.5 py-0.5 text-xs text-blue-400" title="This setting is per-profile">P</span>
										{/if}
										<span class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
											{item.type}
										</span>
										{#if item.state_display}
											<span class="text-xs text-zinc-500">{item.state_display}</span>
										{/if}
									</div>
								</button>
								<button
									class="mr-2 rounded p-1 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
									onclick={(e) => {
										e.stopPropagation();
										handleRemoveModule(index, item.name);
									}}
									title="Remove module"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</div>

				<!-- Button Mappings -->
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
						Button Mappings
					</h2>
					<div class="space-y-1.5">
						{#each Object.entries(store.selectedConfig.buttons) as [key, value]}
							<button
								class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-800/30"
								onclick={() => {
									if (store.selectedGame) {
										const configPath = `${store.selectedGame.path}/config.toml`;
										openTab(configPath);
										activeTab = 'files';
										configSubTab = 'gui';
									}
								}}
							>
								<span class="text-zinc-400">{key.replace(/_/g, ' ')}</span>
								<code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">{value}</code
								>
							</button>
						{/each}
					</div>

					{#if Object.keys(store.selectedConfig.keyboard).length > 0}
						<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
							Keyboard Shortcuts
						</h2>
						<div class="space-y-1.5">
							{#each Object.entries(store.selectedConfig.keyboard) as [key, value]}
								<button
									class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-800/30"
									onclick={() => {
										if (store.selectedGame) {
											const configPath = `${store.selectedGame.path}/config.toml`;
											openTab(configPath);
											activeTab = 'files';
											configSubTab = 'gui';
										}
									}}
								>
									<span class="text-zinc-400">{key.replace(/_/g, ' ')}</span>
									<code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-amber-400">{value}</code
									>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- File Path -->
			<div
				class="mt-4 rounded border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500"
			>
				{store.selectedGame.path}
			</div>
		{:else if activeTab === 'files'}
			<!-- File Browser - Full Width -->
			<div class="flex min-h-0 flex-1 gap-0">
				<!-- File Tree -->
				<div class="file-tree flex w-52 shrink-0 flex-col" style="background: {themeAccent.treeBg}; border-right: 1px solid {themeAccent.treeBorder}; --tree-hover: {themeAccent.treeHover}; --tree-border: {themeAccent.treeBorder}">
					<!-- File Tree Header -->
					<div class="p-2" style="border-bottom: 1px solid {themeAccent.treeBorder}; background: {themeAccent.treeHeaderBg}">
						<div class="flex gap-1">
							<button
								class="flex-1 rounded border border-emerald-600/50 bg-emerald-600/10 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:border-emerald-500 hover:bg-emerald-600/20"
								onclick={() => (showAddModuleModal = true)}
								title="Add Module"
							>
								+
							</button>
							<button
								class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700"
								onclick={() => (showNewFileModal = true)}
								title="New File"
							>
								📄
							</button>
							<button
								class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700"
								onclick={() => (showTemplateImportModal = true)}
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
										onclick={() => toggleDir(entry.path)}
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
														onclick={() => toggleDir(child.path)}
													>
														<svg class="h-3.5 w-3.5 shrink-0 text-amber-500/70" fill="currentColor" viewBox="0 0 20 20">
															{#if expandedDirs.has(child.path)}
																<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H8.586A2 2 0 006.9 9.7L2 14V6z" />
																<path fill-rule="evenodd" d="M4 9.5a.5.5 0 01.5-.42h13a.5.5 0 01.49.58l-1.33 8a.5.5 0 01-.49.42H3.33a.5.5 0 01-.49-.58L4 9.5z" clip-rule="evenodd" />
															{:else}
																<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2-2V6z" />
															{/if}
														</svg>
														{child.name}
													</button>
													{#if expandedDirs.has(child.path) && child.children}
														{#each child.children as grandchild}
															{#if !grandchild.is_dir}
																<div
																	class="tree-item group flex items-center rounded"
																	style={editorStore.activeTabPath === grandchild.path ? `background: ${themeAccent.bg}` : ''}
																>
																	<button
																		class="flex flex-1 items-center gap-1.5 py-0.5 pr-2 pl-6 text-left text-xs {editorStore.activeTabPath === grandchild.path ? '' : 'text-zinc-300'}"
																		style={editorStore.activeTabPath === grandchild.path ? `color: ${themeAccent.text}` : ''}
																		onclick={() => handleFileClick(grandchild.path)}
																	>
																		<svg class="h-3 w-3 shrink-0 {editorStore.activeTabPath === grandchild.path ? '' : getFileIconColor(grandchild.name)}" style={editorStore.activeTabPath === grandchild.path ? `color: ${themeAccent.text}` : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																		</svg>
																		{grandchild.name}
																	</button>
																	{#if canDeleteFile(grandchild.path)}
																		<button
																			class="p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
																			onclick={(e) => handleDeleteFile(e, grandchild.path)}
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
													style={editorStore.activeTabPath === child.path ? `background: ${themeAccent.bg}` : ''}
												>
													<button
														class="flex flex-1 items-center gap-1.5 py-0.5 pr-2 pl-5 text-left text-xs {editorStore.activeTabPath === child.path ? '' : 'text-zinc-300'}"
														style={editorStore.activeTabPath === child.path ? `color: ${themeAccent.text}` : ''}
														onclick={() => handleFileClick(child.path)}
													>
														<svg class="h-3 w-3 shrink-0 {editorStore.activeTabPath === child.path ? '' : getFileIconColor(child.name)}" style={editorStore.activeTabPath === child.path ? `color: ${themeAccent.text}` : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
															<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
														</svg>
														{child.name}
													</button>
													{#if canDeleteFile(child.path)}
														<button
															class="p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
															onclick={(e) => handleDeleteFile(e, child.path)}
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
									style={editorStore.activeTabPath === entry.path ? `background: ${themeAccent.bg}` : ''}
								>
									<button
										class="flex flex-1 items-center gap-1.5 px-2 py-0.5 text-left text-xs {editorStore.activeTabPath === entry.path ? '' : 'text-zinc-300'}"
										style={editorStore.activeTabPath === entry.path ? `color: ${themeAccent.text}` : ''}
										onclick={() => handleFileClick(entry.path)}
									>
										<svg class="h-3 w-3 shrink-0 {editorStore.activeTabPath === entry.path ? '' : getFileIconColor(entry.name)}" style={editorStore.activeTabPath === entry.path ? `color: ${themeAccent.text}` : ''} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
										{entry.name}
									</button>
									{#if canDeleteFile(entry.path)}
										<button
											class="p-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
											onclick={(e) => handleDeleteFile(e, entry.path)}
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

				<!-- Editor Panel -->
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
												handleCloseTab(e, tab.path);
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
											onclick={(e) => handleCloseTab(e, tab.path)}
										>
											✕
										</span>
									</button>
								{/each}
							</div>
							<div class="flex shrink-0 items-center gap-2 px-2">
								{#if currentEditorTab}
									<button
										class="p-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
										onclick={handleOpenExternal}
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
								{#if currentEditorTab && canRegenerateFile(currentEditorTab.path)}
									<button
										class="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
										onclick={handleRegenerateFile}
										disabled={regenerating || regenFileLoading}
										title="Regenerate this file from config.toml"
									>
										{regenFileLoading ? 'Loading diff...' : regenerating ? 'Regenerating...' : 'Regenerate'}
									</button>
								{/if}
								{#if currentEditorTab?.dirty}
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
						{#if currentEditorTab}
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

							<div class="flex-1 overflow-hidden">
								{#if hasVisualEditor && editorSubTab === 'visual' && isKeyboardFile}
									{#key editorStore.activeTabPath}
										<KeyboardMapperEditor
											content={currentEditorTab.content}
											gamePath={store.selectedGame?.path ?? ''}
											filePath={currentEditorTab.path}
											consoleType={gameConsoleType}
											onchange={(v) => {
												if (editorStore.activeTabPath) {
													updateTabContent(editorStore.activeTabPath, v);
												}
											}}
										/>
									{/key}
								{:else if hasVisualEditor && editorSubTab === 'visual'}
									{#key editorStore.activeTabPath}
										<RecoilTableEditor
											content={currentEditorTab.content}
											gamePath={store.selectedGame?.path ?? ''}
											filePath={currentEditorTab.path}
											onchange={(v) => {
												if (editorStore.activeTabPath) {
													updateTabContent(editorStore.activeTabPath, v);
												}
											}}
										/>
									{/key}
								{:else if isConfigFile && configSubTab === 'gui'}
									{#key editorStore.activeTabPath}
										<ConfigEditor gamePath={store.selectedGame?.path ?? ''} />
									{/key}
								{:else}
									{#key editorStore.activeTabPath}
										<MonacoEditor
											bind:this={editorComponent}
											value={currentEditorTab.content}
											language={getLanguageForFile(currentEditorTab.path)}
											filePath={currentEditorTab.path}
											onchange={(v) => {
												if (editorStore.activeTabPath) {
													updateTabContent(editorStore.activeTabPath, v);
												}
											}}
											onready={handleEditorReady}
										/>
									{/key}
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
			</div>
		{:else if activeTab === 'build'}
			<!-- Build Panel -->
			<div class="space-y-4">
				<div class="flex items-center gap-3">
					{#if buildDiffMode}
						<button
							class="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
							onclick={handleBuildCancel}
						>
							Cancel
						</button>
						<button
							class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
							onclick={handleBuildCommit}
						>
							Commit & Build
						</button>
						<span class="text-sm text-amber-400">
							{buildDiffs.length} file{buildDiffs.length !== 1 ? 's' : ''} changed
						</span>
					{:else}
						<button
							class="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
							onclick={handleRegenerateAll}
							disabled={regeneratingAll}
						>
							{regeneratingAll ? 'Regenerating...' : 'Regenerate'}
						</button>
						<button
							class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
							onclick={() => handleBuild()}
							disabled={building || buildDiffLoading}
						>
							{buildDiffLoading ? 'Checking...' : building ? 'Building...' : 'Build Game'}
						</button>
						{#if buildResult}
							<span
								class="text-sm"
								class:text-emerald-400={buildResult.success}
								class:text-red-400={!buildResult.success}
							>
								{buildResult.success ? 'Build succeeded' : 'Build failed'}
							</span>
						{/if}
					{/if}
				</div>

				{#if buildDiffMode}
					<!-- Diff Preview -->
					<div class="overflow-hidden rounded-lg border border-zinc-800">
						<!-- File tabs -->
						<div class="flex gap-0 overflow-x-auto border-b border-zinc-800 bg-zinc-900/80">
							{#each buildDiffs as diff, i}
								<button
									class="whitespace-nowrap border-r border-zinc-800 px-3 py-2 text-xs transition-colors {buildDiffSelectedFile === i ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}"
									onclick={() => (buildDiffSelectedFile = i)}
								>
									{diff.path}
								</button>
							{/each}
						</div>
						<!-- Diff content -->
						{#if buildDiffs[buildDiffSelectedFile]}
							{@const diffLines = computeLineDiff(
								buildDiffs[buildDiffSelectedFile].old_content.split('\n'),
								buildDiffs[buildDiffSelectedFile].new_content.split('\n')
							)}
							<div class="max-h-[600px] overflow-auto bg-zinc-950 p-0 font-mono text-xs">
								<table class="w-full border-collapse">
									{#each diffLines as line}
										<tr class={line.type === 'removed' ? 'bg-red-950/40' : line.type === 'added' ? 'bg-emerald-950/40' : ''}>
											<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
												{line.oldNum ?? ''}
											</td>
											<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
												{line.newNum ?? ''}
											</td>
											<td class="select-none px-1 py-0 {line.type === 'removed' ? 'text-red-500' : line.type === 'added' ? 'text-emerald-500' : 'text-zinc-700'}" style="width: 1rem">
												{line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
											</td>
											<td class="whitespace-pre py-0 pr-4 {line.type === 'removed' ? 'text-red-300/80' : line.type === 'added' ? 'text-emerald-300/80' : 'text-zinc-400'}">
												{line.text}
											</td>
										</tr>
									{/each}
								</table>
							</div>
						{/if}
					</div>
				{:else if buildResult}
					<!-- Build Status -->
					<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs">
						{#if buildResult.success}
							<div class="text-emerald-400">Build successful!</div>
							<div class="mt-1 text-zinc-400">Output: {buildResult.output_path}</div>
						{/if}

						{#if buildResult.warnings.length > 0}
							<div class="mt-2 border-t border-zinc-800 pt-2">
								<div class="text-amber-400">Warnings:</div>
								{#each buildResult.warnings as warning}
									<div class="text-amber-300/70">{warning}</div>
								{/each}
							</div>
						{/if}

						{#if buildResult.errors.length > 0}
							<div class="mt-2 border-t border-zinc-800 pt-2">
								<div class="text-red-400">Errors:</div>
								{#each buildResult.errors as error}
									{#if parseBuildErrorLink(error)}
										<button
											class="block w-full cursor-pointer text-left text-red-300/70 underline decoration-red-500/30 hover:text-red-200 hover:decoration-red-400/50"
											onclick={() => handleBuildErrorClick(error)}
										>
											{error}
										</button>
									{:else}
										<div class="text-red-300/70">{error}</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>

					<!-- Build Output File Content -->
					{#if buildOutputLoading}
						<div
							class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-500"
						>
							Loading build output...
						</div>
					{:else if buildOutputContent !== null}
						<div class="overflow-hidden rounded-lg border border-zinc-800">
							<div
								class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5"
							>
								<span class="text-xs text-zinc-400">
									{buildResult.output_path.split('/').pop()}
								</span>
								<div class="flex items-center gap-3">
									<span class="text-xs text-zinc-600">
										{buildOutputContent.split('\n').length} lines
									</span>
									<button
										class="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
										onclick={handleCopyBuildOutput}
										title="Copy to clipboard"
									>
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
										Copy
									</button>
								</div>
							</div>
							<div class="h-96">
								<MonacoEditor value={buildOutputContent} language="gpc" readonly={true} />
							</div>
						</div>
					{/if}
				{:else if !building && !buildDiffLoading}
					<div
						class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500"
					>
						Click "Build Game" to preprocess and compile this game's scripts.
						<br />
						<span class="text-xs text-zinc-600">
							This merges all #include directives into a single .gpc file.
						</span>
					</div>
				{:else}
					<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
						<div
							class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
						></div>
						<div class="mt-2 text-sm text-zinc-400">
							{buildDiffLoading ? 'Checking for changes...' : 'Preprocessing and building...'}
						</div>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'persistence'}
			<!-- Persistence / Bitpacking Panel -->
			<PersistencePanel config={store.selectedConfig} gamePath={store.selectedGame.path} />
		{:else if activeTab === 'history'}
			<!-- Config History Panel -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
						Config Snapshots
					</h2>
					<button
						class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
						onclick={handleCreateSnapshot}
					>
						Create Snapshot
					</button>
				</div>

				{#if snapshotsLoading}
					<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
						Loading snapshots...
					</div>
				{:else if snapshots.length === 0}
					<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
						No snapshots yet. Create one to save the current config state.
					</div>
				{:else}
					<div class="space-y-2">
						{#each snapshots as snapshot}
							<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
								<div class="flex items-center justify-between">
									<div>
										{#if renamingSnapshotId === snapshot.id}
											<form
												class="flex items-center gap-2"
												onsubmit={(e) => {
													e.preventDefault();
													handleRenameSnapshot(snapshot.id);
												}}
											>
												<input
													class="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-sm text-zinc-200"
													bind:value={renameLabel}
													placeholder="Snapshot label"
												/>
												<button
													type="submit"
													class="text-xs text-emerald-400 hover:text-emerald-300"
												>
													Save
												</button>
												<button
													type="button"
													class="text-xs text-zinc-500 hover:text-zinc-300"
													onclick={() => (renamingSnapshotId = null)}
												>
													Cancel
												</button>
											</form>
										{:else}
											<button
												class="text-sm font-medium text-zinc-200 hover:text-zinc-100"
												onclick={() => {
													renamingSnapshotId = snapshot.id;
													renameLabel = snapshot.label ?? '';
												}}
												title="Click to rename"
											>
												{snapshot.label ?? 'Unnamed snapshot'}
											</button>
										{/if}
										<div class="text-xs text-zinc-500">{formatSnapshotDate(snapshot.timestamp)}</div>
									</div>
									<div class="flex items-center gap-2">
										<button
											class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
											onclick={() => handlePreviewSnapshot(snapshot.id)}
										>
											{snapshotPreview?.id === snapshot.id ? 'Hide' : 'Preview'}
										</button>
										<button
											class="rounded border border-zinc-700 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30 hover:text-amber-300"
											onclick={() => handleRollback(snapshot.id)}
										>
											Rollback
										</button>
										<button
											class="rounded border border-zinc-700 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300"
											onclick={() => handleDeleteSnapshot(snapshot.id)}
										>
											Delete
										</button>
									</div>
								</div>
								{#if snapshotPreview?.id === snapshot.id}
									<div class="mt-3 overflow-hidden rounded border border-zinc-800">
										<div class="h-80">
											<MonacoEditor
												value={snapshotPreview.content}
												language="ini"
												readonly={true}
											/>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<!-- Dashboard View -->
	<div class="mx-auto max-w-2xl p-6">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-zinc-100">GPC IDE</h1>
			<p class="mt-2 text-zinc-400">Desktop IDE for Cronus Zen game scripts</p>
		</div>

		{#if store.loading}
			<div class="text-center text-zinc-500">Loading games...</div>
		{:else if store.error}
			<div class="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
				{store.error}
			</div>
		{:else}
			<div class="mb-8 grid grid-cols-3 gap-4">
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
					<div class="text-2xl font-bold text-emerald-400">{totalGames}</div>
					<div class="text-xs text-zinc-500 uppercase">Games</div>
				</div>
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
					<div class="text-2xl font-bold text-amber-400">{types.length}</div>
					<div class="text-xs text-zinc-500 uppercase">Types</div>
				</div>
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
					<div class="text-2xl font-bold text-blue-400">
						{store.games.reduce((sum, g) => sum + g.module_count, 0)}
					</div>
					<div class="text-xs text-zinc-500 uppercase">Total Menu Items</div>
				</div>
			</div>

			<div class="space-y-4">
				{#each types as type}
					<div>
						<h2 class="mb-2 text-sm font-semibold tracking-wider text-zinc-500 uppercase">
							{type}
						</h2>
						<div class="grid gap-2">
							{#each grouped[type] as game}
								<div
									class="group flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
								>
									<button
										class="flex min-w-0 flex-1 items-center justify-between gap-3"
										onclick={() => selectGame(game)}
									>
										<div class="min-w-0 text-left">
											<div class="truncate font-medium text-zinc-200">{game.name}</div>
											<div class="truncate text-xs text-zinc-500">{game.title}</div>
										</div>
										<div class="flex shrink-0 items-center gap-3">
											<span
												class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 uppercase"
											>
												{game.game_type}
											</span>
											<span class="text-sm text-zinc-500">{game.module_count} items</span>
										</div>
									</button>
									<button
										class="ml-2 shrink-0 rounded p-1.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-red-400"
										onclick={(e) => handleDeleteGameFromDashboard(e, game)}
										title="Delete game"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- Modals -->
{#if store.selectedGame}
	<AddModuleModal
		open={showAddModuleModal}
		gamePath={store.selectedGame.path}
		onclose={() => (showAddModuleModal = false)}
		onsuccess={async () => {
			if (store.selectedGame) {
				await selectGame(store.selectedGame);
				loadFileTree(store.selectedGame.path);
			}
		}}
	/>

	<NewFileModal
		open={showNewFileModal}
		gamePath={store.selectedGame.path}
		onclose={() => (showNewFileModal = false)}
		onsuccess={async (filePath) => {
			if (store.selectedGame) {
				await loadFileTree(store.selectedGame.path);
				openTab(filePath);
			}
		}}
	/>

	<TemplateImportModal
		open={showTemplateImportModal}
		gamePath={store.selectedGame?.path ?? null}
		onclose={() => (showTemplateImportModal = false)}
		onimport={async () => {
			if (store.selectedGame) {
				await loadFileTree(store.selectedGame.path);
			}
		}}
	/>
{/if}

<ConfirmDialog
	open={confirmDialog.open}
	title={confirmDialog.title}
	message={confirmDialog.message}
	confirmLabel={confirmDialog.confirmLabel}
	variant={confirmDialog.variant}
	onconfirm={confirmDialog.onconfirm}
	oncancel={confirmDialogCancel}
/>

<!-- Regenerate File Diff Modal -->
{#if regenFileDiff}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onmousedown={(e) => { if (e.target === e.currentTarget) handleRegenCancel(); }}
		onkeydown={(e) => { if (e.key === 'Escape') handleRegenCancel(); }}
	>
		<div class="flex max-h-[80vh] w-[800px] max-w-[90vw] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-zinc-200">
					Regenerate: {regenFileDiff.path.split('/').pop()}
				</h2>
				<button
					class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					onclick={handleRegenCancel}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Diff Content -->
			<div class="flex-1 overflow-auto">
				<div class="bg-zinc-950 p-0 font-mono text-xs">
					<table class="w-full border-collapse">
						{#each regenDiffLines as line}
							<tr class={line.type === 'removed' ? 'bg-red-950/40' : line.type === 'added' ? 'bg-emerald-950/40' : ''}>
								<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
									{line.oldNum ?? ''}
								</td>
								<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
									{line.newNum ?? ''}
								</td>
								<td class="select-none px-1 py-0 {line.type === 'removed' ? 'text-red-500' : line.type === 'added' ? 'text-emerald-500' : 'text-zinc-700'}" style="width: 1rem">
									{line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
								</td>
								<td class="whitespace-pre py-0 pr-4 {line.type === 'removed' ? 'text-red-300/80' : line.type === 'added' ? 'text-emerald-300/80' : 'text-zinc-400'}">
									{line.text}
								</td>
							</tr>
						{/each}
					</table>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
				<button
					class="rounded bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
					onclick={handleRegenCancel}
				>
					Cancel
				</button>
				<button
					class="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					onclick={handleRegenCommit}
					disabled={regenerating}
				>
					{regenerating ? 'Committing...' : 'Commit'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Theme-aware tree view hover */
	:global(.file-tree) .tree-item:hover {
		background: var(--tree-hover) !important;
	}
</style>
