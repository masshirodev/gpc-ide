<script lang="ts">
	import type { ComboStep } from './types';
	import { createEmptyStep, cloneStep } from './types';

	interface Props {
		steps: ComboStep[];
		activeStepId: string | null;
		onselect: (id: string) => void;
		onchange: (steps: ComboStep[]) => void;
	}

	let { steps, activeStepId, onselect, onchange }: Props = $props();

	let dragIndex: number | null = $state(null);
	let dropIndex: number | null = $state(null);

	let totalDuration = $derived(steps.reduce((sum, s) => sum + s.waitMs, 0));

	function addStep() {
		const step = createEmptyStep();
		onchange([...steps, step]);
		onselect(step.id);
	}

	function duplicateStep(id: string) {
		const idx = steps.findIndex((s) => s.id === id);
		if (idx < 0) return;
		const dup = cloneStep(steps[idx]);
		const updated = [...steps];
		updated.splice(idx + 1, 0, dup);
		onchange(updated);
		onselect(dup.id);
	}

	function deleteStep(id: string) {
		if (steps.length <= 1) return;
		const idx = steps.findIndex((s) => s.id === id);
		const updated = steps.filter((s) => s.id !== id);
		onchange(updated);
		if (activeStepId === id) {
			onselect(updated[Math.min(idx, updated.length - 1)].id);
		}
	}

	function moveStep(fromIdx: number, toIdx: number) {
		if (fromIdx === toIdx) return;
		const updated = [...steps];
		const [moved] = updated.splice(fromIdx, 1);
		updated.splice(toIdx, 0, moved);
		onchange(updated);
	}

	function handleDragStart(e: DragEvent, idx: number) {
		dragIndex = idx;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(e: DragEvent, idx: number) {
		e.preventDefault();
		dropIndex = idx;
	}

	function handleDragEnd() {
		if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
			moveStep(dragIndex, dropIndex);
		}
		dragIndex = null;
		dropIndex = null;
	}

	function stepSummary(step: ComboStep): string {
		const parts: string[] = [];
		for (const b of step.buttons) {
			const short = b.button.includes('_') ? b.button.split('_').slice(1).join('_') : b.button;
			parts.push(b.value !== 100 ? `${short}(${b.value})` : short);
		}
		for (const s of step.sticks) {
			parts.push(`${s.axis === 'left' ? 'L' : 'R'}(${s.x},${s.y})`);
		}
		return parts.length ? parts.join(', ') : 'empty';
	}
</script>

<div class="flex h-full flex-col">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-sm font-medium text-zinc-300">Timeline</h3>
		<button
			class="rounded bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-600/30"
			onclick={addStep}
		>
			+ Step
		</button>
	</div>

	<!-- Step list -->
	<div class="flex-1 space-y-1 overflow-y-auto">
		{#each steps as step, idx (step.id)}
			<div
				class="group flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 transition-colors {step.id === activeStepId
					? 'bg-emerald-900/30 border border-emerald-700/40'
					: 'border border-transparent hover:bg-zinc-800/60'} {dropIndex === idx && dragIndex !== idx
					? 'border-t-2 !border-t-emerald-500'
					: ''}"
				draggable="true"
				role="button"
				tabindex="0"
				ondragstart={(e) => handleDragStart(e, idx)}
				ondragover={(e) => handleDragOver(e, idx)}
				ondragend={handleDragEnd}
				onclick={() => onselect(step.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onselect(step.id);
					}
				}}
			>
				<!-- Step number -->
				<span class="mt-0.5 w-5 shrink-0 text-right text-xs font-mono text-zinc-600">
					{idx + 1}
				</span>

				<!-- Step content -->
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs font-mono {step.id === activeStepId ? 'text-zinc-200' : 'text-zinc-400'}">
						{stepSummary(step)}
					</div>
					{#if step.label}
						<div class="truncate text-xs text-zinc-600 italic">{step.label}</div>
					{/if}
				</div>

				<!-- Wait badge -->
				<span class="mt-0.5 shrink-0 text-xs text-zinc-600">
					{step.waitMs}ms
				</span>

				<!-- Actions -->
				<div class="mt-0.5 flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
					<button
						class="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
						title="Duplicate"
						onclick={(e) => { e.stopPropagation(); duplicateStep(step.id); }}
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
							<path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
							<path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
						</svg>
					</button>
					{#if steps.length > 1}
						<button
							class="rounded p-0.5 text-zinc-600 hover:text-red-400"
							title="Delete"
							onclick={(e) => { e.stopPropagation(); deleteStep(step.id); }}
						>
							<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
							</svg>
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Footer -->
	<div class="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs text-zinc-600">
		<span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
		<span>{totalDuration}ms total</span>
	</div>
</div>
