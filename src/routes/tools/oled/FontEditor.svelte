<script lang="ts">
	import { untrack } from 'svelte';
	import {
		createEmptyFont,
		createGlyph,
		renderGlyphToPixels,
		generateCustomTextGpc,
		type CustomFont,
		type CustomGlyph,
		type LineSegment,
	} from './fonts-custom';
	import { createEmptyPixels } from './pixels';
	import { addToast } from '$lib/stores/toast.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let font = $state<CustomFont>(createEmptyFont('My Font'));
	let editChar = $state('A');
	let currentGlyph = $derived(font.glyphs.get(editChar) || null);

	// Drawing state for line segments
	let drawing = $state(false);
	let startPoint = $state<{ x: number; y: number } | null>(null);
	let previewPixels = $state(createEmptyPixels());
	let previewText = $state('ABC');
	let previewCanvas: HTMLCanvasElement | undefined = $state();

	const CELL_SIZE = 20;
	const GRID_COLS = $derived(font.gridWidth);
	const GRID_ROWS = $derived(font.height);

	function handleGridMouseDown(x: number, y: number) {
		drawing = true;
		startPoint = { x, y };
	}

	function handleGridMouseUp(x: number, y: number) {
		if (!drawing || !startPoint) return;
		drawing = false;

		const seg: LineSegment = {
			x1: startPoint.x,
			y1: startPoint.y,
			x2: x,
			y2: y,
		};

		let glyph = font.glyphs.get(editChar);
		if (!glyph) {
			glyph = createGlyph(editChar, font.gridWidth);
		}

		const updated: CustomGlyph = {
			...glyph,
			segments: [...glyph.segments, seg],
		};

		const newGlyphs = new Map(font.glyphs);
		newGlyphs.set(editChar, updated);
		font = { ...font, glyphs: newGlyphs };
		startPoint = null;
		updatePreview();
	}

	function removeLastSegment() {
		const glyph = font.glyphs.get(editChar);
		if (!glyph || glyph.segments.length === 0) return;

		const updated: CustomGlyph = {
			...glyph,
			segments: glyph.segments.slice(0, -1),
		};

		const newGlyphs = new Map(font.glyphs);
		if (updated.segments.length === 0) {
			newGlyphs.delete(editChar);
		} else {
			newGlyphs.set(editChar, updated);
		}
		font = { ...font, glyphs: newGlyphs };
		updatePreview();
	}

	function clearGlyph() {
		const newGlyphs = new Map(font.glyphs);
		newGlyphs.delete(editChar);
		font = { ...font, glyphs: newGlyphs };
		updatePreview();
	}

	function updatePreview() {
		const pixels = createEmptyPixels();
		let curX = 10;
		for (const ch of previewText) {
			const g = font.glyphs.get(ch);
			if (g) {
				renderGlyphToPixels(g, pixels, curX, 28);
				curX += g.width + font.spacing;
			} else if (ch === ' ') {
				curX += font.gridWidth + font.spacing;
			}
		}
		previewPixels = pixels;
		drawPreviewCanvas();
	}

	function drawPreviewCanvas() {
		if (!previewCanvas) return;
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 256, 128);
		for (let y = 0; y < 64; y++) {
			for (let x = 0; x < 128; x++) {
				const byteIdx = y * 16 + Math.floor(x / 8);
				const bitIdx = 7 - (x % 8);
				if (previewPixels[byteIdx] & (1 << bitIdx)) {
					ctx.fillStyle = '#fff';
					ctx.fillRect(x * 2, y * 2, 2, 2);
				}
			}
		}
	}

	$effect(() => {
		if (previewCanvas && open) {
			void previewText;
			void font;
			untrack(() => updatePreview());
		}
	});

	function handleCopyGpc() {
		const code = generateCustomTextGpc(font, previewText, 10, 28);
		navigator.clipboard.writeText(code);
		addToast('GPC code copied', 'success');
	}

	const charPresets = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onmousedown={(e) => { if (e.target === e.currentTarget) onClose(); }}
	>
		<div class="w-[700px] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-zinc-200">Custom Font Editor</h2>
				<button class="text-zinc-400 hover:text-zinc-200" onclick={onClose}>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="flex" style="height: 450px;">
				<!-- Character selector -->
				<div class="w-52 overflow-y-auto border-r border-zinc-800 p-3">
					<div class="mb-2">
						<label class="mb-1 block text-xs text-zinc-400" for="font-name">Font Name</label>
						<input
							id="font-name"
							type="text"
							class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
							value={font.name}
							oninput={(e) => { font = { ...font, name: (e.target as HTMLInputElement).value }; }}
						/>
					</div>

					<div class="mb-2 flex gap-2">
						<div class="flex-1">
							<label class="mb-0.5 block text-xs text-zinc-500">Height</label>
							<input
								type="number"
								min="4"
								max="16"
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200"
								value={font.height}
								oninput={(e) => { font = { ...font, height: parseInt((e.target as HTMLInputElement).value) || 8 }; }}
							/>
						</div>
						<div class="flex-1">
							<label class="mb-0.5 block text-xs text-zinc-500">Width</label>
							<input
								type="number"
								min="3"
								max="16"
								class="w-full rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200"
								value={font.gridWidth}
								oninput={(e) => { font = { ...font, gridWidth: parseInt((e.target as HTMLInputElement).value) || 8 }; }}
							/>
						</div>
					</div>

					<label class="mb-1 block text-xs text-zinc-400">Character</label>
					<div class="mb-2 flex flex-wrap gap-0.5">
						{#each charPresets.split('') as ch}
							<button
								class="h-6 w-6 rounded text-center text-xs {editChar === ch
									? 'bg-emerald-600 text-white'
									: font.glyphs.has(ch)
										? 'bg-zinc-700 text-zinc-200'
										: 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}"
								onclick={() => (editChar = ch)}
							>
								{ch}
							</button>
						{/each}
					</div>

					<div class="mb-2">
						<label class="mb-0.5 block text-xs text-zinc-500">Custom char</label>
						<input
							type="text"
							maxlength="1"
							class="w-12 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-center text-xs text-zinc-200"
							value={editChar}
							oninput={(e) => {
								const v = (e.target as HTMLInputElement).value;
								if (v.length > 0) editChar = v[v.length - 1];
							}}
						/>
					</div>

					<div class="text-xs text-zinc-500">
						{font.glyphs.size} glyphs defined
					</div>
				</div>

				<!-- Grid editor -->
				<div class="flex flex-1 flex-col p-3">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-medium text-zinc-300">
							Editing: <span class="text-emerald-400">{editChar}</span>
							{#if currentGlyph}
								<span class="text-xs text-zinc-500">({currentGlyph.segments.length} segments)</span>
							{/if}
						</span>
						<div class="flex gap-1">
							<button
								class="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800"
								onclick={removeLastSegment}
							>
								Undo
							</button>
							<button
								class="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-zinc-800"
								onclick={clearGlyph}
							>
								Clear
							</button>
						</div>
					</div>

					<!-- Pixel grid -->
					<div class="mb-3 flex justify-center">
						<svg
							width={GRID_COLS * CELL_SIZE + 1}
							height={GRID_ROWS * CELL_SIZE + 1}
							class="rounded border border-zinc-700 bg-zinc-950"
						>
							<!-- Grid lines -->
							{#each Array(GRID_COLS + 1) as _, x}
								<line
									x1={x * CELL_SIZE}
									y1="0"
									x2={x * CELL_SIZE}
									y2={GRID_ROWS * CELL_SIZE}
									stroke="#27272a"
									stroke-width="0.5"
								/>
							{/each}
							{#each Array(GRID_ROWS + 1) as _, y}
								<line
									x1="0"
									y1={y * CELL_SIZE}
									x2={GRID_COLS * CELL_SIZE}
									y2={y * CELL_SIZE}
									stroke="#27272a"
									stroke-width="0.5"
								/>
							{/each}

							<!-- Existing segments -->
							{#if currentGlyph}
								{#each currentGlyph.segments as seg}
									<line
										x1={seg.x1 * CELL_SIZE + CELL_SIZE / 2}
										y1={seg.y1 * CELL_SIZE + CELL_SIZE / 2}
										x2={seg.x2 * CELL_SIZE + CELL_SIZE / 2}
										y2={seg.y2 * CELL_SIZE + CELL_SIZE / 2}
										stroke="#22c55e"
										stroke-width="2"
										stroke-linecap="round"
									/>
								{/each}
							{/if}

							<!-- Click targets (grid cells) -->
							{#each Array(GRID_ROWS) as _, y}
								{#each Array(GRID_COLS) as _, x}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<rect
										x={x * CELL_SIZE}
										y={y * CELL_SIZE}
										width={CELL_SIZE}
										height={CELL_SIZE}
										fill="transparent"
										class="cursor-crosshair"
										onmousedown={() => handleGridMouseDown(x, y)}
										onmouseup={() => handleGridMouseUp(x, y)}
									/>
								{/each}
							{/each}
						</svg>
					</div>

					<p class="mb-3 text-center text-xs text-zinc-600">
						Click and drag between grid points to draw line segments
					</p>

					<!-- Text preview -->
					<div class="mb-2">
						<div class="flex items-center gap-2">
							<label class="text-xs text-zinc-400" for="preview-text">Preview</label>
							<input
								id="preview-text"
								type="text"
								class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
								bind:value={previewText}
							/>
							<button
								class="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-500"
								onclick={handleCopyGpc}
							>
								Copy GPC
							</button>
						</div>
					</div>
					<canvas
						bind:this={previewCanvas}
						width="256"
						height="128"
						class="w-full rounded border border-zinc-700 bg-black"
					></canvas>
				</div>
			</div>

			<div class="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
				<button
					class="rounded px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
					onclick={onClose}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
