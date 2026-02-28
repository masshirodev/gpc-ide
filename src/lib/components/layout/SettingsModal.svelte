<script lang="ts">
    import { getSettings, updateSettings, resetSettings, addWorkspace, removeWorkspace, addGameType, removeGameType, getAllGameTypes } from '$lib/stores/settings.svelte';
    import { themes } from '$lib/config/themes';
    import { pickWorkspaceDirectory, getDefaultWorkspace } from '$lib/tauri/commands';
    import { actions as kbActions, getKeyCombo, setKeyCombo, resetKeyCombo, resetAllKeybindings, eventToCombo } from '$lib/stores/keybindings.svelte';
    import * as m from '$lib/paraglide/messages.js';
    import { setLocale, locales } from '$lib/paraglide/runtime.js';

    const LANGUAGE_NAMES: Record<string, string> = {
        'en': 'English',
        'pt-br': 'Português (Brasil)'
    };

    function handleLanguageChange(newLocale: string) {
        updateSettings({ language: newLocale });
        localStorage.setItem('gpc-ide-locale', newLocale);
        setLocale(newLocale as any);
    }

    interface Props {
        open: boolean;
        onclose: () => void;
    }

    let { open, onclose }: Props = $props();
    let settingsStore = getSettings();
    let settings = $derived($settingsStore);

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            onclose();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (recordingActionId) {
            handleRecordKey(e);
            return;
        }
        if (e.key === 'Escape') {
            onclose();
        }
    }

    function handleReset() {
        resetSettings();
    }

    async function handleAddWorkspace() {
        const path = await pickWorkspaceDirectory();
        if (path) {
            addWorkspace(path);
        }
    }

    function handleRemoveWorkspace(path: string) {
        removeWorkspace(path);
    }

    async function handleAddDefaultWorkspace() {
        const defaultPath = await getDefaultWorkspace();
        addWorkspace(defaultPath);
    }

    let newGameType = $state('');
    let recordingActionId = $state<string | null>(null);

    function handleRecordKey(e: KeyboardEvent) {
        if (!recordingActionId) return;
        const combo = eventToCombo(e);
        if (!combo) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
            recordingActionId = null;
            return;
        }
        setKeyCombo(recordingActionId, combo);
        recordingActionId = null;
    }

    function handleAddGameType() {
        if (newGameType.trim()) {
            addGameType(newGameType.trim());
            newGameType = '';
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
        <div class="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
                <h2 class="text-base font-semibold text-zinc-100">{m.settings_title()}</h2>
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
            <div class="space-y-5 px-5 py-4" style="max-height: 70vh; overflow-y: auto;">
                <!-- Language Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_language()}</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="mb-1 block text-xs text-zinc-400" for="language">
                                {m.settings_language_label()}
                            </label>
                            <select
                                id="language"
                                class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                value={settings.language}
                                onchange={(e) => handleLanguageChange((e.target as HTMLSelectElement).value)}
                            >
                                {#each locales as locale}
                                    <option value={locale}>{LANGUAGE_NAMES[locale] ?? locale}</option>
                                {/each}
                            </select>
                            <p class="mt-1 text-xs text-zinc-500">
                                {m.settings_language_hint()}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Username Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_profile()}</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="mb-1 block text-xs text-zinc-400" for="username">
                                {m.settings_username_label()}
                            </label>
                            <input
                                id="username"
                                type="text"
                                class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                placeholder={m.settings_username_placeholder()}
                                value={settings.username}
                                oninput={(e) => updateSettings({ username: (e.target as HTMLInputElement).value })}
                            />
                            <p class="mt-1 text-xs text-zinc-500">
                                {m.settings_username_hint()}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- LSP Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_lsp()}</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="mb-1 block text-xs text-zinc-400" for="lsp-command">
                                {m.settings_lsp_command_label()}
                            </label>
                            <input
                                id="lsp-command"
                                type="text"
                                class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                placeholder={m.settings_lsp_command_placeholder()}
                                value={settings.customLspCommand}
                                oninput={(e) => updateSettings({ customLspCommand: (e.target as HTMLInputElement).value })}
                            />
                            <p class="mt-1 text-xs text-zinc-500">
                                {m.settings_lsp_command_hint()}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Workspaces Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_workspaces()}</h3>
                    <div class="space-y-2">
                        <p class="text-xs text-zinc-500">
                            {m.settings_workspaces_description()}
                        </p>

                        {#if settings.workspaces.length === 0}
                            <div class="rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-center">
                                <p class="text-xs text-zinc-400">{m.settings_workspaces_empty()}</p>
                                <button
                                    class="mt-2 text-xs text-emerald-500 hover:text-emerald-400"
                                    onclick={handleAddDefaultWorkspace}
                                >
                                    {m.settings_workspaces_add_default()}
                                </button>
                            </div>
                        {:else}
                            <div class="space-y-1.5">
                                {#each settings.workspaces as workspace}
                                    <div class="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5">
                                        <svg class="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                        <span class="flex-1 truncate text-xs text-zinc-300" title={workspace}>
                                            {workspace}
                                        </span>
                                        <button
                                            class="flex-shrink-0 text-zinc-500 hover:text-red-400"
                                            onclick={() => handleRemoveWorkspace(workspace)}
                                            title={m.settings_workspaces_remove()}
                                        >
                                            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        <button
                            class="flex w-full items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-500 hover:bg-zinc-700"
                            onclick={handleAddWorkspace}
                        >
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {m.settings_workspaces_add()}
                        </button>
                    </div>
                </div>

                <!-- Game Types Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_game_types()}</h3>
                    <div class="space-y-2">
                        <p class="text-xs text-zinc-500">
                            {m.settings_game_types_description()}
                        </p>

                        {#if settings.customGameTypes.length > 0}
                            <div class="flex flex-wrap gap-1.5">
                                {#each settings.customGameTypes as type}
                                    <span class="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                                        {type.toUpperCase()}
                                        <button
                                            class="ml-0.5 text-zinc-500 hover:text-red-400"
                                            onclick={() => removeGameType(type)}
                                            title={m.settings_game_types_remove()}
                                        >
                                            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </span>
                                {/each}
                            </div>
                        {/if}

                        <div class="flex gap-2">
                            <input
                                type="text"
                                class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                placeholder={m.settings_game_types_placeholder()}
                                bind:value={newGameType}
                                onkeydown={(e) => { if (e.key === 'Enter') handleAddGameType(); }}
                            />
                            <button
                                class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-500 hover:bg-zinc-700 disabled:opacity-50"
                                onclick={handleAddGameType}
                                disabled={!newGameType.trim()}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Editor Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_editor()}</h3>
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="mb-1 block text-xs text-zinc-400" for="font-size">
                                    {m.settings_editor_font_size()}
                                </label>
                                <input
                                    id="font-size"
                                    type="number"
                                    min="8"
                                    max="32"
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                    value={settings.editorFontSize}
                                    onchange={(e) => updateSettings({ editorFontSize: parseInt((e.target as HTMLInputElement).value) || 13 })}
                                />
                            </div>
                            <div>
                                <label class="mb-1 block text-xs text-zinc-400" for="tab-size">
                                    {m.settings_editor_tab_size()}
                                </label>
                                <input
                                    id="tab-size"
                                    type="number"
                                    min="1"
                                    max="8"
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                    value={settings.editorTabSize}
                                    onchange={(e) => updateSettings({ editorTabSize: parseInt((e.target as HTMLInputElement).value) || 4 })}
                                />
                            </div>
                        </div>
                        <div>
                            <label class="mb-1 block text-xs text-zinc-400" for="font-family">
                                {m.settings_editor_font_family()}
                            </label>
                            <input
                                id="font-family"
                                type="text"
                                list="font-suggestions"
                                class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                placeholder={m.settings_editor_font_family_placeholder()}
                                value={settings.editorFontFamily}
                                oninput={(e) => updateSettings({ editorFontFamily: (e.target as HTMLInputElement).value })}
                            />
                            <datalist id="font-suggestions">
                                <option value="JetBrains Mono, Fira Code, Cascadia Code, monospace">JetBrains Mono</option>
                                <option value="Fira Code, JetBrains Mono, Cascadia Code, monospace">Fira Code</option>
                                <option value="Cascadia Code, JetBrains Mono, Fira Code, monospace">Cascadia Code</option>
                                <option value="Iosevka NF Mono, monospace">Iosevka NF Mono</option>
                                <option value="Source Code Pro, monospace">Source Code Pro</option>
                                <option value="Consolas, monospace">Consolas</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="Menlo, monospace">Menlo</option>
                                <option value="monospace">System Monospace</option>
                            </datalist>
                            <p class="mt-1 text-xs text-zinc-500">
                                {m.settings_editor_font_family_hint()}
                            </p>
                        </div>
                        <div>
                            <label class="mb-1 block text-xs text-zinc-400" for="theme">
                                {m.settings_editor_theme()}
                            </label>
                            <select
                                id="theme"
                                class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                value={settings.editorTheme}
                                onchange={(e) => updateSettings({ editorTheme: (e.target as HTMLSelectElement).value })}
                            >
                                {#each themes as theme}
                                    <option value={theme.id}>{theme.name}</option>
                                {/each}
                            </select>
                            {#if settings.editorTheme}
                                {@const currentTheme = themes.find(t => t.id === settings.editorTheme)}
                                {#if currentTheme}
                                    <p class="mt-1 text-xs text-zinc-500">
                                        {currentTheme.description}
                                    </p>
                                {/if}
                            {/if}
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                                    checked={settings.editorMinimap}
                                    onchange={() => updateSettings({ editorMinimap: !settings.editorMinimap })}
                                />
                                {m.settings_editor_minimap()}
                            </label>
                            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                                    checked={settings.editorStickyScroll}
                                    onchange={() => updateSettings({ editorStickyScroll: !settings.editorStickyScroll })}
                                />
                                {m.settings_editor_sticky_scroll()}
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Workflow Section -->
                <div>
                    <h3 class="mb-2 text-sm font-medium text-zinc-300">{m.settings_workflow()}</h3>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                                    checked={settings.autoSave}
                                    onchange={() => updateSettings({ autoSave: !settings.autoSave })}
                                />
                                {m.settings_workflow_autosave()}
                            </label>
                            {#if settings.autoSave}
                                <div class="flex items-center gap-2">
                                    <label class="text-xs text-zinc-500" for="auto-save-delay">{m.settings_workflow_autosave_delay()}</label>
                                    <input
                                        id="auto-save-delay"
                                        type="number"
                                        min="500"
                                        max="10000"
                                        step="500"
                                        class="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                        value={settings.autoSaveDelay}
                                        onchange={(e) => updateSettings({ autoSaveDelay: parseInt((e.target as HTMLInputElement).value) || 1000 })}
                                    />
                                    <span class="text-xs text-zinc-500">ms</span>
                                </div>
                            {/if}
                        </div>
                        <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                            <input
                                type="checkbox"
                                class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                                checked={settings.sessionRestore}
                                onchange={() => updateSettings({ sessionRestore: !settings.sessionRestore })}
                            />
                            {m.settings_workflow_session_restore()}
                        </label>
                    </div>
                </div>

                <!-- Keybindings Section -->
                <div>
                    <div class="mb-2 flex items-center justify-between">
                        <h3 class="text-sm font-medium text-zinc-300">{m.settings_keybindings()}</h3>
                        <button
                            class="text-xs text-zinc-500 hover:text-zinc-300"
                            onclick={resetAllKeybindings}
                        >
                            {m.settings_keybindings_reset_all()}
                        </button>
                    </div>
                    <div class="space-y-1">
                        {#each kbActions as action}
                            <div class="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
                                <div>
                                    <span class="text-xs text-zinc-300">{action.label}</span>
                                    <span class="ml-2 text-[10px] text-zinc-600">{action.category}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    {#if recordingActionId === action.id}
                                        <span class="animate-pulse rounded border border-emerald-500 bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">
                                            {m.settings_keybindings_press_keys()}
                                        </span>
                                    {:else}
                                        <button
                                            class="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300 hover:border-zinc-500"
                                            onclick={() => { recordingActionId = action.id; }}
                                            title={m.settings_keybindings_click_to_rebind()}
                                        >
                                            {getKeyCombo(action.id)}
                                        </button>
                                    {/if}
                                    {#if getKeyCombo(action.id) !== action.defaultKey}
                                        <button
                                            class="text-xs text-zinc-500 hover:text-zinc-300"
                                            onclick={() => resetKeyCombo(action.id)}
                                            title={m.settings_keybindings_reset_to_default()}
                                        >
                                            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between border-t border-zinc-700 px-5 py-3">
                <button
                    class="text-xs text-zinc-500 hover:text-zinc-300"
                    onclick={handleReset}
                >
                    {m.settings_reset_defaults()}
                </button>
                <button
                    class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                    onclick={onclose}
                >
                    Done
                </button>
            </div>
        </div>
    </div>
{/if}
