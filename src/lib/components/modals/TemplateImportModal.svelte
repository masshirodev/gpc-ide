<script lang="ts">
    import { listTemplates, readTemplate, importTemplate } from '$lib/tauri/commands';
    import type { TemplateFile } from '$lib/tauri/commands';
    import { addToast } from '$lib/stores/toast.svelte';
    import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';
    import * as m from '$lib/paraglide/messages.js';

    interface Props {
        open: boolean;
        gamePath: string | null;
        onclose: () => void;
        onimport: () => void;
    }

    let { open, gamePath, onclose, onimport }: Props = $props();

    let templates = $state<TemplateFile[]>([]);
    let loading = $state(false);
    let error = $state('');
    let selectedTemplate = $state<TemplateFile | null>(null);
    let templateContent = $state<string | null>(null);
    let contentLoading = $state(false);
    let importing = $state(false);

    let templatesByCategory = $derived(
        templates.reduce(
            (acc, t) => {
                if (!acc[t.category]) acc[t.category] = [];
                acc[t.category].push(t);
                return acc;
            },
            {} as Record<string, TemplateFile[]>
        )
    );

    async function loadTemplates() {
        loading = true;
        error = '';
        try {
            templates = await listTemplates();
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    }

    async function selectTemplate(template: TemplateFile) {
        selectedTemplate = template;
        contentLoading = true;
        try {
            templateContent = await readTemplate(template.path);
        } catch (e) {
            addToast(m.toast_failed_read_template({ error: String(e) }), 'error');
            templateContent = null;
        } finally {
            contentLoading = false;
        }
    }

    function backToList() {
        selectedTemplate = null;
        templateContent = null;
    }

    async function handleImport() {
        if (!selectedTemplate || !gamePath) return;

        importing = true;
        try {
            const importedPath = await importTemplate(gamePath, selectedTemplate.path);
            addToast(m.toast_template_imported({ name: selectedTemplate.name }), 'success');
            onimport();
            onclose();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            addToast(m.toast_failed_import_template({ error: message }), 'error');
        } finally {
            importing = false;
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            onclose();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (selectedTemplate) {
                backToList();
            } else {
                onclose();
            }
        }
    }

    $effect(() => {
        if (open) {
            loadTemplates();
        } else {
            selectedTemplate = null;
            templateContent = null;
        }
    });

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onclick={handleBackdropClick}
    >
        <div class="flex h-[600px] w-full max-w-3xl flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
                <div class="flex items-center gap-3">
                    {#if selectedTemplate}
                        <button
                            class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                            onclick={backToList}
                            title={m.modal_template_import_back_to_list()}
                        >
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    {/if}
                    <h2 class="text-base font-semibold text-zinc-100">
                        {selectedTemplate ? selectedTemplate.name : m.modal_template_import_title()}
                    </h2>
                </div>
                <button
                    class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    onclick={onclose}
                >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-auto px-5 py-4">
                {#if loading}
                    <div class="flex h-full items-center justify-center">
                        <div class="text-sm text-zinc-400">{m.modal_template_import_loading()}</div>
                    </div>
                {:else if error}
                    <div class="rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                {:else if selectedTemplate}
                    <!-- Template Preview -->
                    <div class="space-y-4">
                        <div class="rounded border border-zinc-700 bg-zinc-800/50 px-4 py-3">
                            <div class="mb-2 flex items-start justify-between">
                                <div>
                                    <div class="text-sm font-medium text-zinc-200">{selectedTemplate.name}</div>
                                    <div class="text-xs text-zinc-500">{selectedTemplate.category} • {formatFileSize(selectedTemplate.size)}</div>
                                </div>
                            </div>
                            <p class="text-xs text-zinc-400">{selectedTemplate.description}</p>
                        </div>

                        <div>
                            <div class="mb-2 text-xs font-medium text-zinc-400">{m.modal_template_import_preview()}</div>
                            {#if contentLoading}
                                <div class="flex items-center justify-center rounded border border-zinc-700 bg-zinc-800/30 py-8">
                                    <div class="text-xs text-zinc-500">{m.modal_template_import_loading_content()}</div>
                                </div>
                            {:else if templateContent}
                                <div class="h-[320px] overflow-hidden rounded border border-zinc-700">
                                    {#key selectedTemplate?.path}
                                        <MonacoEditor
                                            value={templateContent}
                                            language="gpc"
                                            readonly={true}
                                            onchange={() => {}}
                                        />
                                    {/key}
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <!-- Template List -->
                    <div class="space-y-4">
                        <p class="text-sm text-zinc-400">
                            {m.modal_template_import_description()}
                        </p>

                        {#each Object.entries(templatesByCategory) as [category, categoryTemplates]}
                            <div>
                                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{category}</h3>
                                <div class="space-y-1.5">
                                    {#each categoryTemplates as template}
                                        <button
                                            class="group w-full rounded border border-zinc-700 bg-zinc-800/30 px-4 py-3 text-left transition-all hover:border-emerald-500/50 hover:bg-zinc-800"
                                            onclick={() => selectTemplate(template)}
                                        >
                                            <div class="flex items-start justify-between">
                                                <div class="flex-1">
                                                    <div class="text-sm font-medium text-zinc-200 group-hover:text-emerald-400">{template.name}</div>
                                                    <div class="mt-1 text-xs text-zinc-500">{template.description}</div>
                                                </div>
                                                <div class="ml-3 text-xs text-zinc-600">{formatFileSize(template.size)}</div>
                                            </div>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/each}

                        {#if templates.length === 0}
                            <div class="rounded border border-zinc-700 bg-zinc-800/30 px-4 py-8 text-center">
                                <p class="text-sm text-zinc-500">{m.modal_template_import_no_templates()}</p>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            {#if selectedTemplate}
                <div class="flex items-center justify-between border-t border-zinc-700 px-5 py-3">
                    <button
                        class="text-sm text-zinc-500 hover:text-zinc-300"
                        onclick={backToList}
                    >
                        {m.common_back()}
                    </button>
                    <div class="flex gap-2">
                        <button
                            class="rounded border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                            onclick={onclose}
                        >
                            {m.common_cancel()}
                        </button>
                        <button
                            class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                            onclick={handleImport}
                            disabled={importing || !gamePath}
                        >
                            {importing ? m.common_importing() : m.modal_template_import_button()}
                        </button>
                    </div>
                </div>
            {:else}
                <div class="flex items-center justify-end border-t border-zinc-700 px-5 py-3">
                    <button
                        class="rounded bg-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
                        onclick={onclose}
                    >
                        {m.common_close()}
                    </button>
                </div>
            {/if}
        </div>
    </div>
{/if}
