<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { listSpriteCollections, readSpriteCollection, deleteSpriteCollection, saveSpriteCollection } from '$lib/tauri/commands';
	import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
	import type { SpriteCollectionSummary, SpriteCollection, SpriteFrame } from '$lib/types/sprite';
	import { bytesPerRow, spriteToBase64 } from '$lib/utils/sprite-pixels';
	import type { SelectionState } from './types';

	interface Props {
		onStamp: (pixels: Uint8Array, width: number, height: number, scale: number) => void;
		onSelectFrame: (pixels: Uint8Array | null, width: number, height: number, scale: number) => void;
		onClose: () => void;
		/** Current OLED canvas pixels (128x64 bit-packed) */
		canvasPixels: Uint8Array;
		/** Current selection state */
		selection: SelectionState;
	}

	let { onStamp, onSelectFrame, onClose, canvasPixels, selection }: Props = $props();

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	let collections = $state<SpriteCollectionSummary[]>([]);
	let activeCollection = $state<SpriteCollection | null>(null);
	let selectedFrameIndex = $state(-1);
	let scaleIndex = $state(4);
	let loading = $state(false);
	let managing = $state(false);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	// Add-frame dropdown
	let showAddMenu = $state(false);

	// Confirm dialog state
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmAction = $state<(() => void) | null>(null);

	const SCALE_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
	let scale = $derived(SCALE_STEPS[scaleIndex]);

	let hasSelection = $derived(selection.x >= 0 && selection.w > 0 && selection.h > 0);

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

	function handleScaleChange(newIndex: number) {
		scaleIndex = newIndex;
		const newScale = SCALE_STEPS[newIndex];
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

	// --- Selection capture ---

	/** Extract selected region from OLED canvas and convert to sprite bit-packed format */
	function captureSelection(): SpriteFrame | null {
		if (!hasSelection) return null;
		const w = selection.w;
		const h = selection.h;
		const bpr = bytesPerRow(w);
		const packed = new Uint8Array(bpr * h);

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const sx = selection.x + x;
				const sy = selection.y + y;
				// Read from OLED canvas (128-wide, bit-packed, MSB-first)
				if (sx >= 0 && sx < 128 && sy >= 0 && sy < 64) {
					const oledBpr = 128 / 8; // 16
					const srcByte = canvasPixels[sy * oledBpr + Math.floor(sx / 8)];
					const srcBit = 7 - (sx % 8);
					if (srcByte & (1 << srcBit)) {
						const dstByte = y * bpr + Math.floor(x / 8);
						const dstBit = 7 - (x % 8);
						packed[dstByte] |= 1 << dstBit;
					}
				}
			}
		}

		return {
			id: crypto.randomUUID(),
			pixels: spriteToBase64(packed),
			width: w,
			height: h
		};
	}

	async function addToExistingCollection(summary: SpriteCollectionSummary) {
		showAddMenu = false;
		const frame = captureSelection();
		if (!frame) {
			addToast(m.sprite_stamp_no_selection(), 'warning');
			return;
		}
		try {
			let full: SpriteCollection | null = null;
			for (const ws of settings.workspaces) {
				try {
					full = await readSpriteCollection(ws, summary.id);
					full.frames.push(frame);
					full.updatedAt = new Date().toISOString();
					await saveSpriteCollection(ws, full);
					break;
				} catch {
					continue;
				}
			}
			addToast(m.sprite_stamp_frame_added({ name: summary.name }), 'success');
			await loadCollections();
			// If we're viewing this collection, refresh it
			if (activeCollection && activeCollection.id === summary.id && full) {
				activeCollection = full;
			}
		} catch (e) {
			addToast(`Error: ${e}`, 'error');
		}
	}

	async function createNewPack() {
		showAddMenu = false;
		const frame = captureSelection();
		if (!frame) {
			addToast(m.sprite_stamp_no_selection(), 'warning');
			return;
		}
		const ws = settings.workspaces[0];
		if (!ws) return;
		const name = m.sprite_stamp_new_pack_name();
		const now = new Date().toISOString();
		const collection: SpriteCollection = {
			version: 1,
			id: crypto.randomUUID(),
			name,
			frames: [frame],
			createdAt: now,
			updatedAt: now
		};
		try {
			await saveSpriteCollection(ws, collection);
			addToast(m.sprite_stamp_pack_created({ name }), 'success');
			await loadCollections();
		} catch (e) {
			addToast(`Error: ${e}`, 'error');
		}
	}

	// --- Confirm dialog ---

	function showConfirm(title: string, message: string, action: () => void) {
		confirmTitle = title;
		confirmMessage = message;
		confirmAction = action;
		confirmOpen = true;
	}

	function handleConfirm() {
		confirmOpen = false;
		confirmAction?.();
		confirmAction = null;
	}

	function handleConfirmCancel() {
		confirmOpen = false;
		confirmAction = null;
	}

	function requestDeleteCollection(col: SpriteCollectionSummary) {
		showConfirm(
			m.sprite_stamp_delete_title(),
			m.sprite_stamp_delete_confirm({ name: col.name }),
			() => doDeleteCollection(col)
		);
	}

	async function doDeleteCollection(col: SpriteCollectionSummary) {
		try {
			for (const ws of settings.workspaces) {
				try {
					await deleteSpriteCollection(ws, col.id);
					break;
				} catch {
					continue;
				}
			}
			addToast(m.sprite_stamp_deleted({ name: col.name }), 'success');
			await loadCollections();
		} catch (e) {
			addToast(`Error: ${e}`, 'error');
		}
	}

	function requestDeleteFrame(index: number) {
		if (!activeCollection) return;
		showConfirm(
			m.sprite_stamp_delete_frame_title(),
			m.sprite_stamp_delete_frame_confirm({ index: index.toString(), name: activeCollection.name }),
			() => doDeleteFrame(index)
		);
	}

	async function doDeleteFrame(index: number) {
		if (!activeCollection) return;
		try {
			const updated = {
				...activeCollection,
				frames: activeCollection.frames.filter((_, i) => i !== index),
				updatedAt: new Date().toISOString()
			};
			for (const ws of settings.workspaces) {
				try {
					await saveSpriteCollection(ws, updated);
					break;
				} catch {
					continue;
				}
			}
			activeCollection = updated;
			if (selectedFrameIndex === index) {
				selectedFrameIndex = -1;
				onSelectFrame(null, 0, 0, 1);
			} else if (selectedFrameIndex > index) {
				selectedFrameIndex--;
			}
			addToast(m.sprite_stamp_frame_deleted(), 'success');
			if (updated.frames.length === 0) {
				activeCollection = null;
				await loadCollections();
			}
		} catch (e) {
			addToast(`Error: ${e}`, 'error');
		}
	}

	function startRename(col: SpriteCollectionSummary) {
		renamingId = col.id;
		renameValue = col.name;
	}

	async function commitRename(col: SpriteCollectionSummary) {
		const newName = renameValue.trim();
		renamingId = null;
		if (!newName || newName === col.name) return;
		try {
			for (const ws of settings.workspaces) {
				try {
					const full = await readSpriteCollection(ws, col.id);
					full.name = newName;
					full.updatedAt = new Date().toISOString();
					await saveSpriteCollection(ws, full);
					break;
				} catch {
					continue;
				}
			}
			await loadCollections();
		} catch (e) {
			addToast(`Error: ${e}`, 'error');
		}
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

<ConfirmDialog
	open={confirmOpen}
	title={confirmTitle}
	message={confirmMessage}
	confirmLabel={m.common_delete()}
	variant="danger"
	onconfirm={handleConfirm}
	oncancel={handleConfirmCancel}
/>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
		<h3 class="text-xs font-medium text-zinc-300">{m.sprite_stamp_title()}</h3>
		<div class="flex items-center gap-1">
			<!-- Add selection as frame -->
			<div class="relative">
				<button
					class="rounded px-1.5 py-0.5 text-[10px] transition-colors
						{hasSelection ? 'text-emerald-400 hover:bg-emerald-600/20' : 'text-zinc-600 cursor-not-allowed'}"
					onclick={() => { if (hasSelection) showAddMenu = !showAddMenu; }}
					disabled={!hasSelection}
					title={hasSelection ? m.sprite_stamp_add_frame() : m.sprite_stamp_no_selection()}
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
					</svg>
				</button>
				{#if showAddMenu}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-40"
						onclick={() => { showAddMenu = false; }}
					></div>
					<div class="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-lg">
						<button
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-emerald-400 hover:bg-zinc-700"
							onclick={createNewPack}
						>
							<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
							</svg>
							{m.sprite_stamp_new_pack()}
						</button>
						{#if collections.length > 0}
							<div class="my-1 border-t border-zinc-700"></div>
							<p class="px-3 py-1 text-[9px] uppercase text-zinc-500">{m.sprite_stamp_add_to()}</p>
							{#each collections as col}
								<button
									class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700"
									onclick={() => addToExistingCollection(col)}
								>
									<span class="truncate">{col.name}</span>
									<span class="shrink-0 text-[9px] text-zinc-600">{col.frame_count}</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
			<!-- Manage toggle -->
			<button
				class="rounded px-1.5 py-0.5 text-[10px] transition-colors
					{managing ? 'bg-amber-600/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}"
				onclick={() => { managing = !managing; renamingId = null; }}
				title={m.sprite_stamp_manage()}
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
					<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
				</svg>
			</button>
			<!-- Close -->
			<button
				class="text-zinc-500 hover:text-zinc-300"
				onclick={onClose}
			>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>
	</div>

	{#if activeCollection}
		<div class="border-b border-zinc-800 px-3 py-2">
			<label class="flex items-center gap-2 text-[10px] text-zinc-500">
				<span class="uppercase">{m.sprite_stamp_scale()}</span>
				<input
					type="range"
					min="0"
					max={SCALE_STEPS.length - 1}
					value={scaleIndex}
					oninput={(e) => handleScaleChange(parseInt(e.currentTarget.value))}
					class="w-20 accent-emerald-600"
				/>
				<span>{scale}x</span>
			</label>
			{#if selectedFrameIndex >= 0}
				{@const frame = activeCollection.frames[selectedFrameIndex]}
				<span class="mt-1 block text-[9px] text-zinc-600">
					{Math.max(1, Math.round(frame.width * scale))}×{Math.max(1, Math.round(frame.height * scale))}px
				</span>
			{/if}
		</div>
	{/if}

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
						<div class="group flex items-center rounded hover:bg-zinc-800">
							{#if renamingId === col.id}
								<form
									class="flex flex-1 items-center gap-1 px-2 py-1"
									onsubmit={(e) => { e.preventDefault(); commitRename(col); }}
								>
									<input
										type="text"
										bind:value={renameValue}
										class="flex-1 rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
										onblur={() => commitRename(col)}
										onkeydown={(e) => { if (e.key === 'Escape') { renamingId = null; } }}
									/>
								</form>
							{:else}
								<button
									class="flex flex-1 items-center justify-between px-2 py-1.5 text-left text-xs text-zinc-300"
									onclick={() => { if (!managing) selectCollection(col); }}
								>
									<div class="min-w-0">
										<span class="block truncate">{col.name}</span>
										<span class="text-[9px] text-zinc-600">
											{m.sprite_stamp_frames_info({
												count: col.frame_count.toString(),
												width: col.frame_width.toString(),
												height: col.frame_height.toString()
											})}
										</span>
									</div>
								</button>
								{#if managing}
									<button
										class="shrink-0 rounded p-1 text-zinc-600 hover:text-zinc-300"
										onclick={() => startRename(col)}
										title={m.sprite_stamp_rename()}
									>
										<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
											<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
										</svg>
									</button>
									<button
										class="shrink-0 rounded p-1 text-zinc-600 hover:text-red-400"
										onclick={() => requestDeleteCollection(col)}
										title={m.common_delete()}
									>
										<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
										</svg>
									</button>
								{/if}
							{/if}
						</div>
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
							managing = false;
							onSelectFrame(null, 0, 0, 1);
						}}
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
						</svg>
						{activeCollection.name}
					</button>

					<div class="flex flex-wrap gap-1">
						{#each activeCollection.frames as _, i}
							<div class="relative">
								<button
									class="rounded border p-0.5 transition-colors
										{selectedFrameIndex === i
											? 'border-emerald-600 bg-emerald-600/10'
											: 'border-zinc-700 hover:border-zinc-600'}"
									onclick={() => { if (!managing) selectFrame(i); }}
									style="image-rendering: pixelated"
								>
									<canvas class="stamp-frame-thumb block"></canvas>
								</button>
								{#if managing}
									<button
										class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-500"
										onclick={() => requestDeleteFrame(i)}
										title={m.common_delete()}
									>
										<svg class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
										</svg>
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
