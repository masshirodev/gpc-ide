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
	let showController = $state(false);
	let heldControllerButtons = $state<Set<string>>(new Set());

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

	function controllerPress(button: string) {
		if (!emulator) return;
		emulator.handleButtonPress(button);
		heldControllerButtons = new Set([...heldControllerButtons, button]);
	}

	function controllerRelease(button: string) {
		if (!emulator) return;
		emulator.handleButtonRelease(button);
		const next = new Set(heldControllerButtons);
		next.delete(button);
		heldControllerButtons = next;
	}

	function controllerTap(button: string) {
		if (!emulator) return;
		emulator.handleButtonPress(button);
		heldControllerButtons = new Set([...heldControllerButtons, button]);
		setTimeout(() => {
			if (emulator) emulator.handleButtonRelease(button);
			const next = new Set(heldControllerButtons);
			next.delete(button);
			heldControllerButtons = next;
		}, 80);
	}

	function comboPress(buttons: string[]) {
		if (!emulator) return;
		for (const btn of buttons) {
			emulator.handleButtonPress(btn);
		}
		heldControllerButtons = new Set([...heldControllerButtons, ...buttons]);
		setTimeout(() => {
			for (const btn of buttons) {
				if (emulator) emulator.handleButtonRelease(btn);
			}
			const next = new Set(heldControllerButtons);
			for (const btn of buttons) next.delete(btn);
			heldControllerButtons = next;
		}, 80);
	}

	// Controller button layout
	const CONTROLLER_BUTTONS = {
		dpad: [
			{ name: 'PS5_UP', label: '\u25B2', short: 'Up' },
			{ name: 'PS5_DOWN', label: '\u25BC', short: 'Down' },
			{ name: 'PS5_LEFT', label: '\u25C0', short: 'Left' },
			{ name: 'PS5_RIGHT', label: '\u25B6', short: 'Right' }
		],
		face: [
			{ name: 'PS5_TRIANGLE', label: '\u25B3', short: 'Tri' },
			{ name: 'PS5_CROSS', label: '\u2715', short: 'Cross' },
			{ name: 'PS5_CIRCLE', label: '\u25CB', short: 'Circle' },
			{ name: 'PS5_SQUARE', label: '\u25A1', short: 'Square' }
		],
		shoulder: [
			{ name: 'PS5_L1', label: 'L1' },
			{ name: 'PS5_R1', label: 'R1' },
			{ name: 'PS5_L2', label: 'L2' },
			{ name: 'PS5_R2', label: 'R2' }
		],
		center: [
			{ name: 'PS5_SHARE', label: 'Share' },
			{ name: 'PS5_OPTIONS', label: 'Options' },
			{ name: 'PS5_PS', label: 'PS' },
			{ name: 'PS5_TOUCH', label: 'Touch' }
		],
		sticks: [
			{ name: 'PS5_L3', label: 'L3' },
			{ name: 'PS5_R3', label: 'R3' }
		]
	};

	const COMBO_PRESETS = [
		{ label: 'L2 + Options', buttons: ['PS5_L2', 'PS5_OPTIONS'] },
		{ label: 'L2 + Share', buttons: ['PS5_L2', 'PS5_SHARE'] },
		{ label: 'L2 + R2', buttons: ['PS5_L2', 'PS5_R2'] },
		{ label: 'L1 + R1', buttons: ['PS5_L1', 'PS5_R1'] }
	];
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
		onmousedown={(e) => { if (e.target === e.currentTarget) onclose(); }}
	>
		<div class="flex h-[90vh] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl" style="width: {showController ? '960px' : '640px'}; transition: width 0.2s ease;">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-zinc-200">OLED Emulator</h2>
				<div class="flex items-center gap-2">
					<button
						class="rounded border px-2.5 py-1 text-xs transition-colors {showController ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
						onclick={() => (showController = !showController)}
					>
						Controller
					</button>
					<button
						class="text-zinc-400 hover:text-zinc-200"
						onclick={onclose}
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
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

			<!-- Controller Panel -->
			{#if showController}
				<div class="border-t border-zinc-800 px-4 py-3">
					<div class="flex items-start gap-6">
						<!-- D-Pad -->
						<div class="flex flex-col items-center gap-0.5">
							<span class="mb-1 text-[10px] text-zinc-600">D-Pad</span>
							<div class="grid grid-cols-3 grid-rows-3 gap-0.5" style="width: 78px; height: 78px;">
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_UP') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerPress('PS5_UP')}
									onmouseup={() => controllerRelease('PS5_UP')}
									onmouseleave={() => { if (heldControllerButtons.has('PS5_UP')) controllerRelease('PS5_UP'); }}
								>{'\u25B2'}</button>
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_LEFT') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerPress('PS5_LEFT')}
									onmouseup={() => controllerRelease('PS5_LEFT')}
									onmouseleave={() => { if (heldControllerButtons.has('PS5_LEFT')) controllerRelease('PS5_LEFT'); }}
								>{'\u25C0'}</button>
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_RIGHT') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerPress('PS5_RIGHT')}
									onmouseup={() => controllerRelease('PS5_RIGHT')}
									onmouseleave={() => { if (heldControllerButtons.has('PS5_RIGHT')) controllerRelease('PS5_RIGHT'); }}
								>{'\u25B6'}</button>
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_DOWN') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerPress('PS5_DOWN')}
									onmouseup={() => controllerRelease('PS5_DOWN')}
									onmouseleave={() => { if (heldControllerButtons.has('PS5_DOWN')) controllerRelease('PS5_DOWN'); }}
								>{'\u25BC'}</button>
								<div></div>
							</div>
						</div>

						<!-- Face Buttons -->
						<div class="flex flex-col items-center gap-0.5">
							<span class="mb-1 text-[10px] text-zinc-600">Face</span>
							<div class="grid grid-cols-3 grid-rows-3 gap-0.5" style="width: 78px; height: 78px;">
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_TRIANGLE') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerTap('PS5_TRIANGLE')}
									title="Triangle"
								>{'\u25B3'}</button>
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_SQUARE') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerTap('PS5_SQUARE')}
									title="Square"
								>{'\u25A1'}</button>
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_CIRCLE') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerTap('PS5_CIRCLE')}
									title="Circle"
								>{'\u25CB'}</button>
								<div></div>
								<button
									class="flex items-center justify-center rounded text-xs transition-colors {heldControllerButtons.has('PS5_CROSS') ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
									onmousedown={() => controllerTap('PS5_CROSS')}
									title="Cross"
								>{'\u2715'}</button>
								<div></div>
							</div>
						</div>

						<!-- Shoulders -->
						<div class="flex flex-col items-center gap-1">
							<span class="mb-0.5 text-[10px] text-zinc-600">Shoulders</span>
							<div class="grid grid-cols-2 gap-1">
								{#each CONTROLLER_BUTTONS.shoulder as btn}
									<button
										class="rounded px-2.5 py-1.5 text-xs font-medium transition-colors {heldControllerButtons.has(btn.name) ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
										onmousedown={() => controllerPress(btn.name)}
										onmouseup={() => controllerRelease(btn.name)}
										onmouseleave={() => { if (heldControllerButtons.has(btn.name)) controllerRelease(btn.name); }}
									>{btn.label}</button>
								{/each}
							</div>
							<!-- Sticks -->
							<div class="mt-1 grid grid-cols-2 gap-1">
								{#each CONTROLLER_BUTTONS.sticks as btn}
									<button
										class="rounded px-2.5 py-1.5 text-xs font-medium transition-colors {heldControllerButtons.has(btn.name) ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
										onmousedown={() => controllerTap(btn.name)}
									>{btn.label}</button>
								{/each}
							</div>
						</div>

						<!-- Center + Combos -->
						<div class="flex flex-col items-center gap-1">
							<span class="mb-0.5 text-[10px] text-zinc-600">Center</span>
							<div class="grid grid-cols-2 gap-1">
								{#each CONTROLLER_BUTTONS.center as btn}
									<button
										class="rounded px-2 py-1.5 text-[10px] font-medium transition-colors {heldControllerButtons.has(btn.name) ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
										onmousedown={() => controllerTap(btn.name)}
									>{btn.label}</button>
								{/each}
							</div>
							<span class="mt-2 text-[10px] text-zinc-600">Combos</span>
							<div class="flex flex-col gap-1">
								{#each COMBO_PRESETS as combo}
									<button
										class="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
										onmousedown={() => comboPress(combo.buttons)}
									>{combo.label}</button>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Key map hint -->
			<div class="border-t border-zinc-800 px-4 py-2 text-center text-[10px] text-zinc-600">
				Arrows: D-pad | Enter: Confirm | Backspace: Cancel | Esc: Close
			</div>
		</div>
	</div>
{/if}
