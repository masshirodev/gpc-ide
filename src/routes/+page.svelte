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
	import PersistencePanel from '$lib/components/persistence/PersistencePanel.svelte';
	import FlowEditor from './tools/flow/FlowEditor.svelte';
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
	import { parseBuildErrorLink } from '$lib/utils/editor-helpers';

	// Extracted components
	import DashboardView from '$lib/components/editor/DashboardView.svelte';
	import GameOverviewPanel from '$lib/components/editor/GameOverviewPanel.svelte';
	import FileTreePanel from '$lib/components/editor/FileTreePanel.svelte';
	import EditorPanel from '$lib/components/editor/EditorPanel.svelte';
	import BuildPanel from '$lib/components/editor/BuildPanel.svelte';
	import HistoryPanel from '$lib/components/editor/HistoryPanel.svelte';
	import RegenerateDiffModal from '$lib/components/editor/RegenerateDiffModal.svelte';

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
	let activeTab = $state<'overview' | 'files' | 'flow' | 'build' | 'persistence' | 'history'>('overview');

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
		} catch (e) {
			console.error('Failed to refresh file tree:', e);
		}
	}

	// Auto-collapse sidebar when switching to files tab
	$effect(() => {
		if (activeTab === 'files' || activeTab === 'flow') {
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

	let regenerating = $state(false);
	let regenFileDiff = $state<FileDiff | null>(null);
	let regenFileLoading = $state(false);

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

	let editorComponent = $state<MonacoEditor>();
	let editorPanelComponent = $state<EditorPanel>();

	// Handle return from spray tool — apply updated values
	onMount(() => {
		const transfer = getRecoilTransfer();
		if (transfer?.returnTo) {
			const filePath = transfer.returnTo;
			const weaponIndex = transfer.weaponIndex;
			const newValues = transfer.values;
			clearRecoilTransfer();

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

	function handleOpenConfig() {
		if (store.selectedGame) {
			const configPath = `${store.selectedGame.path}/config.toml`;
			openTab(configPath);
			activeTab = 'files';
			editorPanelComponent?.setConfigSubTab('gui');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if store.selectedGame && store.selectedConfig}
	<!-- Game Detail View -->
	<div
		class={activeTab === 'files' || activeTab === 'flow' ? 'flex h-full flex-col overflow-hidden' : 'mx-auto max-w-5xl p-6'}
	>
		<div class="mb-4 flex items-center justify-between {activeTab === 'files' || activeTab === 'flow' ? 'px-4 pt-3' : ''}">
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
						onclick={handleOpenConfig}
						title="Click to edit in Config GUI"
					>
						{store.selectedGame.game_type}
					</button>
				{/if}
				<button
					class="cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700"
					onclick={handleOpenConfig}
					title="Click to edit in Config GUI"
				>
					v{store.selectedConfig.version}
				</button>
			</div>
		</div>

		<!-- Tab Bar -->
		<div class="mb-4 flex gap-1 border-b border-zinc-800 {activeTab === 'files' || activeTab === 'flow' ? 'px-4' : ''}">
			{#each ['overview', 'files', 'flow', 'persistence', 'build', 'history'] as tab}
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
							: tab === 'flow'
								? 'Flow'
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
			<GameOverviewPanel
				config={store.selectedConfig}
				gamePath={store.selectedGame.path}
				{profileCount}
				onAddModule={() => (showAddModuleModal = true)}
				onRemoveModule={handleRemoveModule}
				onOpenModuleManager={() => { goto('/tools/modules'); }}
				onOpenConfig={handleOpenConfig}
			/>
		{:else if activeTab === 'files'}
			<!-- File Browser - Full Width -->
			<div class="flex min-h-0 flex-1 gap-0">
				<FileTreePanel
					{fileTree}
					{expandedDirs}
					activeFilePath={editorStore.activeTabPath}
					{themeAccent}
					onToggleDir={toggleDir}
					onFileClick={handleFileClick}
					onDeleteFile={handleDeleteFile}
					onAddModule={() => (showAddModuleModal = true)}
					onNewFile={() => (showNewFileModal = true)}
					onImportTemplate={() => (showTemplateImportModal = true)}
				/>

				<EditorPanel
					bind:this={editorPanelComponent}
					currentTab={currentEditorTab}
					gamePath={store.selectedGame?.path ?? ''}
					consoleType={gameConsoleType}
					{themeAccent}
					{regenerating}
					{regenFileLoading}
					onCloseTab={handleCloseTab}
					onContentChange={(path, content) => updateTabContent(path, content)}
					onEditorReady={handleEditorReady}
					onRegenerateFile={handleRegenerateFile}
					onOpenExternal={handleOpenExternal}
					bind:editorComponent
				/>
			</div>
		{:else if activeTab === 'flow'}
			<FlowEditor />
		{:else if activeTab === 'build'}
			<BuildPanel
				{buildDiffMode}
				{buildDiffs}
				{buildDiffSelectedFile}
				{buildDiffLoading}
				{buildResult}
				{buildOutputContent}
				{buildOutputLoading}
				{building}
				{regeneratingAll}
				onBuild={() => handleBuild()}
				onBuildCancel={handleBuildCancel}
				onBuildCommit={handleBuildCommit}
				onRegenerateAll={handleRegenerateAll}
				onBuildErrorClick={handleBuildErrorClick}
				onCopyBuildOutput={handleCopyBuildOutput}
				onSelectDiffFile={(i) => (buildDiffSelectedFile = i)}
			/>
		{:else if activeTab === 'persistence'}
			<PersistencePanel config={store.selectedConfig} gamePath={store.selectedGame.path} />
		{:else if activeTab === 'history'}
			<HistoryPanel
				{snapshots}
				{snapshotsLoading}
				{snapshotPreview}
				{renamingSnapshotId}
				{renameLabel}
				onCreateSnapshot={handleCreateSnapshot}
				onPreviewSnapshot={handlePreviewSnapshot}
				onRollback={handleRollback}
				onDeleteSnapshot={handleDeleteSnapshot}
				onStartRename={(id, label) => {
					renamingSnapshotId = id;
					renameLabel = label;
				}}
				onCancelRename={() => (renamingSnapshotId = null)}
				onRenameSnapshot={handleRenameSnapshot}
				onRenameLabelChange={(v) => (renameLabel = v)}
			/>
		{/if}
	</div>
{:else}
	<DashboardView
		games={store.games}
		{grouped}
		{types}
		loading={store.loading}
		error={store.error}
		onSelectGame={selectGame}
		onDeleteGame={handleDeleteGameFromDashboard}
	/>
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

<RegenerateDiffModal
	diff={regenFileDiff}
	{regenerating}
	{regenFileLoading}
	onCancel={handleRegenCancel}
	onCommit={handleRegenCommit}
/>
