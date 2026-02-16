<script lang="ts">
	import Timeline from './Timeline.svelte';
	import StepEditor from './StepEditor.svelte';
	import ExportPanel from './ExportPanel.svelte';
	import { createEmptyStep } from './types';
	import type { ComboStep, ComboProject } from './types';
	import { addToast } from '$lib/stores/toast.svelte';
	import { writeFile, readFile } from '$lib/tauri/commands';

	// --- State ---
	const initialStep = createEmptyStep();
	let steps = $state<ComboStep[]>([initialStep]);
	let activeStepId = $state<string | null>(initialStep.id);
	let comboName = $state('My Combo');
	let consoleType = $state<'ps5' | 'xb1' | 'swi' | 'wii'>('ps5');
	let showExport = $state(false);

	// Undo
	let history = $state<ComboStep[][]>([]);
	let redoStack = $state<ComboStep[][]>([]);

	let activeStep = $derived(steps.find((s) => s.id === activeStepId) ?? null);

	let project = $derived<ComboProject>({
		version: 1,
		name: comboName,
		consoleType,
		steps
	});

	function pushHistory() {
		history = [...history.slice(-50), steps.map((s) => ({ ...s, buttons: [...s.buttons], sticks: [...s.sticks] }))];
		redoStack = [];
	}

	function undo() {
		if (history.length === 0) return;
		redoStack = [...redoStack, steps.map((s) => ({ ...s, buttons: [...s.buttons], sticks: [...s.sticks] }))];
		const prev = history[history.length - 1];
		history = history.slice(0, -1);
		steps = prev;
		if (activeStepId && !prev.find((s) => s.id === activeStepId)) {
			activeStepId = prev[0]?.id ?? null;
		}
	}

	function redo() {
		if (redoStack.length === 0) return;
		history = [...history, steps.map((s) => ({ ...s, buttons: [...s.buttons], sticks: [...s.sticks] }))];
		const next = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);
		steps = next;
		if (activeStepId && !next.find((s) => s.id === activeStepId)) {
			activeStepId = next[0]?.id ?? null;
		}
	}

	function handleStepsChange(newSteps: ComboStep[]) {
		pushHistory();
		steps = newSteps;
	}

	function handleStepEdit(updatedStep: ComboStep) {
		pushHistory();
		steps = steps.map((s) => (s.id === updatedStep.id ? updatedStep : s));
	}

	function deleteActiveStep() {
		if (!activeStepId || steps.length <= 1) return;
		pushHistory();
		const idx = steps.findIndex((s) => s.id === activeStepId);
		steps = steps.filter((s) => s.id !== activeStepId);
		activeStepId = steps[Math.min(idx, steps.length - 1)].id;
	}

	// --- Save / Load ---
	async function handleSave() {
		try {
			const { save } = await import('@tauri-apps/plugin-dialog');
			let path = await save({
				filters: [{ name: 'Combo Project', extensions: ['combo.json'] }]
			});
			if (!path) return;
			if (!path.endsWith('.combo.json')) path += '.combo.json';

			await writeFile(path, JSON.stringify(project, null, 2));
			addToast('Project saved', 'success', 2000);
		} catch (e) {
			addToast(`Save failed: ${e}`, 'error');
		}
	}

	async function handleLoad() {
		try {
			const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
			const path = await openDialog({
				filters: [{ name: 'Combo Project', extensions: ['combo.json'] }]
			});
			if (!path) return;

			const content = await readFile(path as string);
			const loaded: ComboProject = JSON.parse(content);

			comboName = loaded.name;
			consoleType = loaded.consoleType;
			steps = loaded.steps;
			activeStepId = steps[0]?.id ?? null;
			history = [];
			redoStack = [];
			addToast('Project loaded', 'success', 2000);
		} catch (e) {
			addToast(`Load failed: ${e}`, 'error');
		}
	}

	// --- Keyboard shortcuts ---
	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		} else if (e.ctrlKey && (e.key === 'Z' || e.key === 'y')) {
			e.preventDefault();
			redo();
		} else if (e.ctrlKey && e.key === 's') {
			e.preventDefault();
			handleSave();
		} else if (e.key === 'Delete') {
			deleteActiveStep();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col bg-zinc-950">
	<!-- Header -->
	<div class="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
		<a
			href="/"
			class="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
					clip-rule="evenodd"
				/>
			</svg>
			Back
		</a>

		<h1 class="text-lg font-semibold text-zinc-100">Combo Maker</h1>

		<!-- Combo name -->
		<input
			type="text"
			bind:value={comboName}
			class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
			placeholder="Combo name"
		/>

		<!-- Console -->
		<select
			bind:value={consoleType}
			class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
		>
			<option value="ps5">PS5</option>
			<option value="xb1">Xbox</option>
			<option value="swi">Switch</option>
			<option value="wii">Wii</option>
		</select>

		<div class="ml-auto flex items-center gap-2">
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={handleLoad}
			>
				Open
			</button>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={handleSave}
			>
				Save
			</button>
			<button
				class="rounded px-3 py-1 text-xs {showExport
					? 'bg-emerald-600/20 text-emerald-400'
					: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
				onclick={() => (showExport = !showExport)}
			>
				Export
			</button>
		</div>

		<div class="flex items-center gap-2 text-xs text-zinc-600">
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Ctrl+Z</kbd> undo
			</span>
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Del</kbd> remove step
			</span>
		</div>
	</div>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Timeline (left) -->
		<div class="w-72 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
			<Timeline
				{steps}
				{activeStepId}
				onselect={(id) => (activeStepId = id)}
				onchange={handleStepsChange}
			/>
		</div>

		<!-- Step editor (center) -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if activeStep}
				<StepEditor
					step={activeStep}
					{consoleType}
					onchange={handleStepEdit}
				/>
			{:else}
				<div class="flex h-full items-center justify-center text-sm text-zinc-600">
					Select a step to edit
				</div>
			{/if}
		</div>

		<!-- Export panel (right) -->
		{#if showExport}
			<div class="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 p-3">
				<ExportPanel {project} />
			</div>
		{/if}
	</div>
</div>
