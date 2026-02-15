<script lang="ts">
	import { onMount } from 'svelte';
	import { OLED_WIDTH, OLED_HEIGHT, type OledScene, type AnimationConfig } from './types';
	import { getPixel } from './pixels';

	interface Props {
		scenes: OledScene[];
		activeSceneId: string;
		animation: AnimationConfig;
		onAnimationChange: (config: AnimationConfig) => void;
	}

	let { scenes, activeSceneId, animation, onAnimationChange }: Props = $props();

	let previewCanvas: HTMLCanvasElement;
	let playing = $state(false);
	let playFrameIndex = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	const SCALE = 2;

	let displayScene = $derived.by(() => {
		if (playing) {
			return scenes[playFrameIndex % scenes.length] || scenes[0];
		}
		return scenes.find((s) => s.id === activeSceneId) || scenes[0];
	});

	function renderPreview() {
		if (!previewCanvas || !displayScene) return;
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;

		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, OLED_WIDTH * SCALE, OLED_HEIGHT * SCALE);

		ctx.fillStyle = '#e4e4e7';
		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < OLED_WIDTH; x++) {
				if (getPixel(displayScene.pixels, x, y)) {
					ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
				}
			}
		}
	}

	function togglePlay() {
		playing = !playing;
		if (playing) {
			playFrameIndex = 0;
			startInterval();
		} else {
			stopInterval();
		}
	}

	function startInterval() {
		stopInterval();
		intervalId = setInterval(() => {
			playFrameIndex = (playFrameIndex + 1) % scenes.length;
		}, animation.frameDelayMs);
	}

	function stopInterval() {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	onMount(() => {
		return () => stopInterval();
	});

	$effect(() => {
		void displayScene;
		renderPreview();
	});

	$effect(() => {
		if (playing) {
			startInterval();
		}
	});
</script>

<div class="flex flex-col gap-2">
	<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Preview</h3>

	<div class="flex justify-center rounded border border-zinc-700 bg-black p-2">
		<canvas
			bind:this={previewCanvas}
			width={OLED_WIDTH * SCALE}
			height={OLED_HEIGHT * SCALE}
			class="block"
		></canvas>
	</div>

	{#if scenes.length > 1}
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<button
					class="rounded px-2 py-1 text-xs {playing
						? 'bg-red-600/20 text-red-400'
						: 'bg-emerald-600/20 text-emerald-400'} hover:brightness-110"
					onclick={togglePlay}
				>
					{playing ? 'Stop' : 'Play'}
				</button>
				{#if playing}
					<span class="text-xs text-zinc-500">
						{playFrameIndex + 1}/{scenes.length}
					</span>
				{/if}
			</div>

			<label class="block">
				<span class="text-xs text-zinc-400">Frame Delay</span>
				<input
					type="range"
					min="50"
					max="2000"
					step="50"
					value={animation.frameDelayMs}
					oninput={(e) =>
						onAnimationChange({
							...animation,
							frameDelayMs: parseInt(e.currentTarget.value)
						})}
					class="mt-0.5 block w-full accent-emerald-600"
				/>
				<span class="text-xs text-zinc-500">{animation.frameDelayMs}ms</span>
			</label>

			<label class="flex items-center gap-2 text-xs text-zinc-400">
				<input
					type="checkbox"
					checked={animation.loop}
					onchange={(e) =>
						onAnimationChange({ ...animation, loop: e.currentTarget.checked })}
					class="accent-emerald-600"
				/>
				Loop
			</label>
		</div>
	{/if}
</div>
