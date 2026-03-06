<script lang="ts">
    import { getToasts, dismissToast } from '$lib/stores/toast.svelte';

    let toasts = $derived(getToasts());

    const typeClasses: Record<string, string> = {
        info: 'border-blue-500/50 bg-blue-950/95 text-blue-100',
        success: 'border-emerald-500/50 bg-emerald-950/95 text-emerald-100',
        error: 'border-red-500/50 bg-red-950/95 text-red-100',
        warning: 'border-amber-500/50 bg-amber-950/95 text-amber-100',
    };

    const typeIcons: Record<string, { path: string; class: string }> = {
        info: {
            path: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
            class: 'text-blue-400',
        },
        success: {
            path: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
            class: 'text-emerald-400',
        },
        error: {
            path: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
            class: 'text-red-400',
        },
        warning: {
            path: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
            class: 'text-amber-400',
        },
    };
</script>

{#if toasts.length > 0}
    <div class="fixed right-4 bottom-12 z-50 flex flex-col gap-2.5">
        {#each toasts as toast (toast.id)}
            <div
                class="toast-enter flex min-w-72 max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur-sm {typeClasses[toast.type] || typeClasses.info}"
                role="alert"
            >
                <svg class="mt-0.5 h-5 w-5 shrink-0 {typeIcons[toast.type]?.class ?? 'text-blue-400'}" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d={typeIcons[toast.type]?.path ?? typeIcons.info.path} clip-rule="evenodd" />
                </svg>
                <span class="flex-1 select-text leading-snug">{toast.message}</span>
                <button
                    class="mt-0.5 shrink-0 opacity-50 transition-opacity hover:opacity-100"
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

<style>
    @keyframes toast-slide-in {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    .toast-enter {
        animation: toast-slide-in 0.25s ease-out;
    }
</style>
