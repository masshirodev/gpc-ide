<script lang="ts">
    interface Props {
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        variant?: 'danger' | 'warning' | 'info';
        onconfirm: () => void;
        oncancel: () => void;
    }

    let {
        open,
        title,
        message,
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        variant = 'info',
        onconfirm,
        oncancel
    }: Props = $props();

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            oncancel();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            oncancel();
        } else if (e.key === 'Enter') {
            onconfirm();
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
        <div class="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
                <h2 class="text-base font-semibold text-zinc-100">{title}</h2>
                <button
                    class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={oncancel}
                >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            <!-- Body -->
            <div class="px-5 py-4">
                <p class="text-sm text-zinc-300 whitespace-pre-wrap">{message}</p>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-2 border-t border-zinc-700 px-5 py-3">
                <button
                    class="rounded px-4 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={oncancel}
                >
                    {cancelLabel}
                </button>
                {#if variant === 'danger'}
                    <button
                        class="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                        onclick={onconfirm}
                    >
                        {confirmLabel}
                    </button>
                {:else if variant === 'warning'}
                    <button
                        class="rounded bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
                        onclick={onconfirm}
                    >
                        {confirmLabel}
                    </button>
                {:else}
                    <button
                        class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                        onclick={onconfirm}
                    >
                        {confirmLabel}
                    </button>
                {/if}
            </div>
        </div>
    </div>
{/if}
