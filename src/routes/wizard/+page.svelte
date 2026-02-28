<script lang="ts">
	import { goto } from '$app/navigation';
	import { createGame, saveFlowProject } from '$lib/tauri/commands';
	import type { CreateGameParams } from '$lib/tauri/commands';
	import { loadGames } from '$lib/stores/game.svelte';
	import { getSettings, getAllGameTypes } from '$lib/stores/settings.svelte';
	import { CONSOLE_TYPES, CONSOLE_LABELS, type ConsoleType } from '$lib/utils/console-buttons';
	import * as m from '$lib/paraglide/messages.js';

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);
	let gameTypeOptions = $derived(getAllGameTypes(settings));

	// Wizard state
	let step = $state(0);
	const stepKeys = ['wizard_step_game_info', 'wizard_step_review'] as const;
	const stepLabels: Record<string, () => string> = {
		wizard_step_game_info: () => m.wizard_step_game_info(),
		wizard_step_review: () => m.wizard_step_review()
	};

	// Step 1: Game Info
	let gameName = $state('');
	let displayName = $state('');
	let gameType = $state('fps');
	let consoleType = $state<ConsoleType>('ps5');
	let version = $state(1);

	// Create state
	let creating = $state(false);
	let createError = $state('');

	// Validation
	let step1Valid = $derived(gameName.trim().length > 0);

	function nextStep() {
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
				display_name: displayName.trim() || undefined,
				username: settings.username.trim() || undefined,
				game_type: gameType,
				console_type: consoleType,
				version,
				workspace_path: settings.workspaces.length > 0 ? settings.workspaces[0] : undefined
			};

			const result = await createGame(params);

			// Create empty flow project for the new game
			try {
				const { createEmptyFlowProject } = await import('$lib/types/flow');
				const flowProject = createEmptyFlowProject();
				await saveFlowProject(result.game_path, flowProject);
			} catch (flowError) {
				console.warn('Failed to create flow project:', flowError);
			}

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
			<a href="/" class="text-zinc-400 hover:text-zinc-200" title={m.wizard_back_to_dashboard()}>
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</a>
			<h1 class="text-2xl font-bold text-zinc-100">{m.wizard_title()}</h1>
		</div>
	</div>

	<!-- Step Indicator -->
	<div class="mb-8 flex items-center gap-2">
		{#each stepKeys as key, i}
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
					{stepLabels[key]?.() ?? key}
				</span>
			</div>
			{#if i < stepKeys.length - 1}
				<div class="h-px flex-1 {i < step ? 'bg-emerald-600' : 'bg-zinc-700'}"></div>
			{/if}
		{/each}
	</div>

	<!-- Step Content -->
	<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
		{#if step === 0}
			<!-- Step 1: Game Info -->
			<h2 class="mb-6 text-lg font-semibold text-zinc-100">{m.wizard_game_information()}</h2>

			<div class="space-y-5">
				<div>
					<label for="game-name" class="mb-1.5 block text-sm font-medium text-zinc-300">
						{m.wizard_game_name_label()}
					</label>
					<input
						id="game-name"
						type="text"
						bind:value={gameName}
						placeholder={m.wizard_game_name_placeholder()}
						class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					<p class="mt-1 text-xs text-zinc-500">
						{m.wizard_game_name_hint()}
					</p>
				</div>

				<div>
					<label for="display-name" class="mb-1.5 block text-sm font-medium text-zinc-300">
						{m.wizard_display_name_label()} <span class="text-zinc-500">{m.wizard_display_name_optional()}</span>
					</label>
					<input
						id="display-name"
						type="text"
						bind:value={displayName}
						placeholder={m.wizard_display_name_placeholder()}
						class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					<p class="mt-1 text-xs text-zinc-500">
						{m.wizard_display_name_hint()}
					</p>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="game-type" class="mb-1.5 block text-sm font-medium text-zinc-300">
							{m.wizard_game_type_label()}
						</label>
						<select
							id="game-type"
							bind:value={gameType}
							class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							{#each gameTypeOptions as type}
								<option value={type}>{type.toUpperCase()}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="console-type" class="mb-1.5 block text-sm font-medium text-zinc-300">
							{m.wizard_console_type_label()}
						</label>
						<select
							id="console-type"
							bind:value={consoleType}
							class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							{#each CONSOLE_TYPES as ct}
								<option value={ct}>{CONSOLE_LABELS[ct]}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="w-1/2">
					<label for="version" class="mb-1.5 block text-sm font-medium text-zinc-300">
						{m.wizard_version_label()}
					</label>
					<input
						id="version"
						type="number"
						bind:value={version}
						min="1"
						class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>
			</div>

		{:else if step === 1}
			<!-- Step 2: Review -->
			<h2 class="mb-6 text-lg font-semibold text-zinc-100">{m.wizard_review_title()}</h2>

			{#if createError}
				<div class="mb-4 rounded border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
					{createError}
				</div>
			{/if}

			<div class="space-y-4">
				<div class="rounded border border-zinc-800 bg-zinc-800/50 p-4">
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
						{m.wizard_review_game_info()}
					</h3>
					<div class="grid grid-cols-2 gap-y-2 text-sm">
						<span class="text-zinc-400">{m.wizard_review_name()}</span>
						<span class="text-zinc-200">{gameName}</span>
						{#if displayName.trim()}
							<span class="text-zinc-400">{m.wizard_review_display_name()}</span>
							<span class="text-zinc-200">{displayName}</span>
						{/if}
						<span class="text-zinc-400">{m.wizard_review_type()}</span>
						<span class="uppercase text-zinc-200">{gameType}</span>
						<span class="text-zinc-400">{m.wizard_review_console()}</span>
						<span class="text-zinc-200">{CONSOLE_LABELS[consoleType]}</span>
						<span class="text-zinc-400">{m.wizard_review_version()}</span>
						<span class="text-zinc-200">{version}</span>
					</div>
				</div>

				<div class="rounded border border-zinc-800 bg-zinc-800/50 p-4">
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
						{m.wizard_review_generation()}
					</h3>
					<div class="flex items-center gap-2">
						<span class="rounded bg-blue-900/50 px-1.5 py-0.5 text-xs font-medium text-blue-400">{m.editor_overview_flow_editor()}</span>
						<span class="text-sm text-zinc-500">{m.wizard_review_flow_hint()}</span>
					</div>
				</div>

				<div class="rounded border border-zinc-700 bg-zinc-800 p-3 text-xs text-zinc-500">
					{m.wizard_output({ path: `${settings.workspaces.length > 0 ? settings.workspaces[0] : 'Games'}/${gameName}/game.json` })}
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
					{m.common_back()}
				</button>
			{/if}
		</div>
		<div>
			{#if step < stepKeys.length - 1}
				<button
					onclick={nextStep}
					disabled={step === 0 && !step1Valid}
					class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{m.wizard_continue()}
				</button>
			{:else}
				<button
					onclick={handleCreate}
					disabled={creating || !step1Valid}
					class="rounded-md bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if creating}
						{m.common_creating()}
					{:else}
						{m.wizard_create_game()}
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>
