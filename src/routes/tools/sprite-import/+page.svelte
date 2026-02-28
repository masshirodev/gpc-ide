<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { addToast } from '$lib/stores/toast.svelte';
	import ToolHeader from '$lib/components/layout/ToolHeader.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { saveSpriteCollection } from '$lib/tauri/commands';
	import SpriteEditor from '$lib/components/sprites/SpriteEditor.svelte';
	import type { SpriteFrame } from '$lib/types/sprite';
	import { spriteToBase64, bytesPerRow } from '$lib/utils/sprite-pixels';

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	let imageUrl = $state('');
	let imgEl: HTMLImageElement | undefined = $state();
	let imgLoaded = $state(false);

	let srcWidth = $state(0);
	let srcHeight = $state(0);

	let cellWidth = $state(16);
	let cellHeight = $state(16);
	let threshold = $state(128);

	let cols = $derived(srcWidth > 0 && cellWidth > 0 ? Math.floor(srcWidth / cellWidth) : 0);
	let rows = $derived(srcHeight > 0 && cellHeight > 0 ? Math.floor(srcHeight / cellHeight) : 0);
	let frameCount = $derived(cols * rows);

	let frames = $state<SpriteFrame[]>([]);
	let collectionName = $state('sprite');

	let gridCanvas: HTMLCanvasElement | undefined = $state();

	// Editor mode
	let editing = $state(false);

	// Saving
	let saving = $state(false);
	let selectedWorkspace = $state('');

	$effect(() => {
		if (settings.workspaces.length > 0 && !selectedWorkspace) {
			selectedWorkspace = settings.workspaces[0];
		}
	});

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			addToast(m.sprite_select_image(), 'error');
			return;
		}

		imgLoaded = false;
		frames = [];
		editing = false;

		const reader = new FileReader();
		reader.onload = () => {
			imageUrl = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function handleImageLoad() {
		if (!imgEl) return;
		srcWidth = imgEl.naturalWidth;
		srcHeight = imgEl.naturalHeight;
		imgLoaded = true;
		drawGrid();
	}

	let gridRedrawTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (imgLoaded) {
			void cellWidth;
			void cellHeight;
			clearTimeout(gridRedrawTimer);
			gridRedrawTimer = setTimeout(() => drawGrid(), 300);
		}
	});

	function drawGrid() {
		if (!gridCanvas || !imgEl) return;

		const scale = Math.min(1, 600 / srcWidth, 400 / srcHeight);
		gridCanvas.width = srcWidth * scale;
		gridCanvas.height = srcHeight * scale;

		const ctx = gridCanvas.getContext('2d');
		if (!ctx) return;

		ctx.drawImage(imgEl, 0, 0, gridCanvas.width, gridCanvas.height);

		ctx.strokeStyle = 'rgba(0, 255, 128, 0.5)';
		ctx.lineWidth = 1;

		for (let c = 0; c <= cols; c++) {
			const x = c * cellWidth * scale;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, rows * cellHeight * scale);
			ctx.stroke();
		}
		for (let r = 0; r <= rows; r++) {
			const y = r * cellHeight * scale;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(cols * cellWidth * scale, y);
			ctx.stroke();
		}
	}

	function sliceFrames() {
		if (!imgEl || !imgLoaded) return;

		const offscreen = document.createElement('canvas');
		offscreen.width = srcWidth;
		offscreen.height = srcHeight;
		const ctx = offscreen.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(imgEl, 0, 0);

		const result: SpriteFrame[] = [];

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const sx = c * cellWidth;
				const sy = r * cellHeight;
				const imageData = ctx.getImageData(sx, sy, cellWidth, cellHeight);
				const bytes = pixelsToPacked(imageData.data, cellWidth, cellHeight, threshold);
				const pixelArray = new Uint8Array(bytes);
				result.push({
					id: crypto.randomUUID(),
					pixels: spriteToBase64(pixelArray),
					width: cellWidth,
					height: cellHeight
				});
			}
		}

		frames = result;
		addToast(m.sprite_sliced_toast({ count: result.length.toString(), width: cellWidth.toString(), height: cellHeight.toString() }), 'success');
	}

	function pixelsToPacked(
		rgba: Uint8ClampedArray,
		w: number,
		h: number,
		thresh: number
	): number[] {
		const bpr = bytesPerRow(w);
		const result: number[] = new Array(bpr * h).fill(0);

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = (y * w + x) * 4;
				const gray = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
				const alpha = rgba[i + 3];
				const isLit = alpha > 128 && gray >= thresh;

				if (isLit) {
					const byteIdx = y * bpr + Math.floor(x / 8);
					const bitIdx = 7 - (x % 8);
					result[byteIdx] |= 1 << bitIdx;
				}
			}
		}

		return result;
	}

	function renderFramePreview(canvas: HTMLCanvasElement, frame: SpriteFrame) {
		const w = frame.width;
		const h = frame.height;
		const scale = Math.max(2, Math.min(4, Math.floor(64 / Math.max(w, h))));
		canvas.width = w * scale;
		canvas.height = h * scale;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const imageData = ctx.createImageData(canvas.width, canvas.height);
		const data = imageData.data;
		const bpr = bytesPerRow(w);
		const bytes = atob(frame.pixels);

		// Fill background (#101010)
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 16;
			data[i + 1] = 16;
			data[i + 2] = 16;
			data[i + 3] = 255;
		}

		// Fill lit pixels (#00ff80)
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const byteIdx = y * bpr + Math.floor(x / 8);
				const bitIdx = 7 - (x % 8);
				if (bytes.charCodeAt(byteIdx) & (1 << bitIdx)) {
					for (let sy = 0; sy < scale; sy++) {
						for (let sx = 0; sx < scale; sx++) {
							const pi = ((y * scale + sy) * canvas.width + (x * scale + sx)) * 4;
							data[pi] = 0;
							data[pi + 1] = 255;
							data[pi + 2] = 128;
						}
					}
				}
			}
		}

		ctx.putImageData(imageData, 0, 0);
	}

	$effect(() => {
		if (frames.length > 0 && !editing) {
			// Render frame previews in chunks to avoid blocking the main thread.
			// Query DOM inside rAF so Svelte has flushed the {#each} canvases first.
			let cancelled = false;
			const framesCopy = [...frames];

			requestAnimationFrame(() => {
				if (cancelled) return;
				const canvases = document.querySelectorAll<HTMLCanvasElement>('.frame-preview');
				let index = 0;
				const CHUNK = 4;

				function renderChunk() {
					if (cancelled) return;
					for (let i = 0; i < CHUNK && index < canvases.length; i++, index++) {
						if (index < framesCopy.length) {
							renderFramePreview(canvases[index], framesCopy[index]);
						}
					}
					if (index < canvases.length) {
						requestAnimationFrame(renderChunk);
					}
				}

				renderChunk();
			});

			return () => { cancelled = true; };
		}
	});

	function openEditor() {
		editing = true;
	}

	function handleEditorDone(updatedFrames: SpriteFrame[]) {
		frames = updatedFrames;
		editing = false;
	}

	function handleEditorCancel() {
		editing = false;
	}

	async function saveCollection() {
		if (!selectedWorkspace || !collectionName.trim() || frames.length === 0) return;

		saving = true;
		try {
			const now = new Date().toISOString();
			await saveSpriteCollection(selectedWorkspace, {
				version: 1,
				id: crypto.randomUUID(),
				name: collectionName.trim(),
				frames,
				createdAt: now,
				updatedAt: now
			});
			addToast(m.sprite_saved_toast({ name: collectionName.trim() }), 'success');
		} catch (e) {
			addToast(`Error: ${e}`, 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="relative flex h-full flex-col bg-zinc-950 text-zinc-200">
	<!-- Editor fullscreen overlay (absolute, not fixed, to avoid Tauri title bar drag region) -->
	{#if editing}
		<div class="absolute inset-0 z-50 bg-zinc-950">
			<SpriteEditor
				{frames}
				onDone={handleEditorDone}
				onCancel={handleEditorCancel}
			/>
		</div>
	{/if}
	<ToolHeader title={m.sprite_title()} subtitle={m.sprite_subtitle()} />

	<!-- Controls -->
	<div class="flex flex-wrap items-center gap-3 border-b border-zinc-800 p-4">
		<label
			class="cursor-pointer rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
		>
			{m.sprite_load_image()}
			<input
				type="file"
				accept="image/*"
				class="hidden"
				onchange={handleFileInput}
			/>
		</label>

		{#if imgLoaded}
			<div class="mx-2 h-5 w-px bg-zinc-700"></div>
			<div class="flex items-center gap-2">
				<label class="text-[10px] text-zinc-500 uppercase">{m.sprite_cell_w()}</label>
				<input
					type="number"
					class="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
					bind:value={cellWidth}
					min="4"
					max="128"
				/>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-[10px] text-zinc-500 uppercase">{m.sprite_cell_h()}</label>
				<input
					type="number"
					class="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
					bind:value={cellHeight}
					min="4"
					max="64"
				/>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-[10px] text-zinc-500 uppercase">{m.sprite_threshold()}</label>
				<input
					type="range"
					class="w-20"
					bind:value={threshold}
					min="1"
					max="255"
				/>
				<span class="text-[10px] text-zinc-500">{threshold}</span>
			</div>
			<span class="text-[10px] text-zinc-500">
				{m.sprite_frames_info({ cols: cols.toString(), rows: rows.toString(), count: frameCount.toString() })}
			</span>
			<button
				class="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
				disabled={frameCount === 0}
				onclick={sliceFrames}
			>
				{m.sprite_slice()}
			</button>
		{/if}
	</div>

	<!-- Hidden image for loading -->
	{#if imageUrl}
		<img
			bind:this={imgEl}
			src={imageUrl}
			alt=""
			class="hidden"
			onload={handleImageLoad}
		/>
	{/if}

	<div class="flex min-h-0 flex-1 overflow-auto">
		{#if imgLoaded}
			<div class="flex flex-1 flex-col gap-4 overflow-auto p-4">
				<!-- Grid preview -->
				<div class="rounded border border-zinc-800 bg-zinc-900 p-3">
					<h3 class="mb-2 text-xs font-medium text-zinc-400">
						{m.sprite_source({ width: srcWidth.toString(), height: srcHeight.toString() })}
					</h3>
					<div class="overflow-auto">
						<canvas bind:this={gridCanvas} class="block"></canvas>
					</div>
				</div>

				<!-- Sliced frames -->
				{#if frames.length > 0}
					<div class="rounded border border-zinc-800 bg-zinc-900 p-3">
						<div class="mb-2 flex items-center justify-between">
							<h3 class="text-xs font-medium text-zinc-400">
								{m.sprite_frames({ count: frames.length.toString() })}
							</h3>
							<button
								class="rounded bg-zinc-700 px-3 py-1 text-[10px] text-zinc-300 hover:bg-zinc-600"
								onclick={openEditor}
							>
								{m.sprite_edit_frames()}
							</button>
						</div>
						<div class="flex flex-wrap gap-2" style="image-rendering: pixelated">
							{#each frames as _, i}
								<div class="flex flex-col items-center rounded border border-zinc-800 bg-zinc-950 p-1">
									<canvas class="frame-preview block"></canvas>
									<span class="mt-0.5 text-[8px] text-zinc-500">#{i}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Save to Collection -->
					<div class="rounded border border-zinc-800 bg-zinc-900 p-3">
						<h3 class="mb-3 text-xs font-medium text-zinc-400">{m.sprite_save_collection()}</h3>
						<div class="flex flex-wrap items-end gap-3">
							<div class="flex min-w-0 flex-col gap-1">
								<label class="text-[10px] text-zinc-500 uppercase">{m.sprite_collection_name()}</label>
								<input
									type="text"
									class="w-40 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
									bind:value={collectionName}
								/>
							</div>
							{#if settings.workspaces.length > 1}
								<div class="flex min-w-0 flex-col gap-1">
									<label class="text-[10px] text-zinc-500 uppercase">Workspace</label>
									<select
										class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
										bind:value={selectedWorkspace}
									>
										{#each settings.workspaces as ws}
											<option value={ws}>{ws.split('/').pop()}</option>
										{/each}
									</select>
								</div>
							{/if}
							<button
								class="shrink-0 rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
								disabled={!collectionName.trim() || !selectedWorkspace || saving}
								onclick={saveCollection}
							>
								{saving ? m.common_saving() : m.sprite_save_collection()}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex h-full flex-1 flex-col items-center justify-center gap-3 text-zinc-600">
				<svg class="h-16 w-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<p class="text-sm">{m.sprite_load_hint()}</p>
				<p class="text-xs text-zinc-700">{m.sprite_load_formats()}</p>
			</div>
		{/if}
	</div>
</div>
