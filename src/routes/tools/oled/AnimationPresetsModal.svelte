<script lang="ts">
	import type { AnimationPreset, AnimationPresetParam } from '$lib/oled-animations/types';
	import type { OledScene } from './types';
	import { starfieldPreset } from '$lib/oled-animations/starfield';
	import { rainPreset } from '$lib/oled-animations/rain';

	interface Props {
		open: boolean;
		onInsert: (scenes: OledScene[]) => void;
		onCancel: () => void;
	}

	let { open, onInsert, onCancel }: Props = $props();

	const presets: AnimationPreset[] = [starfieldPreset, rainPreset];

	let selectedPreset = $state<AnimationPreset | null>(null);
	let params = $state<Record<string, unknown>>({});
	let previewScenes = $state<OledScene[]>([]);
	let previewFrame = $state(0);
	let previewCanvas: HTMLCanvasElement | undefined = $state();

	function selectPreset(p: AnimationPreset) {
		selectedPreset = p;
		const cfg: Record<string, unknown> = {};
		for (const param of p.params) {
			cfg[param.key] = param.default;
		}
		params = cfg;
		previewScenes = [];
		previewFrame = 0;
	}

	function handlePreview() {
		if (!selectedPreset) return;
		previewScenes = selectedPreset.generate(params);
		previewFrame = 0;
		drawPreview();
	}

	function drawPreview() {
		if (!previewCanvas || previewScenes.length === 0) return;
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;
		const scene = previewScenes[previewFrame];
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 256, 128);
		for (let y = 0; y < 64; y++) {
			for (let x = 0; x < 128; x++) {
				const byteIdx = y * 16 + Math.floor(x / 8);
				const bitIdx = 7 - (x % 8);
				if (scene.pixels[byteIdx] & (1 << bitIdx)) {
					ctx.fillStyle = '#fff';
					ctx.fillRect(x * 2, y * 2, 2, 2);
				}
			}
		}
	}

	$effect(() => {
		if (previewCanvas && previewScenes.length > 0) {
			void previewFrame;
			drawPreview();
		}
	});

	function nextFrame() {
		if (previewScenes.length === 0) return;
		previewFrame = (previewFrame + 1) % previewScenes.length;
	}

	function prevFrame() {
		if (previewScenes.length === 0) return;
		previewFrame = (previewFrame - 1 + previewScenes.length) % previewScenes.length;
	}

	function handleInsert() {
		if (previewScenes.length === 0) handlePreview();
		if (previewScenes.length > 0) {
			onInsert(previewScenes);
		}
	}

	function handleParamChange(key: string, value: unknown) {
		params = { ...params, [key]: value };
		previewScenes = [];
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onmousedown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
	>
		<div class="w-[600px] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-zinc-200">Animation Presets</h2>
				<button class="text-zinc-400 hover:text-zinc-200" onclick={onCancel}>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="flex" style="height: 400px;">
				<!-- Preset list -->
				<div class="w-48 overflow-y-auto border-r border-zinc-800 p-2">
					{#each presets as p}
						<button
							class="mb-1 w-full rounded px-3 py-2 text-left text-sm {selectedPreset?.id === p.id
								? 'bg-zinc-700 text-emerald-400'
								: 'text-zinc-300 hover:bg-zinc-800'}"
							onclick={() => selectPreset(p)}
						>
							<div class="font-medium">{p.name}</div>
							<div class="text-xs text-zinc-500">{p.description}</div>
						</button>
					{/each}
				</div>

				<!-- Config + Preview -->
				<div class="flex flex-1 flex-col overflow-y-auto p-3">
					{#if selectedPreset}
						<!-- Params -->
						<div class="mb-3 space-y-2">
							{#each selectedPreset.params as param}
								<div class="flex items-center gap-2">
									<label class="w-28 text-xs text-zinc-400">{param.label}</label>
									{#if param.type === 'number'}
										<input
											type="number"
											value={params[param.key] as number}
											min={param.min}
											max={param.max}
											class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
											oninput={(e) => handleParamChange(param.key, parseInt((e.target as HTMLInputElement).value) || param.default)}
										/>
									{:else if param.type === 'boolean'}
										<input
											type="checkbox"
											checked={params[param.key] as boolean}
											onchange={(e) => handleParamChange(param.key, (e.target as HTMLInputElement).checked)}
											class="accent-emerald-500"
										/>
									{/if}
								</div>
							{/each}
						</div>

						<button
							class="mb-3 w-full rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
							onclick={handlePreview}
						>
							Preview
						</button>

						<!-- Preview -->
						{#if previewScenes.length > 0}
							<div class="flex flex-col items-center">
								<canvas bind:this={previewCanvas} width="256" height="128" class="rounded border border-zinc-700 bg-black"></canvas>
								<div class="mt-2 flex items-center gap-3">
									<button class="text-xs text-zinc-400 hover:text-zinc-200" onclick={prevFrame}>Prev</button>
									<span class="text-xs text-zinc-500">
										{previewFrame + 1} / {previewScenes.length}
									</span>
									<button class="text-xs text-zinc-400 hover:text-zinc-200" onclick={nextFrame}>Next</button>
								</div>
							</div>
						{/if}
					{:else}
						<div class="flex flex-1 items-center justify-center text-xs text-zinc-500">
							Select a preset from the list
						</div>
					{/if}
				</div>
			</div>

			<div class="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
				<button
					class="rounded px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
					onclick={onCancel}
				>
					Cancel
				</button>
				<button
					class="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
					onclick={handleInsert}
					disabled={!selectedPreset}
				>
					Insert Scenes
				</button>
			</div>
		</div>
	</div>
{/if}
