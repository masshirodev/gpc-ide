<script lang="ts">
    import { saveUserModule } from '$lib/tauri/commands';
    import { addToast } from '$lib/stores/toast.svelte';
    import { getSettings, getAllGameTypes } from '$lib/stores/settings.svelte';
    import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';

    interface Props {
        open: boolean;
        onclose: () => void;
        onsuccess: () => void;
    }

    let { open, onclose, onsuccess }: Props = $props();

    let settingsStore = getSettings();
    let settings = $derived($settingsStore);

    // Form state
    let moduleId = $state('');
    let displayName = $state('');
    let moduleType = $state('fps');
    let gameTypeOptions = $derived([...getAllGameTypes(settings), 'all']);
    let description = $state('');
    let hasQuickToggle = $state(false);
    let stateDisplay = $state('');
    let statusVar = $state('');

    // Options
    let options = $state<Array<{
        name: string;
        var: string;
        type: 'toggle' | 'value';
        default: string;
        min: string;
        max: string;
    }>>([]);

    // Combo code
    let trigger = $state('');
    let combo = $state('');

    // Advanced fields
    let showAdvanced = $state(false);
    let conflicts = $state<string[]>([]);
    let conflictInput = $state('');
    let needsWeapondata = $state(false);
    let needsRecoiltable = $state(false);
    let requiresKeyboardFile = $state(false);
    let menuPriority = $state('');
    let extraVars = $state<Array<{ name: string; type: string }>>([]);
    let params = $state<Array<{ key: string; prompt: string; type: string; default: string }>>([]);
    let hasConfigMenu = $state(false);
    let configMenuName = $state('');
    let configMenuType = $state('clickable');
    let configMenuDisplayFn = $state('');
    let configMenuEditFn = $state('');
    let configMenuRenderFn = $state('');
    let configMenuProfileAware = $state(false);

    let creating = $state(false);
    let error = $state('');

    function resetForm() {
        moduleId = '';
        displayName = '';
        moduleType = 'fps';
        description = '';
        hasQuickToggle = false;
        stateDisplay = '';
        statusVar = '';
        options = [];
        trigger = '';
        combo = '';
        showAdvanced = false;
        conflicts = [];
        conflictInput = '';
        needsWeapondata = false;
        needsRecoiltable = false;
        requiresKeyboardFile = false;
        menuPriority = '';
        extraVars = [];
        params = [];
        hasConfigMenu = false;
        configMenuName = '';
        configMenuType = 'clickable';
        configMenuDisplayFn = '';
        configMenuEditFn = '';
        configMenuRenderFn = '';
        configMenuProfileAware = false;
        error = '';
    }

    function addOption() {
        options = [...options, { name: '', var: '', type: 'toggle', default: '0', min: '0', max: '100' }];
    }

    function removeOption(index: number) {
        options = options.filter((_, i) => i !== index);
    }

    function addConflict() {
        const id = conflictInput.trim().toLowerCase();
        if (id && !conflicts.includes(id)) {
            conflicts = [...conflicts, id];
            conflictInput = '';
        }
    }

    function removeConflict(id: string) {
        conflicts = conflicts.filter(c => c !== id);
    }

    function addExtraVar() {
        extraVars = [...extraVars, { name: '', type: 'int' }];
    }

    function removeExtraVar(index: number) {
        extraVars = extraVars.filter((_, i) => i !== index);
    }

    function addParam() {
        params = [...params, { key: '', prompt: '', type: 'button', default: '' }];
    }

    function removeParam(index: number) {
        params = params.filter((_, i) => i !== index);
    }

    function generateToml(): string {
        let out = `[${moduleId}]\n`;
        out += `id = "${moduleId}"\n`;
        out += `display_name = "${displayName}"\n`;
        out += `type = "${moduleType}"\n`;

        if (description) {
            out += `description = "${description}"\n`;
        }
        if (stateDisplay) {
            out += `state_display = "${stateDisplay}"\n`;
        }
        if (statusVar) {
            out += `status_var = "${statusVar}"\n`;
        }
        if (hasQuickToggle) {
            out += `has_quick_toggle = true\n`;
        }
        if (needsWeapondata) {
            out += `needs_weapondata = true\n`;
        }
        if (needsRecoiltable) {
            out += `needs_recoiltable = true\n`;
        }
        if (requiresKeyboardFile) {
            out += `requires_keyboard_file = true\n`;
        }
        if (menuPriority !== '') {
            out += `menu_priority = ${parseInt(menuPriority) || 0}\n`;
        }
        if (conflicts.length > 0) {
            out += `conflicts = [${conflicts.map(c => `"${c}"`).join(', ')}]\n`;
        }

        if (trigger.trim()) {
            out += `trigger = """\n${trigger.trim()}\n"""\n`;
        }
        if (combo.trim()) {
            out += `combo = """\n${combo.trim()}\n"""\n`;
        }

        for (const opt of options) {
            if (!opt.name || !opt.var) continue;
            out += `\n[[${moduleId}.options]]\n`;
            out += `name = "${opt.name}"\n`;
            out += `var = "${opt.var}"\n`;
            out += `type = "${opt.type}"\n`;
            out += `default = ${opt.default || '0'}\n`;
            if (opt.type === 'value') {
                out += `min = ${opt.min || '0'}\n`;
                out += `max = ${opt.max || '100'}\n`;
            }
        }

        // Params
        for (const p of params) {
            if (!p.key) continue;
            out += `\n[[${moduleId}.params]]\n`;
            out += `key = "${p.key}"\n`;
            out += `prompt = "${p.prompt}"\n`;
            out += `type = "${p.type}"\n`;
            if (p.default) out += `default = "${p.default}"\n`;
        }

        // Extra vars
        const validVars = extraVars.filter(v => v.name.trim());
        if (validVars.length > 0) {
            out += `\n[${moduleId}.extra_vars]\n`;
            for (const v of validVars) {
                out += `${v.name} = "${v.type}"\n`;
            }
        }

        // Config menu
        if (hasConfigMenu && configMenuName) {
            out += `\n[${moduleId}.config_menu]\n`;
            out += `name = "${configMenuName}"\n`;
            out += `type = "${configMenuType}"\n`;
            if (configMenuDisplayFn) out += `display_function = "${configMenuDisplayFn}"\n`;
            if (configMenuEditFn) out += `edit_function = "${configMenuEditFn}"\n`;
            if (configMenuRenderFn) out += `render_function = "${configMenuRenderFn}"\n`;
            if (configMenuProfileAware) out += `profile_aware = true\n`;
        }

        return out;
    }

    async function handleCreate() {
        if (!moduleId.trim() || !displayName.trim() || creating) return;

        // Validate module ID (no spaces, lowercase)
        if (!/^[a-z][a-z0-9_]*$/.test(moduleId)) {
            error = 'Module ID must start with a letter and contain only lowercase letters, numbers, and underscores.';
            return;
        }

        if (settings.workspaces.length === 0) {
            error = 'No workspace configured. Add a workspace in Settings first.';
            return;
        }

        creating = true;
        error = '';

        try {
            const toml = generateToml();
            await saveUserModule(settings.workspaces[0], toml);
            addToast(`Module "${displayName}" created`, 'success');
            resetForm();
            onsuccess();
            onclose();
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            creating = false;
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) handleClose();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') handleClose();
    }

    function handleClose() {
        if (!creating) {
            resetForm();
            onclose();
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
        <div class="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
                <h2 class="text-base font-semibold text-zinc-100">Create Module</h2>
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
            <div class="space-y-4 px-5 py-4" style="max-height: 65vh; overflow-y: auto;">
                <!-- Basic Info -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300" for="mod-id">Module ID</label>
                        <input
                            id="mod-id"
                            type="text"
                            bind:value={moduleId}
                            placeholder="e.g., my_feature"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                            disabled={creating}
                        />
                        <p class="mt-1 text-xs text-zinc-500">Lowercase, no spaces (a-z, 0-9, _)</p>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300" for="mod-name">Display Name</label>
                        <input
                            id="mod-name"
                            type="text"
                            bind:value={displayName}
                            placeholder="e.g., My Feature"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                            disabled={creating}
                        />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300" for="mod-type">Game Type</label>
                        <select
                            id="mod-type"
                            bind:value={moduleType}
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                            disabled={creating}
                        >
                            {#each gameTypeOptions as type}
                                <option value={type}>{type === 'all' ? 'All Types' : type.toUpperCase()}</option>
                            {/each}
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300" for="mod-desc">Description</label>
                        <input
                            id="mod-desc"
                            type="text"
                            bind:value={description}
                            placeholder="Brief description"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                            disabled={creating}
                        />
                    </div>
                </div>

                <!-- Status display / Quick Toggle -->
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300" for="mod-sd">State Display</label>
                        <input
                            id="mod-sd"
                            type="text"
                            bind:value={stateDisplay}
                            placeholder="e.g., MF"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                            disabled={creating}
                        />
                        <p class="mt-1 text-xs text-zinc-500">Short label for OLED</p>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300" for="mod-sv">Status Variable</label>
                        <input
                            id="mod-sv"
                            type="text"
                            bind:value={statusVar}
                            placeholder="e.g., MyFeatureStatus"
                            class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                            disabled={creating}
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm text-zinc-300">Quick Toggle</label>
                        <div class="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2">
                            <input
                                type="checkbox"
                                bind:checked={hasQuickToggle}
                                class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                                disabled={creating}
                            />
                            <span class="text-sm text-zinc-300">Enable</span>
                        </div>
                    </div>
                </div>

                <!-- Options Section -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-zinc-300">Menu Options</span>
                        <button
                            class="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                            onclick={addOption}
                            disabled={creating}
                        >
                            + Add Option
                        </button>
                    </div>
                    {#each options as opt, i}
                        <div class="mb-2 flex gap-2 items-end rounded border border-zinc-800 bg-zinc-800/30 p-2">
                            <div class="flex-1">
                                <label class="mb-0.5 block text-xs text-zinc-500">Name</label>
                                <input
                                    type="text"
                                    bind:value={opt.name}
                                    placeholder="Status"
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div class="flex-1">
                                <label class="mb-0.5 block text-xs text-zinc-500">Variable</label>
                                <input
                                    type="text"
                                    bind:value={opt.var}
                                    placeholder="MyVar"
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div class="w-24">
                                <label class="mb-0.5 block text-xs text-zinc-500">Type</label>
                                <select
                                    bind:value={opt.type}
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="toggle">Toggle</option>
                                    <option value="value">Value</option>
                                </select>
                            </div>
                            <div class="w-16">
                                <label class="mb-0.5 block text-xs text-zinc-500">Default</label>
                                <input
                                    type="number"
                                    bind:value={opt.default}
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            {#if opt.type === 'value'}
                                <div class="w-14">
                                    <label class="mb-0.5 block text-xs text-zinc-500">Min</label>
                                    <input
                                        type="number"
                                        bind:value={opt.min}
                                        class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                                <div class="w-14">
                                    <label class="mb-0.5 block text-xs text-zinc-500">Max</label>
                                    <input
                                        type="number"
                                        bind:value={opt.max}
                                        class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            {/if}
                            <button
                                class="p-1 text-zinc-500 hover:text-red-400"
                                onclick={() => removeOption(i)}
                            >
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    {/each}
                    {#if options.length === 0}
                        <p class="text-xs text-zinc-500 py-2">No options added. Options create menu toggles/values for this module.</p>
                    {/if}
                </div>

                <!-- Advanced Options -->
                <div>
                    <button
                        class="flex w-full items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                        onclick={() => showAdvanced = !showAdvanced}
                    >
                        <svg
                            class="h-4 w-4 transition-transform {showAdvanced ? 'rotate-90' : ''}"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                        Advanced Options
                    </button>

                    {#if showAdvanced}
                        <div class="mt-3 space-y-4 rounded border border-zinc-800 bg-zinc-800/20 p-4">
                            <!-- Flags -->
                            <div>
                                <span class="mb-2 block text-xs font-medium text-zinc-400">Flags</span>
                                <div class="flex flex-wrap gap-4">
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" bind:checked={needsWeapondata} class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500" disabled={creating} />
                                        <span class="text-xs text-zinc-300">Needs Weapondata</span>
                                    </label>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" bind:checked={needsRecoiltable} class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500" disabled={creating} />
                                        <span class="text-xs text-zinc-300">Needs Recoil Table</span>
                                    </label>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" bind:checked={requiresKeyboardFile} class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500" disabled={creating} />
                                        <span class="text-xs text-zinc-300">Requires Keyboard File</span>
                                    </label>
                                </div>
                            </div>

                            <!-- Menu Priority -->
                            <div class="w-32">
                                <label class="mb-1 block text-xs text-zinc-400">Menu Priority</label>
                                <input
                                    type="number"
                                    bind:value={menuPriority}
                                    placeholder="Optional"
                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                    disabled={creating}
                                />
                                <p class="mt-0.5 text-[10px] text-zinc-500">Lower = earlier in menu</p>
                            </div>

                            <!-- Conflicts -->
                            <div>
                                <span class="mb-1 block text-xs font-medium text-zinc-400">Conflicts</span>
                                {#if conflicts.length > 0}
                                    <div class="mb-2 flex flex-wrap gap-1.5">
                                        {#each conflicts as conflict}
                                            <span class="flex items-center gap-1 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                                                {conflict}
                                                <button class="text-zinc-500 hover:text-red-400" onclick={() => removeConflict(conflict)}>
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
                                        bind:value={conflictInput}
                                        placeholder="Module ID to conflict with"
                                        class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addConflict(); } }}
                                        disabled={creating}
                                    />
                                    <button
                                        class="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                                        onclick={addConflict}
                                        disabled={!conflictInput.trim() || creating}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            <!-- Extra Variables -->
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-medium text-zinc-400">Extra Variables</span>
                                    <button
                                        class="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                                        onclick={addExtraVar}
                                        disabled={creating}
                                    >
                                        + Add
                                    </button>
                                </div>
                                {#each extraVars as v, i}
                                    <div class="mb-1 flex gap-2 items-center">
                                        <input
                                            type="text"
                                            bind:value={v.name}
                                            placeholder="VariableName"
                                            class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            bind:value={v.type}
                                            placeholder="int, int [10], etc."
                                            class="w-28 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <button class="p-0.5 text-zinc-500 hover:text-red-400" onclick={() => removeExtraVar(i)}>
                                            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                {/each}
                                {#if extraVars.length === 0}
                                    <p class="text-[10px] text-zinc-500">GPC variables this module needs declared (e.g., int MyTimer)</p>
                                {/if}
                            </div>

                            <!-- Parameters -->
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-medium text-zinc-400">Setup Parameters</span>
                                    <button
                                        class="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                                        onclick={addParam}
                                        disabled={creating}
                                    >
                                        + Add
                                    </button>
                                </div>
                                {#each params as p, i}
                                    <div class="mb-1 flex gap-2 items-center">
                                        <input
                                            type="text"
                                            bind:value={p.key}
                                            placeholder="Key"
                                            class="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            bind:value={p.prompt}
                                            placeholder="User prompt text"
                                            class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <select
                                            bind:value={p.type}
                                            class="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                                        >
                                            <option value="button">Button</option>
                                            <option value="number">Number</option>
                                        </select>
                                        <input
                                            type="text"
                                            bind:value={p.default}
                                            placeholder="Default"
                                            class="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <button class="p-0.5 text-zinc-500 hover:text-red-400" onclick={() => removeParam(i)}>
                                            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                {/each}
                                {#if params.length === 0}
                                    <p class="text-[10px] text-zinc-500">Parameters prompted during module setup (e.g., button selection)</p>
                                {/if}
                            </div>

                            <!-- Config Menu -->
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" bind:checked={hasConfigMenu} class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500" disabled={creating} />
                                    <span class="text-xs font-medium text-zinc-400">Custom Config Menu (OLED Submenu)</span>
                                </label>
                                {#if hasConfigMenu}
                                    <div class="space-y-2 rounded border border-zinc-700 bg-zinc-800/30 p-3">
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="mb-0.5 block text-[10px] text-zinc-500">Menu Name</label>
                                                <input type="text" bind:value={configMenuName} placeholder="Submenu title"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none" disabled={creating} />
                                            </div>
                                            <div>
                                                <label class="mb-0.5 block text-[10px] text-zinc-500">Type</label>
                                                <select bind:value={configMenuType}
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none" disabled={creating}>
                                                    <option value="clickable">Clickable</option>
                                                    <option value="custom">Custom</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="mb-0.5 block text-[10px] text-zinc-500">Display Function</label>
                                                <input type="text" bind:value={configMenuDisplayFn} placeholder="FnName"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none" disabled={creating} />
                                            </div>
                                            <div>
                                                <label class="mb-0.5 block text-[10px] text-zinc-500">Edit Function</label>
                                                <input type="text" bind:value={configMenuEditFn} placeholder="FnName"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none" disabled={creating} />
                                            </div>
                                            <div>
                                                <label class="mb-0.5 block text-[10px] text-zinc-500">Render Function</label>
                                                <input type="text" bind:value={configMenuRenderFn} placeholder="FnName"
                                                    class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none" disabled={creating} />
                                            </div>
                                        </div>
                                        <label class="flex items-center gap-2">
                                            <input type="checkbox" bind:checked={configMenuProfileAware} class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500" disabled={creating} />
                                            <span class="text-xs text-zinc-300">Profile Aware</span>
                                        </label>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Trigger Code -->
                <div>
                    <label class="mb-1 block text-sm text-zinc-300">Trigger Code</label>
                    <div class="h-32 overflow-hidden rounded border border-zinc-700">
                        <MonacoEditor
                            value={trigger}
                            language="gpc"
                            readonly={creating}
                            onchange={(v) => trigger = v}
                        />
                    </div>
                    <p class="mt-1 text-xs text-zinc-500">Code that runs in the main loop to trigger the combo</p>
                </div>

                <!-- Combo Code -->
                <div>
                    <label class="mb-1 block text-sm text-zinc-300">Combo Code</label>
                    <div class="h-48 overflow-hidden rounded border border-zinc-700">
                        <MonacoEditor
                            value={combo}
                            language="gpc"
                            readonly={creating}
                            onchange={(v) => combo = v}
                        />
                    </div>
                    <p class="mt-1 text-xs text-zinc-500">GPC combo definition</p>
                </div>

                {#if error}
                    <div class="rounded bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
                        {error}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between border-t border-zinc-700 px-5 py-3">
                <span class="text-xs text-zinc-500">
                    Saves to: {settings.workspaces.length > 0 ? settings.workspaces[0] : '(no workspace)'}/modules/
                </span>
                <div class="flex items-center gap-2">
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
                        disabled={!moduleId.trim() || !displayName.trim() || creating}
                    >
                        {creating ? 'Creating...' : 'Create Module'}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
