<script lang="ts">
    import './layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import Sidebar from '$lib/components/layout/Sidebar.svelte';
    import StatusBar from '$lib/components/layout/StatusBar.svelte';
    import SettingsModal from '$lib/components/layout/SettingsModal.svelte';
    import ToastContainer from '$lib/components/layout/ToastContainer.svelte';
    import { loadGames, selectGame } from '$lib/stores/game.svelte';
    import { getUiStore, toggleSidebar } from '$lib/stores/ui.svelte';
    import { getSettings } from '$lib/stores/settings.svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import type { GameSummary } from '$lib/types/config';

    let { children } = $props();
    let ui = getUiStore();
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

    function handleSelectGame(game: GameSummary) {
        selectGame(game);
        goto('/');
    }
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-screen flex-col">
    <div class="flex flex-1 overflow-hidden">
        {#if ui.sidebarCollapsed}
            <div class="flex h-full w-10 shrink-0 flex-col border-r border-zinc-700 bg-zinc-900">
                <button
                    class="flex h-10 items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={toggleSidebar}
                    title="Expand sidebar"
                >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
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
        {:else}
            <Sidebar onSelectGame={handleSelectGame} onCollapse={toggleSidebar} onOpenSettings={() => settingsOpen = true} />
        {/if}
        <main class="flex-1 overflow-y-auto bg-zinc-950">
            {@render children()}
        </main>
    </div>
    <StatusBar />
</div>

<SettingsModal open={settingsOpen} onclose={() => settingsOpen = false} />
<ToastContainer />
