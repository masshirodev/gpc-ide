<script lang="ts">
    import { getGameConfig, saveGameConfig } from '$lib/tauri/commands';
    import type { GameConfig, MenuItem } from '$lib/types/config';
    import { addToast } from '$lib/stores/toast.svelte';
    import { getSettings, getAllGameTypes } from '$lib/stores/settings.svelte';
    import KeySelect from '$lib/components/inputs/KeySelect.svelte';
    import ButtonSelect from '$lib/components/inputs/ButtonSelect.svelte';

    interface Props {
        gamePath: string;
        scrollToSection?: 'game-info' | 'buttons' | 'keyboard' | 'menu-items';
    }

    let { gamePath, scrollToSection }: Props = $props();

    let config = $state<GameConfig | null>(null);
    let loading = $state(true);
    let saving = $state(false);
    let expandedMenuItems = $state<Set<number>>(new Set());

    // Load config on mount
    $effect(() => {
        loadConfig();
    });

    async function loadConfig() {
        try {
            loading = true;
            config = await getGameConfig(gamePath);
        } catch (e) {
            addToast(`Failed to load config: ${e}`, 'error');
        } finally {
            loading = false;
        }
    }

    async function handleSave() {
        if (!config) return;
        try {
            saving = true;
            await saveGameConfig(gamePath, config);
            addToast('Config saved successfully', 'success');
        } catch (e) {
            addToast(`Failed to save config: ${e}`, 'error');
        } finally {
            saving = false;
        }
    }

    function toggleMenuItem(index: number) {
        if (expandedMenuItems.has(index)) {
            expandedMenuItems.delete(index);
        } else {
            expandedMenuItems.add(index);
        }
        expandedMenuItems = new Set(expandedMenuItems);
    }

    function addMenuItem() {
        if (!config) return;
        const newItem: MenuItem = {
            name: 'New Item',
            type: 'toggle',
            var: 'NewVar',
            state_display: 'NEW',
            default: 0
        };
        config.menu = [...config.menu, newItem];
    }

    function removeMenuItem(index: number) {
        if (!config) return;
        config.menu = config.menu.filter((_, i) => i !== index);
    }

    function moveMenuItem(index: number, direction: 'up' | 'down') {
        if (!config) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= config.menu.length) return;

        const items = [...config.menu];
        [items[index], items[newIndex]] = [items[newIndex], items[index]];
        config.menu = items;
    }

    // Validation helpers
    function validateVersion(val: string): number {
        const num = parseInt(val);
        return isNaN(num) || num < 1 ? 1 : num;
    }

    let settingsStore = getSettings();
    let gameTypeOptions = $derived(getAllGameTypes($settingsStore));
    const menuTypeOptions = ['clickable', 'toggle', 'value', 'selector', 'custom'];
</script>

