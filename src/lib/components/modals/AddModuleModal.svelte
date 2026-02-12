<script lang="ts">
    import { listAvailableModules, addModule, getGameConfig } from '$lib/tauri/commands';
    import type { ModuleSummary } from '$lib/types/module';
    import type { AddModuleParams } from '$lib/tauri/commands';
    import { addToast } from '$lib/stores/toast.svelte';
    import { getSettings } from '$lib/stores/settings.svelte';

    interface Props {
        open: boolean;
        gamePath: string;
        onclose: () => void;
        onsuccess: () => void;
    }

    let { open, gamePath, onclose, onsuccess }: Props = $props();

    let settingsStore = getSettings();
    let settings = $derived($settingsStore);

    let modules = $state<ModuleSummary[]>([]);
    let selectedModule = $state<string>('');
    let adding = $state(false);
    let error = $state('');
    let gameType = $state<string>('fps');

    // Load modules when modal opens
    $effect(() => {
        if (open) {
            loadData();
        } else {
            selectedModule = '';
            error = '';
        }
    });

    async function loadData() {
        try {
            // Load game config to get game type
            const config = await getGameConfig(gamePath);
            gameType = config.type || 'fps';

            // Load available modules (filters out already installed ones)
            modules = await listAvailableModules(gamePath, settings.workspaces);
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            handleClose();
        }
    }

    function handleClose() {
        if (!adding) {
            onclose();
        }
    }

    async function handleAdd() {
        if (!selectedModule || adding) return;

        try {
            adding = true;
            error = '';

            const params: AddModuleParams = {
                module_id: selectedModule,
                module_params: {}, // TODO: Collect params from form if needed
                quick_toggle_key: undefined,
                weapon_names: undefined
            };

            const result = await addModule(gamePath, params);

            if (result.success) {
                addToast(`Module ${selectedModule} added successfully`, 'success');
                onsuccess();
                onclose();
            } else {
                error = result.messages.join('\n');
            }
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            adding = false;
        }
    }

    // Filter modules by game type
    let compatibleModules = $derived(
        modules.filter(m => m.module_type === gameType || m.module_type === 'all')
    );

    let selectedModuleDetails = $derived(
        modules.find(m => m.id === selectedModule)
    );
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onclick={handleBackdropClick}
    >
        <div class="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
                <h2 class="text-base font-semibold text-zinc-100">Add Module</h2>
                <button
                    class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={handleClose}
                    disabled={adding}
                >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            <!-- Body -->
            <div class="space-y-4 px-5 py-4" style="max-height: 60vh; overflow-y: auto;">
                {#if gameType}
                    <div class="rounded bg-zinc-800/50 px-3 py-2 text-sm">
                        <span class="text-zinc-400">Game Type:</span>
                        <span class="ml-2 font-medium uppercase text-emerald-400">{gameType}</span>
                        <span class="ml-2 text-zinc-500">
                            (showing {compatibleModules.length} compatible modules)
                        </span>
                    </div>
                {/if}

                <div>
                    <label class="mb-2 block text-sm text-zinc-300">
                        Select Module
                    </label>
                    <div class="space-y-2">
                        {#each compatibleModules as module}
                            <button
                                class="w-full rounded border px-4 py-3 text-left transition-colors {selectedModule === module.id
                                    ? 'border-emerald-500 bg-emerald-900/30'
                                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800'}"
                                onclick={() => selectedModule = module.id}
                                disabled={adding}
                            >
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <h3 class="font-medium text-zinc-100">{module.display_name}</h3>
                                            <span class="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 uppercase">
                                                {module.module_type}
                                            </span>
                                        </div>
                                        <p class="mt-1 text-sm text-zinc-400">{module.description}</p>
                                        {#if module.dependencies && module.dependencies.length > 0}
                                            <p class="mt-1 text-xs text-amber-400">
                                                Requires: {module.dependencies.join(', ')}
                                            </p>
                                        {/if}
                                    </div>
                                    {#if selectedModule === module.id}
                                        <svg class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    {/if}
                                </div>
                            </button>
                        {/each}

                        {#if compatibleModules.length === 0}
                            <p class="text-center text-sm text-zinc-500 py-8">
                                No compatible modules found for game type: {gameType}
                            </p>
                        {/if}
                    </div>
                </div>

                {#if error}
                    <div class="rounded bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400 whitespace-pre-wrap">
                        {error}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-2 border-t border-zinc-700 px-5 py-3">
                <button
                    class="rounded px-4 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={handleClose}
                    disabled={adding}
                >
                    Cancel
                </button>
                <button
                    class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    onclick={handleAdd}
                    disabled={!selectedModule || adding}
                >
                    {adding ? 'Adding...' : 'Add Module'}
                </button>
            </div>
        </div>
    </div>
{/if}
