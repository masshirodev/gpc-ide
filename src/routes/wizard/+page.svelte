<script lang="ts">
	import { goto } from '$app/navigation';
	import { listModules, createGame, validateModuleSelection } from '$lib/tauri/commands';
	import type { ModuleSummary } from '$lib/types/module';
	import type { CreateGameParams } from '$lib/tauri/commands';
	import { loadGames } from '$lib/stores/game.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import KeySelect from '$lib/components/inputs/KeySelect.svelte';

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	// Wizard state
	let step = $state(0);
	const steps = ['Game Info', 'Modules', 'Configure', 'Review'];

	// Step 1: Game Info
	let gameName = $state('');
	let gameType = $state('fps');
	let version = $state(1);
	let profiles = $state(0);

	// Step 2: Module Selection
	let availableModules = $state<ModuleSummary[]>([]);
	let selectedModuleIds = $state<Set<string>>(new Set());
	let modulesLoading = $state(false);
	let moduleError = $state('');

	// Step 3: Module Config
	let moduleParams = $state<Record<string, Record<string, string>>>({});
	let quickToggles = $state<Record<string, string>>({});
	let weaponNamesText = $state('');

	// Step 4: Create
	let creating = $state(false);
	let createError = $state('');

	// Derived
	let needsWeapondata = $derived(
		availableModules.some(
			(m) => selectedModuleIds.has(m.id) && m.needs_weapondata
		)
	);
	let hasWeapondata = $derived(selectedModuleIds.has('weapondata'));
	let selectedModules = $derived(
		availableModules.filter((m) => selectedModuleIds.has(m.id))
	);
	let modulesWithParams = $derived(
		selectedModules.filter((m) => m.param_count > 0 || m.has_quick_toggle)
	);
	let weaponNames = $derived(
		weaponNamesText
			.split(',')
			.map((n) => n.trim())
			.filter((n) => n.length > 0)
	);

	// Validation
	let step1Valid = $derived(gameName.trim().length > 0);
	let step2Valid = $derived(true); // modules are optional

	async function loadModules() {
		modulesLoading = true;
		moduleError = '';
		try {
			// fps and tps share modules
			const type = gameType === 'tps' ? 'fps' : gameType;
			const allForType = await listModules(type);
			// Also include "all" type modules
			const allType = await listModules('all');
			const ids = new Set(allForType.map((m) => m.id));
			for (const m of allType) {
				if (!ids.has(m.id)) allForType.push(m);
			}
			availableModules = allForType;
		} catch (e) {
			moduleError = e instanceof Error ? e.message : String(e);
		} finally {
			modulesLoading = false;
		}
	}

	function toggleModule(id: string) {
		const newSet = new Set(selectedModuleIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			// Check conflicts
			const module = availableModules.find((m) => m.id === id);
			if (module) {
				for (const conflict of module.conflicts) {
					if (newSet.has(conflict)) {
						const conflicting = availableModules.find((m) => m.id === conflict);
						moduleError = `${module.display_name} conflicts with ${conflicting?.display_name ?? conflict}`;
						return;
					}
				}
			}
			moduleError = '';
			newSet.add(id);
		}
		selectedModuleIds = newSet;
	}

	async function nextStep() {
		if (step === 0) {
			// Moving to module selection - load modules for this game type
			await loadModules();
		}
		if (step === 1) {
			// Moving to config - initialize default params
			// This would need getModule for full details, but we can work with summaries for now
			moduleParams = {};
			quickToggles = {};
		}
		step++;
	}

	function prevStep() {
		if (step > 0) step--;
	}

	async function handleCreate() {
		creating = true;
		createError = '';
		try {
			const params: CreateGameParams = {
				name: gameName.trim(),
				game_type: gameType,
				version,
				profiles,
				module_ids: Array.from(selectedModuleIds),
				module_params: moduleParams,
				quick_toggles: quickToggles,
				weapon_names: hasWeapondata || needsWeapondata ? weaponNames : [],
				workspace_path: settings.workspaces.length > 0 ? settings.workspaces[0] : undefined
			};

			const result = await createGame(params);

			// Refresh the game list
			await loadGames(settings.workspaces);

			// Navigate to dashboard
			goto('/');
		} catch (e) {
			createError = e instanceof Error ? e.message : String(e);
		} finally {
			creating = false;
		}
	}
</script>

