<script lang="ts">
	import StickInput from './StickInput.svelte';
	import type { ComboStep, ButtonAction, StickAction } from './types';
	import {
		CONSOLE_BUTTONS,
		CONSOLE_AXES,
		type ConsoleType
	} from '$lib/utils/console-buttons';

	interface Props {
		step: ComboStep;
		consoleType: ConsoleType;
		onchange: (step: ComboStep) => void;
	}

	let { step, consoleType, onchange }: Props = $props();

	let axes = $derived(CONSOLE_AXES[consoleType]);
	let axisNames = $derived(new Set([axes.rx, axes.ry, axes.lx, axes.ly]));

	let digitalButtons = $derived(
		CONSOLE_BUTTONS[consoleType].filter((b) => !axisNames.has(b.name))
	);

	function isButtonActive(name: string): ButtonAction | undefined {
		return step.buttons.find((b) => b.button === name);
	}

	function toggleButton(name: string) {
		const existing = isButtonActive(name);
		const newButtons = existing
			? step.buttons.filter((b) => b.button !== name)
			: [...step.buttons, { button: name, value: 100 }];
		onchange({ ...step, buttons: newButtons });
	}

	function setButtonValue(name: string, value: number) {
		const newButtons = step.buttons.map((b) =>
			b.button === name ? { ...b, value } : b
		);
		onchange({ ...step, buttons: newButtons });
	}

	function getStick(axis: 'left' | 'right'): StickAction {
		return step.sticks.find((s) => s.axis === axis) ?? { axis, x: 0, y: 0 };
	}

	function setStick(axis: 'left' | 'right', x: number, y: number) {
		const other = step.sticks.filter((s) => s.axis !== axis);
		if (x === 0 && y === 0) {
			onchange({ ...step, sticks: other });
		} else {
			onchange({ ...step, sticks: [...other, { axis, x, y }] });
		}
	}

	function setWait(ms: number) {
		onchange({ ...step, waitMs: Math.max(0, ms) });
	}

	function setLabel(label: string) {
		onchange({ ...step, label: label || undefined });
	}

	function clearStep() {
		onchange({ ...step, buttons: [], sticks: [], label: undefined });
	}

	// Pretty button name (strip console prefix)
	function shortName(name: string): string {
		const idx = name.indexOf('_');
		return idx >= 0 ? name.slice(idx + 1) : name;
	}

	let editingValue: string | null = $state(null);
</script>

<div class="flex flex-col gap-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-zinc-300">Step Editor</h3>
		<button
			class="text-xs text-zinc-500 hover:text-zinc-300"
			onclick={clearStep}
		>
			Clear
		</button>
	</div>

	<!-- Buttons -->
	<div>
		<div class="mb-2 text-xs font-medium text-zinc-500">Buttons</div>
		<div class="flex flex-wrap gap-1">
			{#each digitalButtons as btn}
				{@const active = isButtonActive(btn.name)}
				<button
					class="rounded px-2 py-1 text-xs font-mono transition-colors {active
						? 'bg-emerald-600/30 text-emerald-300 border border-emerald-600/50'
						: 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'}"
					onclick={() => toggleButton(btn.name)}
					oncontextmenu={(e) => {
						e.preventDefault();
						if (active) {
							editingValue = editingValue === btn.name ? null : btn.name;
						} else {
							toggleButton(btn.name);
							editingValue = btn.name;
						}
					}}
					title="{btn.name} (right-click for custom value)"
				>
					{shortName(btn.name)}
					{#if active && active.value !== 100}
						<span class="ml-0.5 text-emerald-400/60">{active.value}</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Value editor for selected button -->
		{#if editingValue && isButtonActive(editingValue)}
			<div class="mt-2 flex items-center gap-2 rounded bg-zinc-800/50 px-3 py-2">
				<span class="text-xs font-mono text-zinc-400">{editingValue}</span>
				<input
					type="range"
					min="0"
					max="100"
					value={isButtonActive(editingValue)?.value ?? 100}
					oninput={(e) => setButtonValue(editingValue!, parseInt(e.currentTarget.value))}
					class="flex-1 accent-emerald-500"
				/>
				<span class="w-8 text-right text-xs text-zinc-400">
					{isButtonActive(editingValue)?.value ?? 100}
				</span>
			</div>
		{/if}
	</div>

	<!-- Sticks -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs font-medium text-zinc-500">Sticks</span>
			{#if step.sticks.length > 0}
				<button
					class="text-xs text-zinc-500 hover:text-zinc-300"
					onclick={() => onchange({ ...step, sticks: [] })}
				>
					Reset sticks
				</button>
			{/if}
		</div>
		<div class="flex gap-6">
			<StickInput
				label="Left Stick"
				x={getStick('left').x}
				y={getStick('left').y}
				onchange={(x, y) => setStick('left', x, y)}
			/>
			<StickInput
				label="Right Stick"
				x={getStick('right').x}
				y={getStick('right').y}
				onchange={(x, y) => setStick('right', x, y)}
			/>
		</div>
	</div>

	<!-- Wait time -->
	<div>
		<div class="mb-1 text-xs font-medium text-zinc-500">Wait (ms)</div>
		<div class="flex items-center gap-2">
			<input
				type="number"
				min="0"
				max="10000"
				step="10"
				value={step.waitMs}
				oninput={(e) => setWait(parseInt(e.currentTarget.value) || 0)}
				class="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
			/>
			<div class="flex gap-1">
				{#each [10, 20, 30, 50, 100] as preset}
					<button
						class="rounded px-1.5 py-0.5 text-xs {step.waitMs === preset
							? 'bg-emerald-600/30 text-emerald-300'
							: 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}"
						onclick={() => setWait(preset)}
					>
						{preset}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Label -->
	<div>
		<div class="mb-1 text-xs font-medium text-zinc-500">Label (optional)</div>
		<input
			type="text"
			value={step.label ?? ''}
			oninput={(e) => setLabel(e.currentTarget.value)}
			placeholder="e.g. Forward input"
			class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
		/>
	</div>
</div>
