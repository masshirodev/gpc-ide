<script lang="ts">
	import Timeline from './Timeline.svelte';
	import StepEditor from './StepEditor.svelte';
	import ExportPanel from './ExportPanel.svelte';
	import { createEmptyStep, createEmptyCombo } from './types';
	import type { ComboStep, ComboProject, Combo } from './types';
	import { parseComboAuto } from './import';
	import { addToast } from '$lib/stores/toast.svelte';
	import { writeFile, readFile } from '$lib/tauri/commands';
	import ToolHeader from '$lib/components/layout/ToolHeader.svelte';
	import * as m from '$lib/paraglide/messages.js';

	// --- State ---
	let combos = $state<Combo[]>([createEmptyCombo()]);
	let activeComboId = $state<string>(combos[0].id);
	let activeStepId = $state<string | null>(combos[0].steps[0]?.id ?? null);
	let consoleType = $state<'ps5' | 'xb1' | 'swi' | 'wii'>('ps5');
	let showExport = $state(false);
	let showImport = $state(false);
	let importText = $state('');
	let editingComboId = $state<string | null>(null);
	let editComboInput = $state('');

	// Undo per combo
	let historyMap = $state<Record<string, ComboStep[][]>>({});
	let redoMap = $state<Record<string, ComboStep[][]>>({});

	let activeCombo = $derived(combos.find((c) => c.id === activeComboId) ?? combos[0]);
	let steps = $derived(activeCombo?.steps ?? []);
	let activeStep = $derived(steps.find((s) => s.id === activeStepId) ?? null);

	let project = $derived<ComboProject>({
		version: 1,
		name: activeCombo?.name ?? 'My Combo',
		consoleType,
		steps: activeCombo?.steps ?? [],
		combos
	});

	function cloneSteps(arr: ComboStep[]) {
		return arr.map((s) => ({ ...s, buttons: [...s.buttons], sticks: [...s.sticks] }));
	}

	function pushHistory() {
		const id = activeComboId;
		const stack = historyMap[id] ?? [];
		historyMap = { ...historyMap, [id]: [...stack.slice(-50), cloneSteps(steps)] };
		redoMap = { ...redoMap, [id]: [] };
	}

	function undo() {
		const id = activeComboId;
		const stack = historyMap[id] ?? [];
		if (stack.length === 0) return;
		const rStack = redoMap[id] ?? [];
		redoMap = { ...redoMap, [id]: [...rStack, cloneSteps(steps)] };
		const prev = stack[stack.length - 1];
		historyMap = { ...historyMap, [id]: stack.slice(0, -1) };
		updateComboSteps(prev);
		if (activeStepId && !prev.find((s) => s.id === activeStepId)) {
			activeStepId = prev[0]?.id ?? null;
		}
	}

	function redo() {
		const id = activeComboId;
		const rStack = redoMap[id] ?? [];
		if (rStack.length === 0) return;
		const stack = historyMap[id] ?? [];
		historyMap = { ...historyMap, [id]: [...stack, cloneSteps(steps)] };
		const next = rStack[rStack.length - 1];
		redoMap = { ...redoMap, [id]: rStack.slice(0, -1) };
		updateComboSteps(next);
		if (activeStepId && !next.find((s) => s.id === activeStepId)) {
			activeStepId = next[0]?.id ?? null;
		}
	}

	function updateComboSteps(newSteps: ComboStep[]) {
		combos = combos.map((c) => (c.id === activeComboId ? { ...c, steps: newSteps } : c));
	}

	function handleStepsChange(newSteps: ComboStep[]) {
		pushHistory();
		updateComboSteps(newSteps);
	}

	function handleStepEdit(updatedStep: ComboStep) {
		pushHistory();
		updateComboSteps(steps.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
	}

	function deleteActiveStep() {
		if (!activeStepId || steps.length <= 1) return;
		pushHistory();
		const idx = steps.findIndex((s) => s.id === activeStepId);
		const newSteps = steps.filter((s) => s.id !== activeStepId);
		updateComboSteps(newSteps);
		activeStepId = newSteps[Math.min(idx, newSteps.length - 1)].id;
	}

	// --- Combo management ---
	function addCombo() {
		const combo = createEmptyCombo(`${m.combo_combo_name()} ${combos.length + 1}`);
		combos = [...combos, combo];
		activeComboId = combo.id;
		activeStepId = combo.steps[0]?.id ?? null;
	}

	function deleteCombo(id: string) {
		if (combos.length <= 1) return;
		const idx = combos.findIndex((c) => c.id === id);
		combos = combos.filter((c) => c.id !== id);
		if (activeComboId === id) {
			const next = combos[Math.min(idx, combos.length - 1)];
			activeComboId = next.id;
			activeStepId = next.steps[0]?.id ?? null;
		}
	}

	function renameCombo(id: string, name: string) {
		if (!name.trim()) return;
		combos = combos.map((c) => (c.id === id ? { ...c, name: name.trim() } : c));
		editingComboId = null;
	}

	function switchCombo(id: string) {
		activeComboId = id;
		const combo = combos.find((c) => c.id === id);
		activeStepId = combo?.steps[0]?.id ?? null;
	}

	function handleImport() {
		if (!importText.trim()) return;
		const parsed = parseComboAuto(importText);
		if (parsed.length === 0) {
			addToast('Could not parse any combos from the input', 'error');
			return;
		}
		combos = [...combos, ...parsed];
		activeComboId = parsed[0].id;
		activeStepId = parsed[0].steps[0]?.id ?? null;
		showImport = false;
		importText = '';
		addToast(`Imported ${parsed.length} combo(s)`, 'success', 2000);
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

			consoleType = loaded.consoleType;
			// Support both old single-combo and new multi-combo format
			if (loaded.combos && loaded.combos.length > 0) {
				combos = loaded.combos;
			} else {
				combos = [{ id: crypto.randomUUID(), name: loaded.name, steps: loaded.steps }];
			}
			activeComboId = combos[0].id;
			activeStepId = combos[0].steps[0]?.id ?? null;
			historyMap = {};
			redoMap = {};
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
	<ToolHeader title="Combo Maker" subtitle="Design button combos with visual step editing">
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
				{m.common_open()}
			</button>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={handleSave}
			>
				{m.common_save()}
			</button>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={() => { showImport = true; importText = ''; }}
			>
				{m.combo_import()}
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
	</ToolHeader>

	<!-- Combo tabs -->
	<div class="flex items-center gap-0.5 border-b border-zinc-800 px-3">
		{#each combos as combo (combo.id)}
			<div class="group flex items-center">
				{#if editingComboId === combo.id}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						class="rounded border border-emerald-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 focus:outline-none"
						bind:value={editComboInput}
						autofocus
						onkeydown={(e) => { if (e.key === 'Enter') renameCombo(combo.id, editComboInput); if (e.key === 'Escape') editingComboId = null; }}
						onblur={() => renameCombo(combo.id, editComboInput)}
					/>
				{:else}
					<button
						class="rounded-t px-3 py-1.5 text-xs transition-colors {combo.id === activeComboId
							? 'border-b-2 border-emerald-500 text-zinc-100'
							: 'text-zinc-500 hover:text-zinc-300'}"
						onclick={() => switchCombo(combo.id)}
						ondblclick={() => { editingComboId = combo.id; editComboInput = combo.name; }}
					>
						{combo.name}
					</button>
				{/if}
				{#if combos.length > 1}
					<button
						class="ml-0.5 hidden rounded p-0.5 text-zinc-600 hover:text-red-400 group-hover:block"
						title={m.combo_delete_combo()}
						onclick={() => deleteCombo(combo.id)}
					>
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				{/if}
			</div>
		{/each}
		<button
			class="ml-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-800 hover:text-emerald-400"
			title={m.combo_add_combo()}
			onclick={addCombo}
		>
			+
		</button>
	</div>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Timeline (left) -->
		<div class="scrollbar-none w-72 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
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
			<div class="scrollbar-none w-80 shrink-0 overflow-y-auto border-l border-zinc-800 p-3">
				<ExportPanel {project} />
			</div>
		{/if}
	</div>
</div>

<!-- Import modal -->
{#if showImport}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onkeydown={(e) => { if (e.key === 'Escape') showImport = false; }}
		onclick={(e) => { if (e.target === e.currentTarget) showImport = false; }}
	>
		<div class="flex w-[32rem] flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
			<h3 class="text-sm font-medium text-zinc-200">{m.combo_import_title()}</h3>
			<p class="text-xs text-zinc-500">{m.combo_import_paste()}</p>
			<textarea
				class="h-48 w-full resize-none rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
				bind:value={importText}
				placeholder={'combo MyCombo {\n    set_val(PS5_CROSS, 100);\n    wait(50);\n}'}
			></textarea>
			<div class="flex justify-end gap-2">
				<button
					class="rounded px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					onclick={() => (showImport = false)}
				>
					{m.common_cancel()}
				</button>
				<button
					class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					disabled={!importText.trim()}
					onclick={handleImport}
				>
					{m.combo_import()}
				</button>
			</div>
		</div>
	</div>
{/if}
