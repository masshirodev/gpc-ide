<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listModules,
		getModule,
		saveUserModule,
		deleteUserModule,
		exportModuleToml,
		importModuleToml
	} from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getSettings, getAllGameTypes } from '$lib/stores/settings.svelte';
	import MiniMonaco from '$lib/components/editor/MiniMonaco.svelte';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';
	import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
	import ToolHeader from '$lib/components/layout/ToolHeader.svelte';
	import type {
		ModuleSummary,
		ModuleDefinition,
		ModuleFormState,
		ModuleFormOption
	} from '$lib/types/module';
	import ButtonSelect from '$lib/components/inputs/ButtonSelect.svelte';
	import KeySelect from '$lib/components/inputs/KeySelect.svelte';
	import { parseComboField } from '$lib/flow/module-nodes';

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	// Module list state
	let modules = $state<ModuleSummary[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let filterTab = $state<'all' | 'user' | 'builtin'>('all');

	// Selection / mode
	let selectedModuleId = $state<string | null>(null);
	let selectedModule = $state<ModuleDefinition | null>(null);
	let loadingDetail = $state(false);
	let mode = $state<'browse' | 'create' | 'edit'>('browse');

	// Confirm dialog
	let confirmDialog = $state({ open: false, title: '', message: '', moduleId: '' });

	// Form state
	const EMPTY_FORM: ModuleFormState = {
		moduleId: '',
		displayName: '',
		moduleType: 'fps',
		flowTarget: 'gameplay',
		description: '',
		enableVariable: '',
		quickToggleMode: 'buttons',
		quickToggle: [],
		options: [],
		initCode: '',
		mainCode: '',
		functionsCode: '',
		comboCode: '',
		needsWeapondata: false,
		requiresKeyboardFile: false,
		conflicts: [],
		extraVars: [],
		params: []
	};

	let form = $state<ModuleFormState>({ ...EMPTY_FORM });
	let saving = $state(false);
	let formError = $state('');
	let showAdvanced = $state(false);
	let conflictInput = $state('');

	let gameTypeOptions = $derived([...getAllGameTypes(settings), 'all']);

	// Filtered modules
	let filteredModules = $derived.by(() => {
		let list = modules;
		if (filterTab === 'user') list = list.filter((m) => m.is_user_module);
		else if (filterTab === 'builtin') list = list.filter((m) => !m.is_user_module);
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(m) =>
					m.id.toLowerCase().includes(q) ||
					m.display_name.toLowerCase().includes(q) ||
					(m.description && m.description.toLowerCase().includes(q))
			);
		}
		return list;
	});

	// Auto-generate enable variable from module ID
	let autoEnableVar = $derived(
		form.moduleId
			? `${form.moduleId.charAt(0).toUpperCase()}${form.moduleId.slice(1).replace(/[^a-zA-Z0-9_]/g, '_')}_Enabled`
			: ''
	);

	onMount(() => {
		loadModules();
	});

	async function loadModules() {
		loading = true;
		try {
			modules = await listModules(undefined, settings.workspaces);
		} catch (e) {
			addToast(`Failed to load modules: ${e}`, 'error');
		} finally {
			loading = false;
		}
	}

	async function selectModule(id: string) {
		if (mode !== 'browse') return;
		selectedModuleId = id;
		loadingDetail = true;
		try {
			selectedModule = await getModule(id, settings.workspaces);
		} catch (e) {
			addToast(`Failed to load module: ${e}`, 'error');
			selectedModule = null;
		} finally {
			loadingDetail = false;
		}
	}

	function resetForm() {
		form = { ...EMPTY_FORM, options: [], extraVars: [], params: [], quickToggle: [], conflicts: [] };
		formError = '';
		showAdvanced = false;
		conflictInput = '';
	}

	function enterCreateMode() {
		resetForm();
		mode = 'create';
	}

	function enterEditMode(mod: ModuleDefinition) {
		// Parse legacy combo field into separate sections
		const parsed = parseComboField(mod.combo ?? '');

		form = {
			moduleId: mod.id,
			displayName: mod.display_name,
			moduleType: mod.type,
			flowTarget: (mod.flow_target as 'gameplay' | 'data') || 'gameplay',
			description: mod.description ?? '',
			enableVariable: mod.status_var ?? '',
			quickToggleMode:
				mod.quick_toggle && mod.quick_toggle.length > 0 && mod.quick_toggle[0]?.startsWith('KEY_')
					? 'key'
					: 'buttons',
			quickToggle: mod.quick_toggle ? [...mod.quick_toggle] : [],
			options: mod.options.map((o) => ({
				name: o.name,
				variable: o.var,
				type: (o.type === 'toggle' ? 'toggle' : o.type === 'array' ? 'array' : 'value') as
					| 'toggle'
					| 'value'
					| 'array',
				default: String(o.default ?? 0),
				min: String(o.min ?? 0),
				max: String(o.max ?? 100),
				arrayName: o.array_name ?? '',
				arraySize: String(o.array_size ?? 10),
				onChangeCode: o.on_change_code ?? ''
			})),
			// Use explicit fields if present, otherwise fall back to parsed combo
			initCode: mod.init_code ?? '',
			mainCode: mod.trigger ?? '',
			functionsCode: mod.functions_code ?? parsed.functionsCode,
			comboCode: mod.functions_code !== undefined ? (mod.combo ?? '') : parsed.comboCode,
			needsWeapondata: mod.needs_weapondata ?? false,
			requiresKeyboardFile: mod.requires_keyboard_file ?? false,
			conflicts: [...mod.conflicts],
			extraVars: Object.entries(mod.extra_vars).map(([name, type]) => ({ name, type })),
			params: mod.params.map((p) => ({
				key: p.key,
				prompt: p.prompt,
				type: p.type,
				default: p.default ?? ''
			}))
		};
		formError = '';
		showAdvanced =
			form.needsWeapondata ||
			form.requiresKeyboardFile ||
			form.conflicts.length > 0 ||
			form.extraVars.length > 0 ||
			form.params.length > 0;
		mode = 'edit';
	}

	function cancelForm() {
		resetForm();
		mode = 'browse';
	}

	function addOption() {
		form.options = [
			...form.options,
			{
				name: '',
				variable: '',
				type: 'toggle',
				default: '0',
				min: '0',
				max: '100',
				arrayName: '',
				arraySize: '10',
				onChangeCode: ''
			}
		];
	}

	function removeOption(index: number) {
		form.options = form.options.filter((_, i) => i !== index);
	}

	function addConflict() {
		const c = conflictInput.trim();
		if (c && !form.conflicts.includes(c)) {
			form.conflicts = [...form.conflicts, c];
		}
		conflictInput = '';
	}

	function removeConflict(c: string) {
		form.conflicts = form.conflicts.filter((x) => x !== c);
	}

	function addExtraVar() {
		form.extraVars = [...form.extraVars, { name: '', type: 'int' }];
	}

	function removeExtraVar(index: number) {
		form.extraVars = form.extraVars.filter((_, i) => i !== index);
	}

	function addParam() {
		form.params = [...form.params, { key: '', prompt: '', type: 'button', default: '' }];
	}

	function removeParam(index: number) {
		form.params = form.params.filter((_, i) => i !== index);
	}

	function buildModuleDefinition(): ModuleDefinition {
		const enableVar =
			form.flowTarget === 'gameplay' ? form.enableVariable || autoEnableVar : undefined;

		return {
			id: form.moduleId,
			display_name: form.displayName,
			type: form.moduleType,
			description: form.description || undefined,
			quick_toggle:
				form.flowTarget === 'gameplay' && form.quickToggle.length > 0
					? form.quickToggle
					: undefined,
			trigger: form.mainCode.trim() || undefined,
			combo: form.comboCode.trim() || undefined,
			init_code: form.initCode.trim() || undefined,
			functions_code: form.functionsCode.trim() || undefined,
			options: form.options
				.filter((o) => o.name && o.variable)
				.map((o) => ({
					name: o.name,
					var: o.variable,
					type: o.type,
					default: Number(o.default) || 0,
					min: o.type === 'value' || o.type === 'array' ? Number(o.min) || 0 : undefined,
					max: o.type === 'value' || o.type === 'array' ? Number(o.max) || 100 : undefined,
					array_name: o.type === 'array' && o.arrayName ? o.arrayName : undefined,
					array_size: o.type === 'array' ? Number(o.arraySize) || 10 : undefined,
					on_change_code: o.onChangeCode.trim() || undefined
				})),
			extra_vars: Object.fromEntries(
				form.extraVars.filter((v) => v.name.trim()).map((v) => [v.name, v.type])
			),
			params: form.params
				.filter((p) => p.key.trim())
				.map((p) => ({
					key: p.key,
					prompt: p.prompt,
					type: p.type,
					default: p.default || undefined
				})),
			conflicts: form.conflicts,
			needs_weapondata: form.needsWeapondata || undefined,
			requires_keyboard_file: form.requiresKeyboardFile || undefined,
			flow_target: form.flowTarget,
			status_var: enableVar
		};
	}

	async function handleSave() {
		if (!form.moduleId.trim() || !form.displayName.trim() || saving) return;
		if (!/^[a-z][a-z0-9_]*$/.test(form.moduleId)) {
			formError =
				'Module ID must start with a letter and contain only lowercase letters, numbers, and underscores.';
			return;
		}
		if (settings.workspaces.length === 0) {
			formError = 'No workspace configured. Add a workspace in Settings first.';
			return;
		}

		saving = true;
		formError = '';
		try {
			const moduleDef = buildModuleDefinition();
			await saveUserModule(settings.workspaces[0], moduleDef);
			addToast(
				mode === 'create'
					? `Module "${form.displayName}" created`
					: `Module "${form.displayName}" updated`,
				'success'
			);
			resetForm();
			mode = 'browse';
			await loadModules();
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	function confirmDelete(mod: ModuleSummary) {
		confirmDialog = {
			open: true,
			title: 'Delete Module',
			message: `Are you sure you want to delete "${mod.display_name}" (${mod.id})? This cannot be undone.`,
			moduleId: mod.id
		};
	}

	async function handleDelete() {
		const id = confirmDialog.moduleId;
		confirmDialog = { open: false, title: '', message: '', moduleId: '' };
		try {
			await deleteUserModule(id, settings.workspaces);
			addToast(`Module "${id}" deleted`, 'success');
			if (selectedModuleId === id) {
				selectedModuleId = null;
				selectedModule = null;
			}
			await loadModules();
		} catch (e) {
			addToast(`Failed to delete module: ${e}`, 'error');
		}
	}

	async function handleExport(moduleId: string) {
		try {
			const result = await exportModuleToml(moduleId, settings.workspaces);
			if (result) {
				addToast(`Module exported successfully`, 'success');
			}
		} catch (e) {
			addToast(`Failed to export module: ${e}`, 'error');
		}
	}

	async function handleImport() {
		if (settings.workspaces.length === 0) {
			addToast('No workspace configured. Add a workspace in Settings first.', 'error');
			return;
		}
		try {
			const result = await importModuleToml(settings.workspaces[0]);
			if (result) {
				addToast(`Module "${result}" imported successfully`, 'success');
				await loadModules();
			}
		} catch (e) {
			addToast(`Failed to import module: ${e}`, 'error');
		}
	}

	const codeSections = [
		{
			key: 'initCode' as const,
			label: 'Init Code',
			hint: 'Runs once in init{} — initialization logic'
		},
		{
			key: 'mainCode' as const,
			label: 'Main Code',
			hint: 'Runs every frame in main{} — trigger conditions and per-frame logic'
		},
		{
			key: 'functionsCode' as const,
			label: 'Functions & Defines',
			hint: 'function definitions, define constants, const arrays'
		},
		{
			key: 'comboCode' as const,
			label: 'Combo Code',
			hint: 'combo Name { ... } blocks'
		}
	];
</script>

<div class="flex h-full flex-col bg-zinc-950 text-zinc-200">
	<!-- Top Bar -->
	<ToolHeader title="Module Manager" subtitle="Browse, create, and share game modules">
		{#if mode === 'browse'}
			<div class="ml-auto flex items-center gap-2">
				<button
					class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
					onclick={handleImport}
				>
					Import .toml
				</button>
				<button
					class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
					onclick={enterCreateMode}
				>
					+ New Module
				</button>
			</div>
		{/if}
	</ToolHeader>

	<!-- Main Content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left Panel: Module List -->
		<div class="flex w-80 shrink-0 flex-col border-r border-zinc-800">
			<!-- Search + Filter -->
			<div class="space-y-2 border-b border-zinc-800 p-3">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search modules..."
					class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
				/>
				<div class="flex gap-1">
					{#each [
						['all', 'All'],
						['user', 'User'],
						['builtin', 'Built-in']
					] as [value, label]}
						<button
							class="rounded px-2.5 py-1 text-xs transition-colors {filterTab === value
								? 'bg-zinc-700 text-zinc-100'
								: 'text-zinc-500 hover:text-zinc-300'}"
							onclick={() => (filterTab = value as 'all' | 'user' | 'builtin')}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Module List -->
			<div class="flex-1 overflow-y-auto">
				{#if loading}
					<div class="px-3 py-6 text-center text-xs text-zinc-500">Loading modules...</div>
				{:else if filteredModules.length === 0}
					<div class="px-3 py-6 text-center text-xs text-zinc-500">No modules found</div>
				{:else}
					{#each filteredModules as mod (mod.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div
							class="group flex w-full cursor-pointer items-start gap-2 border-b border-zinc-800/50 px-3 py-2.5 text-left transition-colors {selectedModuleId ===
								mod.id && mode === 'browse'
								? 'bg-zinc-800/80'
								: 'hover:bg-zinc-900'}"
							onclick={() => selectModule(mod.id)}
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-xs font-medium text-zinc-200"
										>{mod.display_name}</span
									>
									<span
										class="shrink-0 rounded px-1.5 py-0.5 text-[10px] {mod.is_user_module
											? 'bg-blue-900/40 text-blue-400'
											: 'bg-zinc-800 text-zinc-500'}"
									>
										{mod.is_user_module ? 'user' : 'built-in'}
									</span>
									{#if mod.flow_target === 'data'}
										<span
											class="shrink-0 rounded bg-purple-900/40 px-1.5 py-0.5 text-[10px] text-purple-400"
										>
											data
										</span>
									{/if}
								</div>
								<div class="mt-0.5 flex items-center gap-2">
									<span class="text-[10px] text-zinc-600">{mod.id}</span>
									<span
										class="rounded bg-zinc-800/60 px-1 py-0.5 text-[10px] text-zinc-500"
										>{mod.module_type}</span
									>
								</div>
								{#if mod.description}
									<p class="mt-1 truncate text-[10px] text-zinc-500">
										{mod.description}
									</p>
								{/if}
							</div>
							{#if mod.is_user_module}
								<button
									class="shrink-0 rounded p-1 text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										confirmDelete(mod);
									}}
									title="Delete module"
								>
									<svg
										class="h-3.5 w-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<!-- List footer -->
			<div class="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
				{filteredModules.length} module{filteredModules.length !== 1 ? 's' : ''}
			</div>
		</div>

		<!-- Right Panel: Detail / Form -->
		<div class="flex flex-1 flex-col overflow-hidden">
			{#if mode === 'create' || mode === 'edit'}
				<!-- Create / Edit Form -->
				<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
					<h2 class="text-sm font-semibold text-zinc-200">
						{mode === 'create'
							? 'Create Module'
							: `Edit: ${form.displayName || form.moduleId}`}
					</h2>
					<div class="flex items-center gap-2">
						<button
							class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
							onclick={cancelForm}
							disabled={saving}
						>
							Cancel
						</button>
						<button
							class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
							onclick={handleSave}
							disabled={!form.moduleId.trim() || !form.displayName.trim() || saving}
						>
							{saving
								? 'Saving...'
								: mode === 'create'
									? 'Create Module'
									: 'Save Changes'}
						</button>
					</div>
				</div>

				<div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<!-- Section A: Identity -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="mb-1 block text-sm text-zinc-300" for="mod-id"
								>Module ID</label
							>
							<input
								id="mod-id"
								type="text"
								bind:value={form.moduleId}
								placeholder="e.g., my_feature"
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
								disabled={saving || mode === 'edit'}
							/>
							<p class="mt-1 text-xs text-zinc-500">
								Lowercase, no spaces (a-z, 0-9, _)
							</p>
						</div>
						<div>
							<label class="mb-1 block text-sm text-zinc-300" for="mod-name"
								>Display Name</label
							>
							<input
								id="mod-name"
								type="text"
								bind:value={form.displayName}
								placeholder="e.g., My Feature"
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
								disabled={saving}
							/>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-4">
						<div>
							<label class="mb-1 block text-sm text-zinc-300" for="mod-type"
								>Game Type</label
							>
							<select
								id="mod-type"
								bind:value={form.moduleType}
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
								disabled={saving}
							>
								{#each gameTypeOptions as type}
									<option value={type}
										>{type === 'all' ? 'All Types' : type.toUpperCase()}</option
									>
								{/each}
							</select>
						</div>
						<div>
							<label class="mb-1 block text-sm text-zinc-300" for="mod-target"
								>Flow Target</label
							>
							<select
								id="mod-target"
								bind:value={form.flowTarget}
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
								disabled={saving}
							>
								<option value="gameplay">Gameplay</option>
								<option value="data">Data</option>
							</select>
						</div>
						<div>
							<label class="mb-1 block text-sm text-zinc-300" for="mod-desc"
								>Description</label
							>
							<input
								id="mod-desc"
								type="text"
								bind:value={form.description}
								placeholder="Brief description"
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
								disabled={saving}
							/>
						</div>
					</div>

					{#if form.flowTarget === 'data'}
						<div
							class="rounded border border-purple-800/40 bg-purple-900/10 px-3 py-2 text-xs text-purple-300"
						>
							Data modules run unconditionally and appear in the data flow tab. No
							enable variable or quick toggle needed.
						</div>
					{/if}

					<!-- Section B: Enable & Quick Toggle (gameplay only) -->
					{#if form.flowTarget === 'gameplay'}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="mb-1 block text-sm text-zinc-300">Enable Variable</label
								>
								<input
									type="text"
									bind:value={form.enableVariable}
									placeholder={autoEnableVar || 'Auto-generated from ID'}
									class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
									disabled={saving}
								/>
								<p class="mt-1 text-xs text-zinc-500">
									Leave empty to use: {autoEnableVar || '(enter module ID)'}
								</p>
							</div>
							<div>
								<div class="mb-1 flex items-center gap-3">
									<span class="text-sm text-zinc-300">Quick Toggle</span>
									<label class="flex items-center gap-1">
										<input
											type="radio"
											bind:group={form.quickToggleMode}
											value="buttons"
											class="h-3 w-3"
											onchange={() => {
												form.quickToggle = [];
											}}
										/>
										<span class="text-xs text-zinc-400">Buttons</span>
									</label>
									<label class="flex items-center gap-1">
										<input
											type="radio"
											bind:group={form.quickToggleMode}
											value="key"
											class="h-3 w-3"
											onchange={() => {
												form.quickToggle = [];
											}}
										/>
										<span class="text-xs text-zinc-400">Key</span>
									</label>
								</div>

								{#if form.quickToggleMode === 'buttons'}
									<div class="flex items-center gap-2">
										<div class="flex-1">
											<ButtonSelect
												value={form.quickToggle[0] ?? ''}
												onchange={(v) => {
													form.quickToggle = v
														? [v, ...form.quickToggle.slice(1)]
														: form.quickToggle.slice(1);
												}}
												placeholder="Button 1 (hold)..."
											/>
										</div>
										<span class="text-xs text-zinc-500">+</span>
										<div class="flex-1">
											<ButtonSelect
												value={form.quickToggle[1] ?? ''}
												onchange={(v) => {
													form.quickToggle = form.quickToggle[0]
														? [form.quickToggle[0], ...(v ? [v] : [])]
														: v
															? [v]
															: [];
												}}
												placeholder="Button 2 (press)..."
											/>
										</div>
									</div>
								{:else}
									<KeySelect
										value={form.quickToggle[0] ?? ''}
										onchange={(v) => {
											form.quickToggle = v ? [v] : [];
										}}
										placeholder="Select keyboard key..."
										allowEmpty={true}
									/>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Section C: Menu Options -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-medium text-zinc-300">Menu Options</span>
							<button
								class="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
								onclick={addOption}
								disabled={saving}
							>
								+ Add Option
							</button>
						</div>
						{#each form.options as opt, i}
							<div
								class="mb-2 flex items-end gap-2 rounded border border-zinc-800 bg-zinc-800/30 p-2"
							>
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
									<label class="mb-0.5 block text-xs text-zinc-500">Variable</label
									>
									<input
										type="text"
										bind:value={opt.variable}
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
										<option value="array">Array</option>
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
								{#if opt.type === 'value' || opt.type === 'array'}
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
								{#if opt.type === 'array'}
									<div class="w-20">
										<label class="mb-0.5 block text-xs text-zinc-500"
											>Array Name</label
										>
										<input
											type="text"
											bind:value={opt.arrayName}
											placeholder="ArrayData"
											class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
										/>
									</div>
									<div class="w-14">
										<label class="mb-0.5 block text-xs text-zinc-500">Size</label>
										<input
											type="number"
											bind:value={opt.arraySize}
											class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
										/>
									</div>
								{/if}
								<button
									class="p-1 text-zinc-500 hover:text-red-400"
									onclick={() => removeOption(i)}
								>
									<svg
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
						{/each}
						{#if form.options.length === 0}
							<p class="py-2 text-xs text-zinc-500">
								No options added. Options create menu toggles/values for this module.
							</p>
						{/if}
					</div>

					<!-- Section D: Code Sections -->
					<div class="space-y-3">
						<span class="text-sm font-medium text-zinc-300">Code Sections</span>
						{#each codeSections as section}
							<div>
								<label class="mb-0.5 block text-xs font-medium text-zinc-400"
									>{section.label}</label
								>
								<p class="mb-1 text-[10px] text-zinc-500">{section.hint}</p>
								<div class="h-28 overflow-hidden rounded border border-zinc-700">
									<MiniMonaco
										value={form[section.key]}
										language="gpc"
										readonly={saving}
										onchange={(v) => {
											form[section.key] = v;
										}}
										label={section.label}
									/>
								</div>
							</div>
						{/each}
					</div>

					<!-- Section E: Advanced -->
					<div>
						<button
							class="flex w-full items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
							onclick={() => (showAdvanced = !showAdvanced)}
						>
							<svg
								class="h-4 w-4 transition-transform {showAdvanced ? 'rotate-90' : ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
							Advanced Options
						</button>

						{#if showAdvanced}
							<div
								class="mt-3 space-y-4 rounded border border-zinc-800 bg-zinc-800/20 p-4"
							>
								<!-- Flags -->
								<div>
									<span class="mb-2 block text-xs font-medium text-zinc-400"
										>Flags</span
									>
									<div class="flex flex-wrap gap-4">
										<label class="flex items-center gap-2">
											<input
												type="checkbox"
												bind:checked={form.needsWeapondata}
												class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
												disabled={saving}
											/>
											<span class="text-xs text-zinc-300">Needs Weapondata</span
											>
										</label>
										<label class="flex items-center gap-2">
											<input
												type="checkbox"
												bind:checked={form.requiresKeyboardFile}
												class="rounded border-zinc-600 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
												disabled={saving}
											/>
											<span class="text-xs text-zinc-300"
												>Requires Keyboard File</span
											>
										</label>
									</div>
								</div>

								<!-- Conflicts -->
								<div>
									<span class="mb-1 block text-xs font-medium text-zinc-400"
										>Conflicts</span
									>
									{#if form.conflicts.length > 0}
										<div class="mb-2 flex flex-wrap gap-1.5">
											{#each form.conflicts as conflict}
												<span
													class="flex items-center gap-1 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
												>
													{conflict}
													<button
														class="text-zinc-500 hover:text-red-400"
														onclick={() => removeConflict(conflict)}
													>
														<svg
															class="h-3 w-3"
															viewBox="0 0 20 20"
															fill="currentColor"
														>
															<path
																fill-rule="evenodd"
																d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
																clip-rule="evenodd"
															/>
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
											onkeydown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													addConflict();
												}
											}}
											disabled={saving}
										/>
										<button
											class="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
											onclick={addConflict}
											disabled={!conflictInput.trim() || saving}
										>
											Add
										</button>
									</div>
								</div>

								<!-- Extra Variables -->
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs font-medium text-zinc-400"
											>Extra Variables</span
										>
										<button
											class="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
											onclick={addExtraVar}
											disabled={saving}
										>
											+ Add
										</button>
									</div>
									{#each form.extraVars as v, i}
										<div class="mb-1 flex items-center gap-2">
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
											<button
												class="p-0.5 text-zinc-500 hover:text-red-400"
												onclick={() => removeExtraVar(i)}
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										</div>
									{/each}
									{#if form.extraVars.length === 0}
										<p class="text-[10px] text-zinc-500">
											GPC variables this module needs declared (e.g., int
											MyTimer)
										</p>
									{/if}
								</div>

								<!-- Parameters -->
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs font-medium text-zinc-400"
											>Parameters</span
										>
										<button
											class="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
											onclick={addParam}
											disabled={saving}
										>
											+ Add
										</button>
									</div>
									<p class="mb-2 text-[10px] text-zinc-500">
										Parameters create #define constants that can be customized
										per-game when the module is installed.
									</p>
									{#each form.params as p, i}
										<div class="mb-1 flex items-center gap-2">
											<input
												type="text"
												bind:value={p.key}
												placeholder="DEFINE_NAME"
												class="w-28 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
											/>
											<input
												type="text"
												bind:value={p.prompt}
												placeholder="Description"
												class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
											/>
											<select
												bind:value={p.type}
												class="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
												onchange={() => {
													p.default = '';
												}}
											>
												<option value="button">Button</option>
												<option value="key">Key</option>
												<option value="number">Number</option>
											</select>
											<div class="w-28">
												{#if p.type === 'button'}
													<ButtonSelect
														value={p.default}
														onchange={(v) => {
															p.default = v;
														}}
														placeholder="Default..."
													/>
												{:else if p.type === 'key'}
													<KeySelect
														value={p.default}
														onchange={(v) => {
															p.default = v;
														}}
														placeholder="Default..."
														allowEmpty={true}
													/>
												{:else}
													<input
														type="number"
														bind:value={p.default}
														placeholder="0"
														class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
													/>
												{/if}
											</div>
											<button
												class="p-0.5 text-zinc-500 hover:text-red-400"
												onclick={() => removeParam(i)}
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
												</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					{#if formError}
						<div
							class="rounded border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400"
						>
							{formError}
						</div>
					{/if}

					<!-- Save location -->
					<div class="pb-4 text-xs text-zinc-500">
						Saves to: {settings.workspaces.length > 0
							? settings.workspaces[0]
							: '(no workspace)'}/modules/
					</div>
				</div>
			{:else if loadingDetail}
				<div class="flex flex-1 items-center justify-center text-xs text-zinc-500">
					Loading module details...
				</div>
			{:else if selectedModule}
				<!-- Detail View -->
				<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
					<div class="flex items-center gap-2">
						<h2 class="text-sm font-semibold text-zinc-200">
							{selectedModule.display_name}
						</h2>
						<span
							class="rounded px-1.5 py-0.5 text-[10px] {modules.find((m) => m.id === selectedModule?.id)?.is_user_module
								? 'bg-blue-900/40 text-blue-400'
								: 'bg-zinc-800 text-zinc-500'}"
						>
							{modules.find((m) => m.id === selectedModule?.id)?.is_user_module
								? 'user'
								: 'built-in'}
						</span>
						{#if selectedModule.flow_target === 'data'}
							<span
								class="rounded bg-purple-900/40 px-1.5 py-0.5 text-[10px] text-purple-400"
							>
								data
							</span>
						{/if}
					</div>
					{#if modules.find((m) => m.id === selectedModule?.id)?.is_user_module}
						<div class="flex items-center gap-2">
							<button
								class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
								onclick={() => {
									if (selectedModule) handleExport(selectedModule.id);
								}}
							>
								Export
							</button>
							<button
								class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
								onclick={() => {
									if (selectedModule) enterEditMode(selectedModule);
								}}
							>
								Edit
							</button>
						</div>
					{/if}
				</div>

				<div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<!-- Basic Info -->
					<div class="grid grid-cols-2 gap-x-6 gap-y-2">
						<div>
							<span class="text-xs text-zinc-500">ID</span>
							<p class="text-sm text-zinc-200">{selectedModule.id}</p>
						</div>
						<div>
							<span class="text-xs text-zinc-500">Type</span>
							<p class="text-sm text-zinc-200">{selectedModule.type.toUpperCase()}</p>
						</div>
						{#if selectedModule.description}
							<div class="col-span-2">
								<span class="text-xs text-zinc-500">Description</span>
								<p class="text-sm text-zinc-200">{selectedModule.description}</p>
							</div>
						{/if}
						{#if selectedModule.flow_target && selectedModule.flow_target !== 'gameplay'}
							<div>
								<span class="text-xs text-zinc-500">Flow Target</span>
								<p class="text-sm text-zinc-200">
									{selectedModule.flow_target}
								</p>
							</div>
						{/if}
						{#if selectedModule.quick_toggle && selectedModule.quick_toggle.length > 0}
							<div>
								<span class="text-xs text-zinc-500">Quick Toggle</span>
								<p class="font-mono text-sm text-emerald-400">
									{selectedModule.quick_toggle.join(' + ')}
								</p>
							</div>
						{/if}
					</div>

					<!-- Options -->
					{#if selectedModule.options && selectedModule.options.length > 0}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">
								Menu Options ({selectedModule.options.length})
							</h3>
							<div class="space-y-1">
								{#each selectedModule.options as opt}
									<div
										class="flex items-center gap-3 rounded bg-zinc-800/50 px-3 py-1.5 text-xs"
									>
										<span class="text-zinc-200">{opt.name}</span>
										<span class="font-mono text-zinc-500">{opt.var}</span>
										<span
											class="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400"
											>{opt.type}</span
										>
										{#if opt.default !== undefined}
											<span class="text-zinc-500"
												>default: {opt.default}</span
											>
										{/if}
										{#if (opt.type === 'value' || opt.type === 'array') && opt.min !== undefined}
											<span class="text-zinc-600"
												>({opt.min}-{opt.max})</span
											>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Conflicts -->
					{#if selectedModule.conflicts && selectedModule.conflicts.length > 0}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">Conflicts</h3>
							<div class="flex flex-wrap gap-1.5">
								{#each selectedModule.conflicts as conflict}
									<span
										class="rounded bg-red-900/20 px-2 py-0.5 text-xs text-red-400"
										>{conflict}</span
									>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Extra Vars -->
					{#if selectedModule.extra_vars && Object.keys(selectedModule.extra_vars).length > 0}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">
								Extra Variables
							</h3>
							<div class="space-y-1">
								{#each Object.entries(selectedModule.extra_vars) as [name, type]}
									<div class="text-xs">
										<span class="font-mono text-zinc-200">{type}</span>
										<span class="font-mono text-emerald-400">{name}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Params -->
					{#if selectedModule.params && selectedModule.params.length > 0}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">Parameters</h3>
							<div class="space-y-1">
								{#each selectedModule.params as p}
									<div
										class="flex items-center gap-3 rounded bg-zinc-800/50 px-3 py-1.5 text-xs"
									>
										<span class="font-mono text-zinc-200">{p.key}</span>
										<span class="text-zinc-400">{p.prompt}</span>
										<span
											class="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400"
											>{p.type}</span
										>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Flags -->
					{#if selectedModule.needs_weapondata || selectedModule.requires_keyboard_file}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">Flags</h3>
							<div class="flex flex-wrap gap-2">
								{#if selectedModule.needs_weapondata}
									<span
										class="rounded bg-amber-900/20 px-2 py-0.5 text-xs text-amber-400"
										>Needs Weapondata</span
									>
								{/if}
								{#if selectedModule.requires_keyboard_file}
									<span
										class="rounded bg-amber-900/20 px-2 py-0.5 text-xs text-amber-400"
										>Requires Keyboard File</span
									>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Code Sections -->
					{#if selectedModule.init_code}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">Init Code</h3>
							<div class="h-32 overflow-hidden rounded border border-zinc-700">
								<MonacoEditor
									value={selectedModule.init_code}
									language="gpc"
									readonly={true}
								/>
							</div>
						</div>
					{/if}

					{#if selectedModule.trigger}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">
								{selectedModule.init_code || selectedModule.functions_code
									? 'Main Code'
									: 'Trigger Code'}
							</h3>
							<div class="h-32 overflow-hidden rounded border border-zinc-700">
								<MonacoEditor
									value={selectedModule.trigger}
									language="gpc"
									readonly={true}
								/>
							</div>
						</div>
					{/if}

					{#if selectedModule.functions_code}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">
								Functions & Defines
							</h3>
							<div class="h-32 overflow-hidden rounded border border-zinc-700">
								<MonacoEditor
									value={selectedModule.functions_code}
									language="gpc"
									readonly={true}
								/>
							</div>
						</div>
					{/if}

					{#if selectedModule.combo}
						<div>
							<h3 class="mb-2 text-xs font-medium text-zinc-400">Combo Code</h3>
							<div class="h-48 overflow-hidden rounded border border-zinc-700">
								<MonacoEditor
									value={selectedModule.combo}
									language="gpc"
									readonly={true}
								/>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Empty state -->
				<div
					class="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500"
				>
					<svg
						class="h-10 w-10 text-zinc-700"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"
						/>
					</svg>
					<p class="text-xs">
						Select a module to view details, or create a new one
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	open={confirmDialog.open}
	title={confirmDialog.title}
	message={confirmDialog.message}
	onconfirm={handleDelete}
	oncancel={() => {
		confirmDialog = { open: false, title: '', message: '', moduleId: '' };
	}}
/>
