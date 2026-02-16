<script lang="ts">
    import './layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import Sidebar from '$lib/components/layout/Sidebar.svelte';
    import StatusBar from '$lib/components/layout/StatusBar.svelte';
    import SettingsModal from '$lib/components/layout/SettingsModal.svelte';
    import ToastContainer from '$lib/components/layout/ToastContainer.svelte';
    import { loadGames, selectGame, getGameStore, clearSelection } from '$lib/stores/game.svelte';
    import { getUiStore, toggleSidebar, setSidebarCollapsed } from '$lib/stores/ui.svelte';
    import { getSettings, addWorkspace } from '$lib/stores/settings.svelte';
    import { addToast } from '$lib/stores/toast.svelte';
    import { pickWorkspaceDirectory, getDefaultWorkspace, deleteGame } from '$lib/tauri/commands';
    import { ask } from '@tauri-apps/plugin-dialog';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import type { GameSummary } from '$lib/types/config';

    let { children } = $props();
    let ui = getUiStore();
    let gameStore = getGameStore();
    let settingsStore = getSettings();
    let settings = $derived($settingsStore);
    let settingsOpen = $state(false);

    onMount(() => {
        loadGames(settings.workspaces);
    });

    // Reload games when workspaces change
    $effect(() => {
        if (settings.workspaces) {
            loadGames(settings.workspaces);
        }
    });

    let needsSetup = $derived(settings.workspaces.length === 0);

    async function handleSetupPickWorkspace() {
        const path = await pickWorkspaceDirectory();
        if (path) {
            addWorkspace(path);
        }
    }

    async function handleSetupUseDefault() {
        const defaultPath = await getDefaultWorkspace();
        addWorkspace(defaultPath);
    }

    function handleSelectGame(game: GameSummary) {
        setSidebarCollapsed(true);
        selectGame(game);
        goto('/');
    }

    async function handleDeleteGame(game: GameSummary) {
        const confirmed = await ask(
            `Delete game "${game.name}"? This will permanently delete all files in the game directory.`,
            { title: 'Delete Game', kind: 'warning' }
        );
        if (!confirmed) return;
        try {
            await deleteGame(game.path);
            if (gameStore.selectedGame?.path === game.path) {
                clearSelection();
            }
            await loadGames(settings.workspaces);
            addToast(`Game "${game.name}" deleted`, 'success');
        } catch (e) {
            addToast(`Failed to delete game: ${e}`, 'error');
        }
    }
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-screen flex-col">
    <div class="relative flex flex-1 overflow-hidden">
        <div class="flex h-full w-10 shrink-0 flex-col border-r border-zinc-700 bg-zinc-900">
            <button
                class="flex h-10 items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onclick={toggleSidebar}
                title={ui.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    {#if ui.sidebarCollapsed}
                        <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    {:else}
                        <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                    {/if}
                </svg>
            </button>
            <div class="flex-1"></div>
            <button
                class="flex h-10 items-center justify-center border-t border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onclick={() => settingsOpen = true}
                title="Settings"
            >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
            </button>
        </div>
        {#if !ui.sidebarCollapsed}
            <button
                class="absolute inset-0 left-10 z-40 bg-black/30"
                onclick={toggleSidebar}
                aria-label="Close sidebar"
            ></button>
            <div class="absolute left-10 top-0 z-50 h-full">
                <Sidebar onSelectGame={handleSelectGame} onDeleteGame={handleDeleteGame} onCollapse={toggleSidebar} onOpenSettings={() => settingsOpen = true} />
            </div>
        {/if}
        <main class="flex-1 overflow-y-auto bg-zinc-950">
            {@render children()}
        </main>
    </div>
    <StatusBar />
</div>

{#if needsSetup}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90">
        <div class="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div class="mb-6 text-center">
                <svg class="mx-auto mb-3 h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <h2 class="text-lg font-semibold text-zinc-100">Set Up Workspace</h2>
                <p class="mt-2 text-sm text-zinc-400">
                    A workspace directory is needed to store your game scripts. Choose a custom location or use the default.
                </p>
            </div>
            <div class="space-y-3">
                <button
                    class="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                    onclick={handleSetupUseDefault}
                >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Use Default Directory
                </button>
                <button
                    class="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700"
                    onclick={handleSetupPickWorkspace}
                >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Choose Custom Directory
                </button>
            </div>
        </div>
    </div>
{/if}

<SettingsModal open={settingsOpen} onclose={() => settingsOpen = false} />
<ToastContainer />