{#if loading}
    <div class="flex h-full items-center justify-center">
        <div class="text-sm text-zinc-400">Loading config...</div>
    </div>
{:else if config}
    <div class="flex h-full flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto">
        <div class="mx-auto max-w-4xl">
            <!-- Save Button (Sticky Header) -->
            <div class="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 px-6 py-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-zinc-100">Config Editor</h2>
                    <button
                        class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        onclick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Config'}
                    </button>
                </div>
            </div>

            <div class="space-y-6 p-6">
            <!-- Game Info Section -->
            <section id="game-info" class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Game Info</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="mb-1 block text-xs text-zinc-400">Filename</label>
                        <input
                            type="text"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                            bind:value={config.filename}
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-xs text-zinc-400">Version</label>
                        <input
                            type="number"
                            min="1"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                            value={config.version}
                            onchange={(e) => config && (config.version = validateVersion((e.target as HTMLInputElement).value))}
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-xs text-zinc-400">Game Type</label>
                        <select
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                            bind:value={config.type}
                        >
                            {#each gameTypeOptions as type}
                                <option value={type}>{type.toUpperCase()}</option>
                            {/each}
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-xs text-zinc-400">Profile Count</label>
                        <input
                            type="number"
                            min="0"
                            max="2"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                            bind:value={config.profile_count}
                        />
                    </div>
                </div>
            </section>

            <!-- State Screen Section -->
            <section class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">State Screen</h3>
                <div>
                    <label class="mb-1 block text-xs text-zinc-400">Title</label>
                    <input
                        type="text"
                        class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                        bind:value={config.state_screen.title}
                    />
                </div>
            </section>

            <!-- Buttons Section -->
            <section id="buttons" class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Button Mappings</h3>
                <div class="grid grid-cols-2 gap-4">
                    {#each Object.entries(config.buttons) as [key, value]}
                        <div>
                            <label class="mb-1 block text-xs text-zinc-400 capitalize">{key.replace(/_/g, ' ')}</label>
                            <ButtonSelect
                                value={value}
                                onchange={(v) => config && ((config.buttons as Record<string, string>)[key] = v)}
                            />
                        </div>
                    {/each}
                </div>
            </section>

            <!-- Keyboard Section -->
            <section id="keyboard" class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Keyboard Shortcuts</h3>
                {#if Object.keys(config.keyboard).length > 0}
                    <div class="grid grid-cols-2 gap-4">
                        {#each Object.entries(config.keyboard) as [key, value]}
                            <div>
                                <label class="mb-1 block text-xs text-zinc-400 capitalize">{key.replace(/_/g, ' ')}</label>
                                <KeySelect
                                    value={value}
                                    onchange={(v) => config && (config.keyboard[key] = v)}
                                    allowEmpty={false}
                                />
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-zinc-500">No keyboard shortcuts configured</p>
                {/if}
            </section>

            <!-- Menu Items Section -->
            <section id="menu-items" class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div class="mb-4 flex items-center justify-between">
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-zinc-400">Menu Items</h3>
                    <button
                        class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                        onclick={addMenuItem}
                    >
                        + Add Menu Item
                    </button>
                </div>

                {#if config.menu.length > 0}
                    <div class="space-y-2">
                        {#each config.menu as item, index}
                            <div class="rounded border border-zinc-700 bg-zinc-800/50">
                                <!-- Menu Item Header -->
                                <div class="flex items-center justify-between p-3">
                                    <button
                                        class="flex flex-1 items-center gap-2 text-left"
                                        onclick={() => toggleMenuItem(index)}
                                    >
                                        <svg
                                            class="h-4 w-4 text-zinc-400 transition-transform {expandedMenuItems.has(index) ? 'rotate-90' : ''}"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span class="font-medium text-zinc-200">{item.name}</span>
                                        <span class="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{item.type}</span>
                                        {#if item.state_display}
                                            <span class="text-xs text-zinc-500">{item.state_display}</span>
                                        {/if}
                                    </button>
                                    <div class="flex items-center gap-1">
                                        <button
                                            class="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
                                            onclick={() => moveMenuItem(index, 'up')}
                                            disabled={index === 0}
                                            title="Move up"
                                        >
                                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                        <button
                                            class="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
                                            onclick={() => moveMenuItem(index, 'down')}
                                            disabled={index === config.menu.length - 1}
                                            title="Move down"
                                        >
                                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            class="rounded p-1 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                                            onclick={() => removeMenuItem(index)}
                                            title="Delete"
                                        >
                                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <!-- Menu Item Details (Expanded) -->
                                {#if expandedMenuItems.has(index)}
                                    <div class="border-t border-zinc-700 p-3">
                                        <div class="grid grid-cols-2 gap-3">
                                            <div>
                                                <label class="mb-1 block text-xs text-zinc-400">Name</label>
                                                <input
                                                    type="text"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                    bind:value={item.name}
                                                />
                                            </div>
                                            <div>
                                                <label class="mb-1 block text-xs text-zinc-400">Type</label>
                                                <select
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                    bind:value={item.type}
                                                >
                                                    {#each menuTypeOptions as type}
                                                        <option value={type}>{type}</option>
                                                    {/each}
                                                </select>
                                            </div>
                                            <div>
                                                <label class="mb-1 block text-xs text-zinc-400">Variable</label>
                                                <input
                                                    type="text"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                    bind:value={item.var}
                                                />
                                            </div>
                                            <div>
                                                <label class="mb-1 block text-xs text-zinc-400">State Display</label>
                                                <input
                                                    type="text"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                    bind:value={item.state_display}
                                                    placeholder="Short code (e.g., RF)"
                                                />
                                            </div>
                                            {#if item.type === 'value'}
                                                <div>
                                                    <label class="mb-1 block text-xs text-zinc-400">Min</label>
                                                    <input
                                                        type="number"
                                                        class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                        bind:value={item.min}
                                                    />
                                                </div>
                                                <div>
                                                    <label class="mb-1 block text-xs text-zinc-400">Max</label>
                                                    <input
                                                        type="number"
                                                        class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                        bind:value={item.max}
                                                    />
                                                </div>
                                            {/if}
                                            <div>
                                                <label class="mb-1 block text-xs text-zinc-400">Default</label>
                                                <input
                                                    type="text"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                                    value={item.default}
                                                    onchange={(e) => {
                                                        const val = (e.target as HTMLInputElement).value;
                                                        item.default = isNaN(Number(val)) ? val : Number(val);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-zinc-500">No menu items configured</p>
                {/if}
            </section>
            </div>
        </div>
        </div>
    </div>
{:else}
    <div class="flex h-full items-center justify-center">
        <div class="text-sm text-red-400">Failed to load config</div>
    </div>
{/if}
