<script lang="ts">
    import { getGameStore, gamesByType, clearSelection } from '$lib/stores/game.svelte';
    import { goto } from '$app/navigation';
    import type { GameSummary } from '$lib/types/config';

    interface Props {
        onSelectGame: (game: GameSummary) => void;
        onDeleteGame?: (game: GameSummary) => void;
        onCollapse?: () => void;
        onOpenSettings?: () => void;
    }

    let { onSelectGame, onDeleteGame, onCollapse, onOpenSettings }: Props = $props();
    let store = getGameStore();
    let grouped = $derived(gamesByType(store.games));
    let types = $derived(Object.keys(grouped).sort());
</script>

<aside class="flex h-full w-64 flex-col border-r border-zinc-700 bg-zinc-900">
    <div class="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div class="flex items-center gap-2">
            <svg class="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                    d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.5 17a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-.5h-3v.5zM8.5 19a.5.5 0 00.5.5h2a.5.5 0 000-1H9a.5.5 0 00-.5.5z"
                />
            </svg>
            <span class="text-sm font-semibold text-zinc-100">GPC IDE</span>
        </div>
        {#if onCollapse}
            <button
                class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                onclick={onCollapse}
                title="Collapse sidebar"
            >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                </svg>
            </button>
        {/if}
    </div>

    <nav class="flex-1 overflow-y-auto px-2 py-2">
        <button
            class="mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            onclick={() => { clearSelection(); goto('/'); }}
        >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                    d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"
                />
            </svg>
            Dashboard
        </button>

        <div class="mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Games
        </div>

        {#each types as type}
            <div class="mb-1">
                <div class="px-3 py-1 text-xs font-medium text-zinc-500">{type}</div>
                {#each grouped[type] as game}
                    <div
                        class="group flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                        class:bg-zinc-800={store.selectedGame?.path === game.path}
                        class:text-emerald-400={store.selectedGame?.path === game.path}
                    >
                        <button
                            class="flex-1 text-left truncate"
                            onclick={() => onSelectGame(game)}
                        >
                            {game.name}
                        </button>
                        <div class="flex items-center gap-1">
                            <span class="text-xs text-zinc-500">v{game.version}</span>
                            {#if onDeleteGame}
                                <button
                                    class="rounded p-0.5 text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                                    onclick={(e) => { e.stopPropagation(); onDeleteGame(game); }}
                                    title="Delete game"
                                >
                                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/each}

        {#if store.loading}
            <div class="px-3 py-2 text-sm text-zinc-500">Loading...</div>
        {/if}

        {#if store.error}
            <div class="px-3 py-2 text-sm text-red-400">{store.error}</div>
        {/if}

        <div class="mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Tools
        </div>
        <a
            href="/tools/recoil"
            class="mb-1 flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clip-rule="evenodd" />
            </svg>
            Spray Pattern
        </a>
        <a
            href="/tools/oled"
            class="mb-1 flex items-center gap-2 rounded px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
            </svg>
            OLED Creator
        </a>
    </nav>

    <div class="border-t border-zinc-700 p-2 space-y-1.5">
        <a
            href="/wizard"
            class="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
            </svg>
            New Game
        </a>
        {#if onOpenSettings}
            <button
                class="flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                onclick={onOpenSettings}
            >
                <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
                Settings
            </button>
        {/if}
    </div>
</aside>
