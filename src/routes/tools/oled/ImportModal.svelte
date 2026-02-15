<script lang="ts">
	import { tick } from 'svelte';
	import { OLED_WIDTH, OLED_HEIGHT } from './types';
	import { createEmptyPixels, setPixel } from './pixels';

	interface Props {
		open: boolean;
		onApply: (pixels: Uint8Array) => void;
		onCancel: () => void;
	}

	let { open, onApply, onCancel }: Props = $props();

	let previewCanvas = $state<HTMLCanvasElement>(null!);
	let sourceCanvas = $state<HTMLCanvasElement>(null!);

	let imageLoaded = $state(false);
	let threshold = $state(128);
	let dithering = $state<'none' | 'floyd-steinberg' | 'atkinson' | 'ordered'>('none');
	let resultPixels = $state<Uint8Array>(createEmptyPixels());

	// Store the offscreen canvas and image data so we can re-process
	let offscreenCanvas: HTMLCanvasElement | null = null;
	let imageData: ImageData | null = null;

	function resetState() {
		imageLoaded = false;
		threshold = 128;
		dithering = 'none';
		resultPixels = createEmptyPixels();
		offscreenCanvas = null;
		imageData = null;
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const img = new Image();
		img.onload = async () => {
			// Draw to off-screen canvas scaled to 128x64
			offscreenCanvas = document.createElement('canvas');
			offscreenCanvas.width = OLED_WIDTH;
			offscreenCanvas.height = OLED_HEIGHT;
			const ctx = offscreenCanvas.getContext('2d')!;
			ctx.fillStyle = '#000000';
			ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);

			// Fit while preserving aspect ratio
			const scale = Math.min(OLED_WIDTH / img.width, OLED_HEIGHT / img.height);
			const w = img.width * scale;
			const h = img.height * scale;
			const x = (OLED_WIDTH - w) / 2;
			const y = (OLED_HEIGHT - h) / 2;
			ctx.drawImage(img, x, y, w, h);

			imageData = ctx.getImageData(0, 0, OLED_WIDTH, OLED_HEIGHT);
			imageLoaded = true;

			// Wait for the {#if imageLoaded} block to mount the canvases
			await tick();

			renderSource();
			processImage();
		};
		img.src = URL.createObjectURL(file);
	}

	function renderSource() {
		if (!sourceCanvas || !offscreenCanvas) return;
		const sCtx = sourceCanvas.getContext('2d');
		if (!sCtx) return;
		sCtx.fillStyle = '#000000';
		sCtx.fillRect(0, 0, OLED_WIDTH * 2, OLED_HEIGHT * 2);
		sCtx.imageSmoothingEnabled = false;
		sCtx.drawImage(offscreenCanvas, 0, 0, OLED_WIDTH * 2, OLED_HEIGHT * 2);
	}

	function toGrayscale(data: ImageData): Float32Array {
		const gray = new Float32Array(data.width * data.height);
		for (let i = 0; i < gray.length; i++) {
			const r = data.data[i * 4];
			const g = data.data[i * 4 + 1];
			const b = data.data[i * 4 + 2];
			gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
		}
		return gray;
	}

	function applyThresholdFilter(gray: Float32Array, t: number): Uint8Array {
		const pixels = createEmptyPixels();
		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < OLED_WIDTH; x++) {
				if (gray[y * OLED_WIDTH + x] >= t) {
					setPixel(pixels, x, y, true);
				}
			}
		}
		return pixels;
	}

	function applyFloydSteinberg(gray: Float32Array, t: number): Uint8Array {
		const g = new Float32Array(gray);
		const pixels = createEmptyPixels();

		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < OLED_WIDTH; x++) {
				const i = y * OLED_WIDTH + x;
				const old = g[i];
				const val = old >= t ? 255 : 0;
				const err = old - val;

				if (val > 0) setPixel(pixels, x, y, true);

				if (x + 1 < OLED_WIDTH) g[i + 1] += (err * 7) / 16;
				if (y + 1 < OLED_HEIGHT) {
					if (x - 1 >= 0) g[i + OLED_WIDTH - 1] += (err * 3) / 16;
					g[i + OLED_WIDTH] += (err * 5) / 16;
					if (x + 1 < OLED_WIDTH) g[i + OLED_WIDTH + 1] += (err * 1) / 16;
				}
			}
		}
		return pixels;
	}

	function applyAtkinson(gray: Float32Array, t: number): Uint8Array {
		const g = new Float32Array(gray);
		const pixels = createEmptyPixels();
		const w = OLED_WIDTH;

		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < w; x++) {
				const i = y * w + x;
				const old = g[i];
				const val = old >= t ? 255 : 0;
				const err = (old - val) / 8;

				if (val > 0) setPixel(pixels, x, y, true);

				if (x + 1 < w) g[i + 1] += err;
				if (x + 2 < w) g[i + 2] += err;
				if (y + 1 < OLED_HEIGHT) {
					if (x - 1 >= 0) g[i + w - 1] += err;
					g[i + w] += err;
					if (x + 1 < w) g[i + w + 1] += err;
				}
				if (y + 2 < OLED_HEIGHT) g[i + w * 2] += err;
			}
		}
		return pixels;
	}

	function applyOrdered(gray: Float32Array): Uint8Array {
		const bayer4 = [
			[0, 8, 2, 10],
			[12, 4, 14, 6],
			[3, 11, 1, 9],
			[15, 7, 13, 5]
		];

		const pixels = createEmptyPixels();
		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < OLED_WIDTH; x++) {
				const val = gray[y * OLED_WIDTH + x];
				const t = ((bayer4[y % 4][x % 4] + 0.5) / 16) * 255;
				if (val > t) setPixel(pixels, x, y, true);
			}
		}
		return pixels;
	}

	function processImage() {
		if (!imageData) return;
		const gray = toGrayscale(imageData);
		const t = threshold;
		const d = dithering;

		switch (d) {
			case 'none':
				resultPixels = applyThresholdFilter(gray, t);
				break;
			case 'floyd-steinberg':
				resultPixels = applyFloydSteinberg(gray, t);
				break;
			case 'atkinson':
				resultPixels = applyAtkinson(gray, t);
				break;
			case 'ordered':
				resultPixels = applyOrdered(gray);
				break;
		}

		renderPreview();
	}

	function renderPreview() {
		if (!previewCanvas) return;
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;

		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, OLED_WIDTH * 2, OLED_HEIGHT * 2);
		ctx.fillStyle = '#e4e4e7';

		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < OLED_WIDTH; x++) {
				const i = y * OLED_WIDTH + x;
				const byteIdx = i >> 3;
				const bitOff = 7 - (i & 7);
				if (resultPixels[byteIdx] & (1 << bitOff)) {
					ctx.fillRect(x * 2, y * 2, 2, 2);
				}
			}
		}
	}

	function handleApply() {
		onApply(resultPixels);
		resetState();
	}

	function handleCancel() {
		onCancel();
		resetState();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) handleCancel();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') handleCancel();
	}

	// React to threshold/dithering changes
	$effect(() => {
		// Read reactive deps explicitly
		const _t = threshold;
		const _d = dithering;
		const _loaded = imageLoaded;

		if (_loaded && imageData) {
			// Use untrack-free call since we already read deps above
			const gray = toGrayscale(imageData);
			let newPixels: Uint8Array;

			switch (_d) {
				case 'none':
					newPixels = applyThresholdFilter(gray, _t);
					break;
				case 'floyd-steinberg':
					newPixels = applyFloydSteinberg(gray, _t);
					break;
				case 'atkinson':
					newPixels = applyAtkinson(gray, _t);
					break;
				case 'ordered':
					newPixels = applyOrdered(gray);
					break;
			}

			resultPixels = newPixels;

			// Render preview after updating pixels
			if (previewCanvas) {
				const ctx = previewCanvas.getContext('2d');
				if (ctx) {
					ctx.fillStyle = '#000000';
					ctx.fillRect(0, 0, OLED_WIDTH * 2, OLED_HEIGHT * 2);
					ctx.fillStyle = '#e4e4e7';
					for (let y = 0; y < OLED_HEIGHT; y++) {
						for (let x = 0; x < OLED_WIDTH; x++) {
							const i = y * OLED_WIDTH + x;
							const byteIdx = i >> 3;
							const bitOff = 7 - (i & 7);
							if (newPixels[byteIdx] & (1 << bitOff)) {
								ctx.fillRect(x * 2, y * 2, 2, 2);
							}
						}
					}
				}
			}
		}
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onclick={handleBackdropClick}
	>
		<div class="w-[600px] rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
			<h2 class="mb-4 text-lg font-semibold text-zinc-100">Import Image</h2>

			<div class="space-y-4">
				<div>
					<input
						type="file"
						accept="image/*"
						onchange={handleFileSelect}
						class="block w-full text-sm text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-300 hover:file:bg-zinc-700"
					/>
				</div>

				{#if imageLoaded}
					<div class="flex gap-4">
						<div>
							<span class="mb-1 block text-xs text-zinc-500">Source</span>
							<canvas
								bind:this={sourceCanvas}
								width={OLED_WIDTH * 2}
								height={OLED_HEIGHT * 2}
								class="rounded border border-zinc-700"
							></canvas>
						</div>
						<div>
							<span class="mb-1 block text-xs text-zinc-500">Result</span>
							<canvas
								bind:this={previewCanvas}
								width={OLED_WIDTH * 2}
								height={OLED_HEIGHT * 2}
								class="rounded border border-zinc-700"
							></canvas>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<label class="block">
							<span class="text-xs text-zinc-400">Threshold</span>
							<input
								type="range"
								min="0"
								max="255"
								bind:value={threshold}
								class="mt-0.5 block w-full accent-emerald-600"
							/>
							<span class="text-xs text-zinc-500">{threshold}</span>
						</label>

						<label class="block">
							<span class="text-xs text-zinc-400">Dithering</span>
							<select
								bind:value={dithering}
								class="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
							>
								<option value="none">None (threshold)</option>
								<option value="floyd-steinberg">Floyd-Steinberg</option>
								<option value="atkinson">Atkinson</option>
								<option value="ordered">Ordered (Bayer 4x4)</option>
							</select>
						</label>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					class="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
					onclick={handleCancel}
				>
					Cancel
				</button>
				<button
					class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					disabled={!imageLoaded}
					onclick={handleApply}
				>
					Apply
				</button>
			</div>
		</div>
	</div>
{/if}