<div class="mx-auto max-w-3xl">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center gap-4">
			<a href="/" class="text-zinc-400 hover:text-zinc-200">
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</a>
			<h1 class="text-2xl font-bold text-zinc-100">New Game</h1>
		</div>
	</div>

	<!-- Step Indicator -->
	<div class="mb-8 flex items-center gap-2">
		{#each steps as label, i}
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium {i < step
						? 'bg-emerald-600 text-white'
						: i === step
							? 'bg-emerald-600 text-white'
							: 'bg-zinc-800 text-zinc-500'}"
				>
					{#if i < step}
						<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					{:else}
						{i + 1}
					{/if}
				</div>
				<span
					class="text-sm {i <= step ? 'text-zinc-200' : 'text-zinc-500'}"
				>
					{label}
				</span>
			</div>
			{#if i < steps.length - 1}
				<div class="h-px flex-1 {i < step ? 'bg-emerald-600' : 'bg-zinc-700'}"></div>
			{/if}
		{/each}
	</div>

	<!-- Step Content -->
	<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
		{#if step === 0}
			<!-- Step 1: Game Info -->
			<h2 class="mb-6 text-lg font-semibold text-zinc-100">Game Information</h2>

			<div class="space-y-5">
				<div>
					<label for="game-name" class="mb-1.5 block text-sm font-medium text-zinc-300">
						Game Name
					</label>
					<input
						id="game-name"
						type="text"
						bind:value={gameName}
						placeholder="e.g., Delta or Shooter/Delta"
						class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					<p class="mt-1 text-xs text-zinc-500">
						Use a path like "Shooter/Delta" for nested organization
					</p>
				</div>

				<div>
					<label for="game-type" class="mb-1.5 block text-sm font-medium text-zinc-300">
						Game Type
					</label>
					<select
						id="game-type"
						bind:value={gameType}
						class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					>
						<option value="fps">FPS - First-person Shooter</option>
						<option value="tps">TPS - Third-person Shooter</option>
						<option value="fgs">FGS - Fighting Game</option>
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="version" class="mb-1.5 block text-sm font-medium text-zinc-300">
							Version
						</label>
						<input
							id="version"
							type="number"
							bind:value={version}
							min="1"
							class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>
					<div>
						<label for="profiles" class="mb-1.5 block text-sm font-medium text-zinc-300">
							Profiles
						</label>
						<select
							id="profiles"
							bind:value={profiles}
							class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value={0}>No profiles</option>
							<option value={2}>2 profiles</option>
						</select>
					</div>
				</div>
			</div>

		{:else if step === 1}
			<!-- Step 2: Module Selection -->
			<h2 class="mb-2 text-lg font-semibold text-zinc-100">Select Modules</h2>
			<p class="mb-4 text-sm text-zinc-400">
				Choose modules to include in your game script. Dependencies will be added automatically.
			</p>

			{#if moduleError}
				<div class="mb-4 rounded border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
					{moduleError}
				</div>
			{/if}

			{#if modulesLoading}
				<div class="py-8 text-center text-zinc-500">Loading modules...</div>
			{:else}
				<div class="space-y-1.5">
					{#each availableModules as module}
						{@const isSelected = selectedModuleIds.has(module.id)}
						{@const isAutoRequired = needsWeapondata && module.id === 'weapondata' && !isSelected}
						<button
							class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors
								{isSelected
									? 'border border-emerald-700 bg-emerald-900/30'
									: isAutoRequired
										? 'border border-amber-800/50 bg-amber-900/10'
										: 'border border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800'}"
							onclick={() => toggleModule(module.id)}
						>
							<div
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded border
									{isSelected
										? 'border-emerald-500 bg-emerald-600'
										: isAutoRequired
											? 'border-amber-600 bg-amber-700'
											: 'border-zinc-600'}"
							>
								{#if isSelected || isAutoRequired}
									<svg class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-zinc-200">
										{module.display_name}
									</span>
									{#if module.has_quick_toggle}
										<span
											class="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-400"
										>
											QT
										</span>
									{/if}
									{#if isAutoRequired}
										<span
											class="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
										>
											auto-required
										</span>
									{/if}
								</div>
								{#if module.description}
									<p class="mt-0.5 text-xs text-zinc-500">
										{module.description.split('\n')[0]}
									</p>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								{#if module.param_count > 0}
									<span
										class="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400"
									>
										{module.param_count} param{module.param_count !== 1 ? 's' : ''}
									</span>
								{/if}
								<span
									class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase
										{module.module_type === 'fgs'
											? 'bg-cyan-900/50 text-cyan-400'
											: 'bg-yellow-900/50 text-yellow-400'}"
								>
									{module.module_type}
								</span>
							</div>
						</button>
					{/each}
				</div>

				<div class="mt-4 text-sm text-zinc-400">
					{selectedModuleIds.size} module{selectedModuleIds.size !== 1 ? 's' : ''} selected
				</div>
			{/if}

		{:else if step === 2}
			<!-- Step 3: Module Configuration -->
			<h2 class="mb-2 text-lg font-semibold text-zinc-100">Configure Modules</h2>
			<p class="mb-6 text-sm text-zinc-400">
				Set up per-module parameters, quick toggles, and weapon data.
			</p>

			{#if (hasWeapondata || needsWeapondata)}
				<div class="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
					<h3 class="mb-3 text-sm font-semibold text-zinc-200">Weapon Names</h3>
					<textarea
						bind:value={weaponNamesText}
						placeholder="M4A4, R8, AK-47, Desert Eagle, ..."
						rows="4"
						class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					></textarea>
					<p class="mt-1.5 text-xs text-zinc-500">
						Comma-separated weapon names ({weaponNames.length} weapon{weaponNames.length !== 1 ? 's' : ''}).
						Leave empty for default "Weapon 1, Weapon 2, ..." names.
					</p>
				</div>
			{/if}

			{#each selectedModules.filter(m => m.has_quick_toggle) as module}
				<div class="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
					<h3 class="mb-3 text-sm font-semibold text-zinc-200">
						{module.display_name} - Quick Toggle
					</h3>
					<div>
						<label
							for="qt-{module.id}"
							class="mb-1 block text-xs text-zinc-400"
						>
							Keyboard key (leave empty for none)
						</label>
						<KeySelect
							value={quickToggles[module.id] ?? ''}
							onchange={(val) => {
								quickToggles = { ...quickToggles, [module.id]: val };
							}}
							placeholder="Search keys..."
						/>
					</div>
				</div>
			{/each}

			{#if !hasWeapondata && !needsWeapondata && modulesWithParams.length === 0 && selectedModules.filter(m => m.has_quick_toggle).length === 0}
				<div class="py-8 text-center text-zinc-500">
					No configuration needed for the selected modules.
				</div>
			{/if}

		{:else if step === 3}
			<!-- Step 4: Review -->
			<h2 class="mb-6 text-lg font-semibold text-zinc-100">Review & Create</h2>

			{#if createError}
				<div class="mb-4 rounded border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
					{createError}
				</div>
			{/if}

			<div class="space-y-4">
				<div class="rounded border border-zinc-800 bg-zinc-800/50 p-4">
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Game Info
					</h3>
					<div class="grid grid-cols-2 gap-y-2 text-sm">
						<span class="text-zinc-400">Name</span>
						<span class="text-zinc-200">{gameName}</span>
						<span class="text-zinc-400">Type</span>
						<span class="uppercase text-zinc-200">{gameType}</span>
						<span class="text-zinc-400">Version</span>
						<span class="text-zinc-200">{version}</span>
						<span class="text-zinc-400">Profiles</span>
						<span class="text-zinc-200">{profiles === 0 ? 'None' : profiles}</span>
					</div>
				</div>

				<div class="rounded border border-zinc-800 bg-zinc-800/50 p-4">
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Modules ({selectedModuleIds.size})
					</h3>
					{#if selectedModules.length === 0}
						<p class="text-sm text-zinc-500">No modules selected</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each selectedModules as module}
								<span
									class="rounded bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300"
								>
									{module.display_name}
								</span>
							{/each}
						</div>
					{/if}
				</div>

				{#if (hasWeapondata || needsWeapondata) && weaponNames.length > 0}
					<div class="rounded border border-zinc-800 bg-zinc-800/50 p-4">
						<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
							Weapons ({weaponNames.length})
						</h3>
						<div class="flex flex-wrap gap-1.5">
							{#each weaponNames.slice(0, 20) as name}
								<span
									class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300"
								>
									{name}
								</span>
							{/each}
							{#if weaponNames.length > 20}
								<span class="text-xs text-zinc-500">
									+{weaponNames.length - 20} more
								</span>
							{/if}
						</div>
					</div>
				{/if}

				{#if Object.keys(quickToggles).filter(k => quickToggles[k]).length > 0}
					<div class="rounded border border-zinc-800 bg-zinc-800/50 p-4">
						<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
							Quick Toggles
						</h3>
						<div class="space-y-1">
							{#each Object.entries(quickToggles).filter(([, v]) => v) as [moduleId, key]}
								{@const module = availableModules.find((m) => m.id === moduleId)}
								<div class="flex items-center justify-between text-sm">
									<span class="text-zinc-400">{module?.display_name ?? moduleId}</span>
									<code class="rounded bg-zinc-700 px-2 py-0.5 text-xs text-amber-400">
										{key}
									</code>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="rounded border border-zinc-700 bg-zinc-800 p-3 text-xs text-zinc-500">
					Output: {settings.workspaces.length > 0 ? settings.workspaces[0] : 'Games'}/{gameName}/config.toml
				</div>
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="mt-6 flex items-center justify-between">
		<div>
			{#if step > 0}
				<button
					onclick={prevStep}
					class="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
				>
					Back
				</button>
			{/if}
		</div>
		<div>
			{#if step < steps.length - 1}
				<button
					onclick={nextStep}
					disabled={step === 0 && !step1Valid}
					class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Continue
				</button>
			{:else}
				<button
					onclick={handleCreate}
					disabled={creating || !step1Valid}
					class="rounded-md bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if creating}
						Creating...
					{:else}
						Create Game
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>
