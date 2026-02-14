<script lang="ts">
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
    import { getUiStore, setSidebarCollapsed } from '$lib/stores/ui.svelte';
    import { getLspStore, startLsp, stopLsp, getLspClient } from '$lib/stores/lsp.svelte';
    import { MonacoLspBridge } from '$lib/lsp/MonacoLspBridge';
    import { buildGame, readFileTree, readFile, watchDirectory, deleteFile, deleteGame, regenerateFile, regenerateAll, openInDefaultApp } from '$lib/tauri/commands';
    import { onFileChange } from '$lib/tauri/events';
    import type { BuildResult, FileTreeEntry } from '$lib/tauri/commands';
    import type { UnlistenFn } from '@tauri-apps/api/event';
    import { onMount } from 'svelte';
    import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';
    import RecoilTableEditor from '$lib/components/editor/RecoilTableEditor.svelte';
    import ConfigEditor from '$lib/components/editor/ConfigEditor.svelte';
    import PersistencePanel from '$lib/components/persistence/PersistencePanel.svelte';
    import AddModuleModal from '$lib/components/modals/AddModuleModal.svelte';
    import NewFileModal from '$lib/components/modals/NewFileModal.svelte';
    import TemplateImportModal from '$lib/components/modals/TemplateImportModal.svelte';
    import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
    import CreateModuleModal from '$lib/components/modals/CreateModuleModal.svelte';
    import { addToast } from '$lib/stores/toast.svelte';
    import { getSettings } from '$lib/stores/settings.svelte';
    import {
        getRecoilTransfer,
        clearRecoilTransfer
    } from '$lib/stores/recoil-transfer.svelte';
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
    let grouped = $derived(gamesByType(store.games));
    let types = $derived(Object.keys(grouped).sort());
    let totalGames = $derived(store.games.length);

    // Active editor tab
    let currentEditorTab = $derived(getActiveEditorTab());

    // Build state
    let building = $state(false);
    let regeneratingAll = $state(false);
    let buildResult = $state<BuildResult | null>(null);
    let buildOutputContent = $state<string | null>(null);
    let buildOutputLoading = $state(false);

    // Modal state
    let showAddModuleModal = $state(false);
    let showNewFileModal = $state(false);
    let showTemplateImportModal = $state(false);
    let showCreateModuleModal = $state(false);

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
    let activeTab = $state<'overview' | 'files' | 'build' | 'persistence'>('overview');

    // Track which game we loaded the file tree for to avoid re-loading
    let lastLoadedGamePath = $state<string | null>(null);

    // LSP bridge (registered once when LSP becomes running)
    let bridge: MonacoLspBridge | null = null;

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

    // Auto-collapse sidebar when on files tab, restore when leaving
    $effect(() => {
        setSidebarCollapsed(activeTab === 'files');
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
            watchDirectory(game.path).catch((e) =>
                console.warn('File watcher setup failed:', e)
            );
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
        }
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

        const confirmed = await showConfirm({ title: 'Regenerate', message: 'Regenerate all generated files? Any custom changes to module files, core.gpc, and main.gpc will be lost.', confirmLabel: 'Regenerate', variant: 'warning' });
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

    async function handleBuild() {
        if (!store.selectedGame || building) return;
        building = true;
        buildResult = null;
        buildOutputContent = null;
        try {
            buildResult = await buildGame(store.selectedGame.path);
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
        // Check if file is in Modules/ directory
        if (path.includes('/Modules/') || path.includes('\\Modules\\')) {
            return false;
        }

        // Check if file is protected
        const filename = path.split('/').pop() || '';
        const protected_files = [
            'config.toml',
            'main.gpc',
            'init.gpc',
            'define.gpc',
            'menu.gpc',
            'setting.gpc',
            'persistence.gpc',
            'combo.gpc',
            'keyboard.gpc',
            'adapters.gpc',
            'weapon.gpc',
            'weapondata.gpc',
            'debug.gpc',
            'adp.gpc',
            'recoiltable.gpc'
        ];
        if (protected_files.includes(filename)) {
            return false;
        }

        return true;
    }

    async function handleDeleteFile(e: MouseEvent, path: string) {
        e.stopPropagation();

        if (!await showConfirm({ title: 'Delete File', message: `Are you sure you want to delete ${path.split('/').pop()}?`, confirmLabel: 'Delete', variant: 'danger' })) {
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

    async function handleDeleteGameFromDashboard(e: MouseEvent, game: import('$lib/types/config').GameSummary) {
        e.stopPropagation();
        if (!await showConfirm({ title: 'Delete Game', message: `Delete "${game.name}"? This will permanently delete all files in the game directory.`, confirmLabel: 'Delete', variant: 'danger' })) {
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

    function canRegenerateFile(path: string): boolean {
        const regenerable = [
            '/Modules/core.gpc',
            '/main.gpc',
            '/define.gpc',
            '/menu.gpc',
            '/setting.gpc',
            '/persistence.gpc'
        ];

        return regenerable.some(pattern => path.endsWith(pattern)) ||
               (path.includes('/Modules/') && path.endsWith('.gpc') && !path.endsWith('/core.gpc'));
    }

    let regenerating = $state(false);

    async function handleRegenerateFile() {
        if (!currentEditorTab || !store.selectedGame || regenerating) return;

        const confirmed = await showConfirm({ title: 'Regenerate', message: 'Regenerate this file? Any custom changes will be lost.', confirmLabel: 'Regenerate', variant: 'warning' });
        if (!confirmed) return;

        try {
            regenerating = true;
            const filePath = currentEditorTab.path;

            // Regenerate the file
            await regenerateFile(store.selectedGame.path, filePath);

            // Reload the file content from disk to get the updated version
            const newContent = await readFile(filePath);

            // Close and reopen the tab to force editor refresh
            closeTab(filePath);
            await openTab(filePath);

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
        currentEditorTab?.path.endsWith('recoiltable.gpc') ?? false
    );

    // Check if current file is config.toml
    let isConfigFile = $derived(
        currentEditorTab?.path.endsWith('config.toml') ?? false
    );

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
            handleBuild();
        }
    }

    function handleCloseTab(e: MouseEvent, path: string) {
        e.stopPropagation();
        closeTab(path);
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if store.selectedGame && store.selectedConfig}
    <!-- Game Detail View -->
    <div class="{activeTab === 'files' ? 'h-full' : 'mx-auto max-w-5xl p-6'}">
        <div class="mb-4 flex items-center justify-between {activeTab === 'files' ? 'px-4 pt-3' : ''}">
            <div>
                <h1 class="text-2xl font-bold text-zinc-100">{store.selectedGame.name}</h1>
                <p class="text-sm text-zinc-400">{parseStateScreenText(store.selectedConfig.state_screen.title, store.selectedConfig)}</p>
            </div>
            <div class="flex items-center gap-2">
                {#if store.selectedGame.game_type}
                    <button
                        class="rounded bg-emerald-900/50 px-2 py-1 text-xs font-medium uppercase text-emerald-400 hover:bg-emerald-900/70 transition-colors cursor-pointer"
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
                    class="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 transition-colors cursor-pointer"
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
            {#each ['overview', 'files', 'persistence', 'build'] as tab}
                <button
                    class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
                    class:border-emerald-400={activeTab === tab}
                    class:text-emerald-400={activeTab === tab}
                    class:border-transparent={activeTab !== tab}
                    class:text-zinc-400={activeTab !== tab}
                    class:hover:text-zinc-200={activeTab !== tab}
                    onclick={() => (activeTab = tab as typeof activeTab)}
                >
                    {tab === 'overview' ? 'Overview' : tab === 'files' ? 'Files' : tab === 'build' ? 'Build' : 'Persistence'}
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

        {#if activeTab === 'overview'}
            <!-- Config Overview Cards -->
            <div class="grid grid-cols-2 gap-4">
                <!-- Menu Items -->
                <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <div class="mb-3 flex items-center justify-between">
                        <h2 class="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                            Menu Items ({store.selectedConfig.menu.length})
                        </h2>
                        <div class="flex gap-2">
                            <button
                                class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                                onclick={() => showAddModuleModal = true}
                            >
                                + Add Module
                            </button>
                            <button
                                class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                                onclick={() => showCreateModuleModal = true}
                            >
                                Create Module
                            </button>
                        </div>
                    </div>
                    <div class="space-y-2">
                        {#each store.selectedConfig.menu as item}
                            <button
                                class="flex w-full cursor-pointer items-center justify-between rounded bg-zinc-800/50 px-3 py-2 transition-colors hover:bg-zinc-700/50"
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
                                    <span class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
                                        {item.type}
                                    </span>
                                    {#if item.state_display}
                                        <span class="text-xs text-zinc-500">{item.state_display}</span>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Button Mappings -->
                <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                        Button Mappings
                    </h2>
                    <div class="space-y-1.5">
                        {#each Object.entries(store.selectedConfig.buttons) as [key, value]}
                            <button
                                class="flex w-full cursor-pointer items-center justify-between text-sm transition-colors hover:bg-zinc-800/30 rounded px-2 py-1"
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
                                <code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">{value}</code>
                            </button>
                        {/each}
                    </div>

                    {#if Object.keys(store.selectedConfig.keyboard).length > 0}
                        <h2 class="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                            Keyboard Shortcuts
                        </h2>
                        <div class="space-y-1.5">
                            {#each Object.entries(store.selectedConfig.keyboard) as [key, value]}
                                <button
                                    class="flex w-full cursor-pointer items-center justify-between text-sm transition-colors hover:bg-zinc-800/30 rounded px-2 py-1"
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
                                    <code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-amber-400">{value}</code>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- File Path -->
            <div class="mt-4 rounded border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500">
                {store.selectedGame.path}
            </div>

        {:else if activeTab === 'files'}
            <!-- File Browser - Full Width -->
            <div class="flex gap-0" style="height: calc(100vh - 140px);">
                <!-- File Tree -->
                <div class="w-52 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
                    <!-- File Tree Header -->
                    <div class="border-b border-zinc-800 p-2">
                        <div class="flex gap-1">
                            <button
                                class="flex-1 rounded border border-emerald-600/50 bg-emerald-600/10 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-500"
                                onclick={() => showAddModuleModal = true}
                                title="Add Module"
                            >
                                +
                            </button>
                            <button
                                class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500"
                                onclick={() => showNewFileModal = true}
                                title="New File"
                            >
                                📄
                            </button>
                            <button
                                class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500"
                                onclick={() => showTemplateImportModal = true}
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
                                    class="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                                    onclick={() => toggleDir(entry.path)}
                                >
                                    <span class="text-[10px]">{expandedDirs.has(entry.path) ? '▼' : '▶'}</span>
                                    {entry.name}
                                </button>
                                {#if expandedDirs.has(entry.path) && entry.children}
                                    {#each entry.children as child}
                                        {#if child.is_dir}
                                            <div class="ml-2">
                                                <button
                                                    class="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                                                    onclick={() => toggleDir(child.path)}
                                                >
                                                    <span class="text-[10px]">{expandedDirs.has(child.path) ? '▼' : '▶'}</span>
                                                    {child.name}
                                                </button>
                                                {#if expandedDirs.has(child.path) && child.children}
                                                    {#each child.children as grandchild}
                                                        {#if !grandchild.is_dir}
                                                            <div class="group flex items-center rounded hover:bg-zinc-800 {editorStore.activeTabPath === grandchild.path ? 'bg-emerald-900/30' : ''}">
                                                                <button
                                                                    class="flex-1 py-0.5 pl-6 pr-2 text-left text-xs {editorStore.activeTabPath === grandchild.path ? 'text-emerald-400' : 'text-zinc-300'}"
                                                                    onclick={() => handleFileClick(grandchild.path)}
                                                                >
                                                                    {grandchild.name}
                                                                </button>
                                                                {#if canDeleteFile(grandchild.path)}
                                                                    <button
                                                                        class="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
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
                                            <div class="group flex items-center rounded hover:bg-zinc-800 {editorStore.activeTabPath === child.path ? 'bg-emerald-900/30' : ''}">
                                                <button
                                                    class="flex-1 py-0.5 pl-5 pr-2 text-left text-xs {editorStore.activeTabPath === child.path ? 'text-emerald-400' : 'text-zinc-300'}"
                                                    onclick={() => handleFileClick(child.path)}
                                                >
                                                    {child.name}
                                                </button>
                                                {#if canDeleteFile(child.path)}
                                                    <button
                                                        class="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
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
                            <div class="group flex items-center rounded hover:bg-zinc-800 {editorStore.activeTabPath === entry.path ? 'bg-emerald-900/30' : ''}">
                                <button
                                    class="flex-1 px-2 py-0.5 text-left text-xs {editorStore.activeTabPath === entry.path ? 'text-emerald-400' : 'text-zinc-300'}"
                                    onclick={() => handleFileClick(entry.path)}
                                >
                                    {entry.name}
                                </button>
                                {#if canDeleteFile(entry.path)}
                                    <button
                                        class="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
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
                        <div class="flex items-center border-b border-zinc-800 bg-zinc-900/80">
                            <div class="flex flex-1 overflow-x-auto">
                                {#each editorStore.tabs as tab (tab.path)}
                                    <button
                                        class="group flex shrink-0 items-center gap-1.5 border-r border-zinc-800 px-3 py-1.5 text-xs transition-colors {editorStore.activeTabPath === tab.path ? 'bg-zinc-950 text-zinc-200' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}"
                                        onclick={() => activateTab(tab.path)}
                                        onauxclick={(e) => { if (e.button === 1) { e.preventDefault(); handleCloseTab(e, tab.path); } }}
                                    >
                                        <span>{tab.name}</span>
                                        {#if tab.dirty}
                                            <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                                        {/if}
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <span
                                            class="ml-1 rounded p-0.5 text-[10px] text-zinc-600 opacity-0 hover:bg-zinc-700 hover:text-zinc-300 group-hover:opacity-100"
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
                                        class="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                        onclick={handleOpenExternal}
                                        title="Open in external editor"
                                    >
                                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </button>
                                {/if}
                                {#if currentEditorTab && canRegenerateFile(currentEditorTab.path)}
                                    <button
                                        class="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                        onclick={handleRegenerateFile}
                                        disabled={regenerating}
                                        title="Regenerate this file from config.toml"
                                    >
                                        {regenerating ? 'Regenerating...' : 'Regenerate'}
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
                                <div class="flex border-b border-zinc-800 bg-zinc-900/50">
                                    {#if hasVisualEditor}
                                        <button
                                            class="px-4 py-1.5 text-xs font-medium transition-colors {editorSubTab === 'visual' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}"
                                            onclick={() => editorSubTab = 'visual'}
                                        >
                                            Visual
                                        </button>
                                        <button
                                            class="px-4 py-1.5 text-xs font-medium transition-colors {editorSubTab === 'code' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}"
                                            onclick={() => editorSubTab = 'code'}
                                        >
                                            Code
                                        </button>
                                    {:else if isConfigFile}
                                        <button
                                            class="px-4 py-1.5 text-xs font-medium transition-colors {configSubTab === 'gui' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}"
                                            onclick={() => configSubTab = 'gui'}
                                        >
                                            GUI
                                        </button>
                                        <button
                                            class="px-4 py-1.5 text-xs font-medium transition-colors {configSubTab === 'editor' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}"
                                            onclick={() => configSubTab = 'editor'}
                                        >
                                            Editor
                                        </button>
                                    {/if}
                                </div>
                            {/if}

                            <div class="flex-1 overflow-hidden">
                                {#if hasVisualEditor && editorSubTab === 'visual'}
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
                                        <ConfigEditor
                                            gamePath={store.selectedGame?.path ?? ''}
                                        />
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
                                        />
                                    {/key}
                                {/if}
                            </div>
                        {:else}
                            <div class="flex h-full items-center justify-center bg-zinc-950 text-sm text-zinc-600">
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
                    <button
                        class="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        onclick={handleRegenerateAll}
                        disabled={regeneratingAll}
                    >
                        {regeneratingAll ? 'Regenerating...' : 'Regenerate'}
                    </button>
                    <button
                        class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        onclick={handleBuild}
                        disabled={building}
                    >
                        {building ? 'Building...' : 'Build Game'}
                    </button>
                    {#if buildResult}
                        <span class="text-sm" class:text-emerald-400={buildResult.success} class:text-red-400={!buildResult.success}>
                            {buildResult.success ? 'Build succeeded' : 'Build failed'}
                        </span>
                    {/if}
                </div>

                {#if buildResult}
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
                        <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-500">
                            Loading build output...
                        </div>
                    {:else if buildOutputContent !== null}
                        <div class="rounded-lg border border-zinc-800 overflow-hidden">
                            <div class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5">
                                <span class="text-xs text-zinc-400">
                                    {buildResult.output_path.split('/').pop()}
                                </span>
                                <div class="flex items-center gap-3">
                                    <span class="text-xs text-zinc-600">
                                        {buildOutputContent.split('\n').length} lines
                                    </span>
                                    <button
                                        class="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                                        onclick={handleCopyBuildOutput}
                                        title="Copy to clipboard"
                                    >
                                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy
                                    </button>
                                </div>
                            </div>
                            <div style="height: calc(100vh - 380px);">
                                <MonacoEditor
                                    value={buildOutputContent}
                                    language="gpc"
                                    readonly={true}
                                />
                            </div>
                        </div>
                    {/if}
                {:else if !building}
                    <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
                        Click "Build Game" to preprocess and compile this game's scripts.
                        <br />
                        <span class="text-xs text-zinc-600">
                            This merges all #include directives into a single .gpc file.
                        </span>
                    </div>
                {:else}
                    <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
                        <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"></div>
                        <div class="mt-2 text-sm text-zinc-400">Preprocessing and building...</div>
                    </div>
                {/if}
            </div>

        {:else if activeTab === 'persistence'}
            <!-- Persistence / Bitpacking Panel -->
            <PersistencePanel
                config={store.selectedConfig}
                gamePath={store.selectedGame.path}
            />
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
            <div class="grid grid-cols-3 gap-4 mb-8">
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
                        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                            {type}
                        </h2>
                        <div class="grid gap-2">
                            {#each grouped[type] as game}
                                <div class="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800">
                                    <button
                                        class="flex flex-1 items-center justify-between"
                                        onclick={() => selectGame(game)}
                                    >
                                        <div>
                                            <div class="font-medium text-zinc-200">{game.name}</div>
                                            <div class="text-xs text-zinc-500">{game.title}</div>
                                        </div>
                                        <div class="flex items-center gap-3">
                                            <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs uppercase text-zinc-400">
                                                {game.game_type}
                                            </span>
                                            <span class="text-sm text-zinc-500">{game.module_count} items</span>
                                        </div>
                                    </button>
                                    <button
                                        class="ml-2 rounded p-1.5 text-zinc-600 opacity-0 hover:bg-zinc-700 hover:text-red-400 group-hover:opacity-100"
                                        onclick={(e) => handleDeleteGameFromDashboard(e, game)}
                                        title="Delete game"
                                    >
                                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        onclose={() => showAddModuleModal = false}
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
        onclose={() => showNewFileModal = false}
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
        onclose={() => showTemplateImportModal = false}
        onimport={async () => {
            if (store.selectedGame) {
                await loadFileTree(store.selectedGame.path);
            }
        }}
    />
{/if}

<CreateModuleModal
    open={showCreateModuleModal}
    onclose={() => showCreateModuleModal = false}
    onsuccess={() => {
        addToast('User module created. You can now add it to games.', 'success');
    }}
/>

<ConfirmDialog
    open={confirmDialog.open}
    title={confirmDialog.title}
    message={confirmDialog.message}
    confirmLabel={confirmDialog.confirmLabel}
    variant={confirmDialog.variant}
    onconfirm={confirmDialog.onconfirm}
    oncancel={confirmDialogCancel}
/>
