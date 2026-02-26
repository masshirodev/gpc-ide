<script lang="ts">
	import type { FlowGraph } from '$lib/types/flow';
	import { FlowEmulator, DEFAULT_KEY_MAP } from '$lib/flow/emulator';
	import { onMount } from 'svelte';

	interface Props {
		graph: FlowGraph;
		open: boolean;
		onclose: () => void;
	}

	let { graph, open, onclose }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let emulator: FlowEmulator | null = $state(null);
	let running = $state(true);
	let frameId = 0;
	let lastFrameTime = 0;

	// Reactive state for display
	let currentNodeLabel = $state('');
	let statePath = $state<string[]>([]);
	let inputLog = $state<string[]>([]);
	let variables = $state<[string, number | string][]>([]);
	let frameCount = $state(0);

	const SCALE = 4;
	const WIDTH = 128;
	const HEIGHT = 64;

	$effect(() => {
		if (open && graph) {
			emulator = new FlowEmulator(graph);
			running = true;
			lastFrameTime = performance.now();
			startLoop();
		} else {
			running = false;
			if (frameId) cancelAnimationFrame(frameId);
			emulator = null;
		}
	});

	function startLoop() {
		function loop(now: number) {
			if (!running || !emulator) return;

			const delta = now - lastFrameTime;
			lastFrameTime = now;

			emulator.step(delta);
			renderFrame();
			syncDisplayState();

			frameId = requestAnimationFrame(loop);
		}
		frameId = requestAnimationFrame(loop);
	}

	function renderFrame() {
		if (!canvasEl || !emulator) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const pixels = emulator.render();

		// Clear to black
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE);

		// Draw pixels
		ctx.fillStyle = '#fff';
		for (let y = 0; y < HEIGHT; y++) {
			for (let x = 0; x < WIDTH; x++) {
				const byteIdx = y * 16 + Math.floor(x / 8);
				const bitIdx = 7 - (x % 8);
				if (byteIdx < pixels.length && (pixels[byteIdx] & (1 << bitIdx)) !== 0) {
					ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
				}
			}
		}
	}

	function syncDisplayState() {
		if (!emulator) return;
		const node = emulator.getCurrentNode();
		currentNodeLabel = node?.label || '(unknown)';
		statePath = emulator.state.statePath.map((id) => {
			const n = emulator!.graph.nodes.find((n) => n.id === id);
			return n?.label || '?';
		}).slice(-8);
		inputLog = [...emulator.state.inputLog].reverse().slice(0, 10);
		variables = Array.from(emulator.state.variables.entries());
		frameCount = emulator.state.frameCount;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open || !emulator) return;
		const button = DEFAULT_KEY_MAP[e.key];
		if (button) {
			e.preventDefault();
			e.stopPropagation();
			emulator.handleButtonPress(button);
		}
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (!open || !emulator) return;
		const button = DEFAULT_KEY_MAP[e.key];
		if (button) {
			e.preventDefault();
			emulator.handleButtonRelease(button);
		}
	}

	function handleReset() {
		if (emulator) {
			emulator.reset();
			renderFrame();
			syncDisplayState();
		}
	}

	function handleStep() {
		if (emulator) {
			running = false;
			if (frameId) cancelAnimationFrame(frameId);
			emulator.step(16);
			renderFrame();
			syncDisplayState();
		}
	}

	function handleToggleRun() {
		running = !running;
		if (running) {
			lastFrameTime = performance.now();
			startLoop();
		} else if (frameId) {
			cancelAnimationFrame(frameId);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
		onmousedown={(e) => { if (e.target === e.currentTarget) onclose(); }}
	>
		<div class="flex h-[90vh] w-[640px] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-zinc-200">OLED Emulator</h2>
				<button
					class="text-zinc-400 hover:text-zinc-200"
					onclick={onclose}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Display -->
			<div class="flex items-center justify-center bg-zinc-950 px-6 py-6">
				<div class="rounded-lg border-2 border-zinc-700 bg-black p-1">
					<canvas
						bind:this={canvasEl}
						width={WIDTH * SCALE}
						height={HEIGHT * SCALE}
						class="block"
						style="image-rendering: pixelated;"
					/>
				</div>
			</div>

			<!-- State info -->
			<div class="border-t border-zinc-800 px-4 py-2">
				<div class="flex items-center gap-3 text-xs">
					<span class="text-zinc-500">State:</span>
					<span class="font-medium text-zinc-200">{currentNodeLabel}</span>
					<span class="text-zinc-600">|</span>
					<span class="text-zinc-500">Frame:</span>
					<span class="text-zinc-400">{frameCount}</span>
				</div>
				{#if statePath.length > 1}
					<div class="mt-1 text-xs text-zinc-500">
						Path: {statePath.join(' -> ')}
					</div>
				{/if}
			</div>

			<!-- Variables + Input Log -->
			<div class="flex min-h-0 flex-1 gap-3 border-t border-zinc-800 px-4 py-3">
				<!-- Variables -->
				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-1 shrink-0 text-xs font-medium text-zinc-500">Variables</div>
					<div class="min-h-0 flex-1 overflow-y-auto rounded bg-zinc-800 px-2 py-1 text-xs">
						{#if variables.length === 0}
							<span class="text-zinc-600">No variables</span>
						{:else}
							{#each variables as [name, value]}
								<div class="flex justify-between py-0.5">
									<span class="text-zinc-400">{name}</span>
									<span class="font-mono text-zinc-200">{value}</span>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Input Log -->
				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-1 shrink-0 text-xs font-medium text-zinc-500">Input Log</div>
					<div class="min-h-0 flex-1 overflow-y-auto rounded bg-zinc-800 px-2 py-1 text-xs">
						{#if inputLog.length === 0}
							<span class="text-zinc-600">No inputs yet</span>
						{:else}
							{#each inputLog as btn, i}
								<div class="py-0.5 text-zinc-400">
									<span class="text-zinc-600">&gt;</span> {btn}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex items-center justify-center gap-3 border-t border-zinc-800 px-4 py-3">
				<button
					class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
					onclick={handleReset}
				>
					Reset
				</button>
				<button
					class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
					onclick={handleStep}
				>
					Step
				</button>
				<button
					class="rounded border border-zinc-700 px-3 py-1.5 text-xs {running ? 'bg-amber-800 text-amber-200 hover:bg-amber-700' : 'bg-emerald-800 text-emerald-200 hover:bg-emerald-700'}"
					onclick={handleToggleRun}
				>
					{running ? 'Pause' : 'Run'}
				</button>
			</div>

			<!-- Key map hint -->
			<div class="border-t border-zinc-800 px-4 py-2 text-center text-[10px] text-zinc-600">
				Arrows: D-pad | Enter: Confirm | Backspace: Cancel | Esc: Close
			</div>
		</div>
	</div>
{/if}
