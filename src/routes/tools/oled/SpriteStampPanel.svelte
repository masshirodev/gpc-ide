<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { listSpriteCollections, readSpriteCollection } from '$lib/tauri/commands';
	import type { SpriteCollectionSummary, SpriteCollection, SpriteFrame } from '$lib/types/sprite';
	import { bytesPerRow } from '$lib/utils/sprite-pixels';

	interface Props {
		onStamp: (pixels: Uint8Array, width: number, height: number, scale: number) => void;
		onSelectFrame: (pixels: Uint8Array | null, width: number, height: number, scale: number) => void;
		onClose: () => void;
	}

	let { onStamp, onSelectFrame, onClose }: Props = $props();

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	let collections = $state<SpriteCollectionSummary[]>([]);
	let activeCollection = $state<SpriteCollection | null>(null);
	let selectedFrameIndex = $state(-1);
	let scale = $state(1);
	let loading = $state(false);

	$effect(() => {
		loadCollections();
	});

	async function loadCollections() {
		loading = true;
		try {
			const results: SpriteCollectionSummary[] = [];
			for (const ws of settings.workspaces) {
				const cols = await listSpriteCollections(ws);
				results.push(...cols);
			}
			collections = results;
		} catch {
			collections = [];
		} finally {
			loading = false;
		}
	}

	async function selectCollection(summary: SpriteCollectionSummary) {
		loading = true;
		selectedFrameIndex = -1;
		onSelectFrame(null, 0, 0, 1);
		try {
			for (const ws of settings.workspaces) {
				try {
					activeCollection = await readSpriteCollection(ws, summary.id);
					break;
				} catch {
					continue;
				}
			}
		} catch {
			activeCollection = null;
		} finally {
			loading = false;
		}
	}

	function selectFrame(index: number) {
		if (!activeCollection) return;
		selectedFrameIndex = index;
		const frame = activeCollection.frames[index];
		const decoded = decodeFrame(frame);
		onSelectFrame(decoded, frame.width, frame.height, scale);
	}

	function handleScaleChange(newScale: number) {
		scale = newScale;
		if (selectedFrameIndex >= 0 && activeCollection) {
			const frame = activeCollection.frames[selectedFrameIndex];
			const decoded = decodeFrame(frame);
			onSelectFrame(decoded, frame.width, frame.height, newScale);
		}
	}

	function handleStamp() {
		if (!activeCollection || selectedFrameIndex < 0) return;
		const frame = activeCollection.frames[selectedFrameIndex];
		const decoded = decodeFrame(frame);
		onStamp(decoded, frame.width, frame.height, scale);
	}

	function decodeFrame(frame: SpriteFrame): Uint8Array {
		const binary = atob(frame.pixels);
		const pixels = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			pixels[i] = binary.charCodeAt(i);
		}
		return pixels;
	}

	function renderFrameThumb(canvas: HTMLCanvasElement, frame: SpriteFrame) {
		const w = frame.width;
		const h = frame.height;
		const s = Math.max(1, Math.min(3, Math.floor(48 / Math.max(w, h))));
		canvas.width = w * s;
		canvas.height = h * s;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.fillStyle = '#101010';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#00ff80';

		const bpr = bytesPerRow(w);
		const bytes = atob(frame.pixels);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const byteIdx = y * bpr + Math.floor(x / 8);
				const bitIdx = 7 - (x % 8);
				if (bytes.charCodeAt(byteIdx) & (1 << bitIdx)) {
					ctx.fillRect(x * s, y * s, s, s);
				}
			}
		}
	}

	// Render frame thumbnails when collection changes
	$effect(() => {
		if (activeCollection && activeCollection.frames.length > 0) {
			requestAnimationFrame(() => {
				const canvases = document.querySelectorAll<HTMLCanvasElement>('.stamp-frame-thumb');
				canvases.forEach((canvas, i) => {
					if (activeCollection && i < activeCollection.frames.length) {
						renderFrameThumb(canvas, activeCollection.frames[i]);
					}
				});
			});
		}
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
		<h3 class="text-xs font-medium text-zinc-300">{m.sprite_stamp_title()}</h3>
		<button
			class="text-zinc-500 hover:text-zinc-300"
			onclick={onClose}
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
		</button>
	</div>

	<div class="flex-1 overflow-y-auto p-3">
		{#if loading}
			<p class="text-xs text-zinc-500">{m.common_loading()}</p>
		{:else if collections.length === 0}
			<p class="text-xs text-zinc-500">{m.sprite_stamp_no_collections()}</p>
		{:else}
			<!-- Collection list -->
			{#if !activeCollection}
				<div class="space-y-1">
					<p class="mb-2 text-[10px] uppercase text-zinc-500">{m.sprite_stamp_collection()}</p>
					{#each collections as col}
						<button
							class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800"
							onclick={() => selectCollection(col)}
						>
							<span>{col.name}</span>
							<span class="text-zinc-600">{col.frame_count} frames</span>
						</button>
					{/each}
				</div>
			{:else}
				<!-- Frame selection -->
				<div>
					<button
						class="mb-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
						onclick={() => {
							activeCollection = null;
							selectedFrameIndex = -1;
							onSelectFrame(null, 0, 0, 1);
						}}
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
						</svg>
						{activeCollection.name}
					</button>

					<p class="mb-2 text-[10px] uppercase text-zinc-500">{m.sprite_stamp_frame()}</p>
					<div class="flex flex-wrap gap-1">
						{#each activeCollection.frames as _, i}
							<button
								class="rounded border p-0.5 transition-colors
									{selectedFrameIndex === i
										? 'border-emerald-600 bg-emerald-600/10'
										: 'border-zinc-700 hover:border-zinc-600'}"
								onclick={() => selectFrame(i)}
								style="image-rendering: pixelated"
							>
								<canvas class="stamp-frame-thumb block"></canvas>
							</button>
						{/each}
					</div>

					{#if selectedFrameIndex >= 0}
						<!-- Scale -->
						<div class="mt-3">
							<label class="flex items-center gap-2 text-[10px] text-zinc-500">
								<span class="uppercase">{m.sprite_stamp_scale()}</span>
								<input
									type="range"
									min="1"
									max="4"
									value={scale}
									oninput={(e) => handleScaleChange(parseInt(e.currentTarget.value))}
									class="w-20 accent-emerald-600"
								/>
								<span>{scale}x</span>
							</label>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
