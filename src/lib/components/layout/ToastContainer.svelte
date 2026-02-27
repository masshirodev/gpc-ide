<script lang="ts">
    import { getToasts, dismissToast } from '$lib/stores/toast.svelte';

    let toasts = getToasts();

    const typeClasses: Record<string, string> = {
        info: 'border-blue-700 bg-blue-900/90 text-blue-200',
        success: 'border-emerald-700 bg-emerald-900/90 text-emerald-200',
        error: 'border-red-700 bg-red-900/90 text-red-200',
        warning: 'border-amber-700 bg-amber-900/90 text-amber-200',
    };
</script>

{#if toasts.length > 0}
    <div class="fixed bottom-10 right-4 z-50 flex flex-col gap-2">
        {#each toasts as toast (toast.id)}
            <div
                class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg {typeClasses[toast.type] || typeClasses.info}"
            >
                <span class="flex-1 select-text">{toast.message}</span>
                <button
                    class="ml-2 shrink-0 opacity-60 hover:opacity-100"
                    onclick={() => dismissToast(toast.id)}
                >
                    <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        {/each}
    </div>
{/if}
