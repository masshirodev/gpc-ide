<script lang="ts">
    import { createStandaloneFile } from '$lib/tauri/commands';
    import { addToast } from '$lib/stores/toast.svelte';

    interface Props {
        open: boolean;
        gamePath: string;
        onclose: () => void;
        onsuccess: (filePath: string) => void;
    }

    let { open, gamePath, onclose, onsuccess }: Props = $props();

    let filename = $state('');
    let creating = $state(false);
    let error = $state('');

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            handleClose();
        } else if (e.key === 'Enter' && filename.trim()) {
            handleCreate();
        }
    }

    function handleClose() {
        if (!creating) {
            filename = '';
            error = '';
            onclose();
        }
    }

    async function handleCreate() {
        if (!filename.trim() || creating) return;

        try {
            creating = true;
            error = '';

            const filePath = await createStandaloneFile(gamePath, filename.trim());
            addToast(`Created ${filename.trim()}`, 'success');
            filename = '';
            onsuccess(filePath);
            onclose();
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            creating = false;
        }
    }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onclick={handleBackdropClick}
    >
        <div class="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
                <h2 class="text-base font-semibold text-zinc-100">New File</h2>
                <button
                    class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={handleClose}
                    disabled={creating}
                >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            <!-- Body -->
            <div class="space-y-4 px-5 py-4">
                <div>
                    <label class="mb-1 block text-sm text-zinc-300" for="filename">
                        Filename
                    </label>
                    <input
                        id="filename"
                        type="text"
                        class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g., custom.gpc"
                        bind:value={filename}
                        disabled={creating}
                        autofocus
                    />
                    <p class="mt-1 text-xs text-zinc-500">
                        .gpc extension will be added automatically if not provided
                    </p>
                </div>

                {#if error}
                    <div class="rounded bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
                        {error}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-2 border-t border-zinc-700 px-5 py-3">
                <button
                    class="rounded px-4 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={handleClose}
                    disabled={creating}
                >
                    Cancel
                </button>
                <button
                    class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    onclick={handleCreate}
                    disabled={!filename.trim() || creating}
                >
                    {creating ? 'Creating...' : 'Create'}
                </button>
            </div>
        </div>
    </div>
{/if}
