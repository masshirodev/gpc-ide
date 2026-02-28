<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import SpriteCanvas from './SpriteCanvas.svelte';
	import {
		cloneSprite,
		invertSprite,
		createEmptySprite,
		base64ToSprite,
		spriteToBase64,
		totalBytes
	} from '$lib/utils/sprite-pixels';
	import type { SpriteFrame } from '$lib/types/sprite';

	type SpriteTool = 'pen' | 'eraser' | 'fill';

	interface Props {
		frames: SpriteFrame[];
		onDone: (frames: SpriteFrame[]) => void;
		onCancel: () => void;
	}

	let { frames: initialFrames, onDone, onCancel }: Props = $props();

	// Deep-copy frames so we can edit freely
	let editFrames = $state<SpriteFrame[]>(initialFrames.map((f) => ({ ...f })));
	let activeIndex = $state(0);
	let frameWidth = $derived(editFrames[activeIndex]?.width ?? 16);
	let frameHeight = $derived(editFrames[activeIndex]?.height ?? 16);

	// Pixels for the active frame
	let pixels = $state<Uint8Array>(new Uint8Array(0));
	let version = $state(0);

	// Tool state
	let tool = $state<SpriteTool>('pen');
	let brushSize = $state(1);

	// Undo/redo
	let undoStack = $state<Uint8Array[]>([]);
	let redoStack = $state<Uint8Array[]>([]);

	// Load pixels only when switching frames (activeIndex changes).
	// Uses untrack on editFrames to avoid re-triggering when frame content is saved back.
	$effect(() => {
		const idx = activeIndex;
		const frame = untrack(() => editFrames[idx]);
		if (frame) {
			const expectedBytes = totalBytes(frame.width, frame.height);
			const decoded = base64ToSprite(frame.pixels);
			if (decoded.length === expectedBytes) {
				pixels = decoded;
			} else {
				pixels = createEmptySprite(frame.width, frame.height);
			}
			undoStack = [];
			redoStack = [];
			version++;
		}
	});

	function saveCurrentPixelsToFrame() {
		const frame = editFrames[activeIndex];
		if (frame) {
			editFrames[activeIndex] = { ...frame, pixels: spriteToBase64(pixels) };
		}
	}

	function handleBeforeDraw() {
		undoStack = [...undoStack.slice(-99), cloneSprite(pixels)];
		redoStack = [];
	}

	function handleDraw(updated: Uint8Array) {
		pixels = updated;
		version++;
		saveCurrentPixelsToFrame();
	}

	function undo() {
		if (undoStack.length === 0) return;
		redoStack = [...redoStack, cloneSprite(pixels)];
		const prev = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		pixels = prev;
		version++;
		saveCurrentPixelsToFrame();
	}

	function redo() {
		if (redoStack.length === 0) return;
		undoStack = [...undoStack, cloneSprite(pixels)];
		const next = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);
		pixels = next;
		version++;
		saveCurrentPixelsToFrame();
	}

	function clearFrame() {
		handleBeforeDraw();
		pixels = createEmptySprite(frameWidth, frameHeight);
		version++;
		saveCurrentPixelsToFrame();
	}

	function invertFrame() {
		handleBeforeDraw();
		pixels = invertSprite(pixels);
		version++;
		saveCurrentPixelsToFrame();
	}

	function selectFrame(i: number) {
		saveCurrentPixelsToFrame();
		activeIndex = i;
	}

	function handleDone() {
		saveCurrentPixelsToFrame();
		onDone(editFrames);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === 'z') {
			e.preventDefault();
			undo();
		} else if (e.ctrlKey && e.key === 'y') {
			e.preventDefault();
			redo();
		} else if (e.key === 'p' || e.key === 'P') {
			tool = 'pen';
		} else if (e.key === 'e' || e.key === 'E') {
			tool = 'eraser';
		} else if (e.key === 'g' || e.key === 'G') {
			tool = 'fill';
		} else if (e.key === '[') {
			brushSize = Math.max(1, brushSize - 1);
		} else if (e.key === ']') {
			brushSize = Math.min(16, brushSize + 1);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col bg-zinc-950">
	<!-- Toolbar -->
	<div class="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
		<span class="text-xs font-medium text-zinc-400">{m.sprite_editor_title()}</span>
		<span class="text-[10px] text-zinc-600">{frameWidth}x{frameHeight}</span>

		<div class="mx-2 h-4 w-px bg-zinc-800"></div>

		<!-- Tools -->
		{#each [
			{ id: 'pen', label: m.sprite_editor_pen(), key: 'P', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
			{ id: 'eraser', label: m.sprite_editor_eraser(), key: 'E', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
			{ id: 'fill', label: m.sprite_editor_fill(), key: 'G', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12V9' }
		] as t}
			<button
				class="rounded px-2 py-1 text-xs transition-colors
					{tool === t.id ? 'bg-emerald-600/20 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
				onclick={() => { tool = t.id as SpriteTool; }}
				title="{t.label} ({t.key})"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d={t.icon} />
				</svg>
			</button>
		{/each}

		<div class="mx-1 h-4 w-px bg-zinc-800"></div>

		<!-- Brush size -->
		<label class="flex items-center gap-1 text-[10px] text-zinc-500">
			<input
				type="range"
				min="1"
				max="16"
				bind:value={brushSize}
				class="w-16 accent-emerald-600"
			/>
			{brushSize}px
		</label>

		<div class="mx-1 h-4 w-px bg-zinc-800"></div>

		<!-- Actions -->
		<button
			class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
			onclick={clearFrame}
		>{m.sprite_editor_clear()}</button>
		<button
			class="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
			onclick={invertFrame}
		>{m.sprite_editor_invert()}</button>

		<button
			class="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
			onclick={undo}
			disabled={undoStack.length === 0}
			title="Undo (Ctrl+Z)"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5" /></svg>
		</button>
		<button
			class="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
			onclick={redo}
			disabled={redoStack.length === 0}
			title="Redo (Ctrl+Y)"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5" /></svg>
		</button>

		<!-- Spacer -->
		<div class="flex-1"></div>

		<button
			class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
			onclick={onCancel}
		>{m.common_cancel()}</button>
		<button
			class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
			onclick={handleDone}
		>{m.sprite_editor_done()}</button>
	</div>

	<!-- Canvas -->
	<div class="min-h-0 flex-1">
		{#if pixels.length > 0}
			<SpriteCanvas
				{pixels}
				width={frameWidth}
				height={frameHeight}
				{tool}
				{brushSize}
				{version}
				onBeforeDraw={handleBeforeDraw}
				onDraw={handleDraw}
			/>
		{/if}
	</div>

	<!-- Frame strip -->
	{#if editFrames.length > 1}
		<div class="flex items-center gap-1 border-t border-zinc-800 px-3 py-2 overflow-x-auto">
			<span class="mr-2 shrink-0 text-[10px] text-zinc-500">
				{m.sprite_editor_frame()} {activeIndex + 1} {m.sprite_editor_of()} {editFrames.length}
			</span>
			{#each editFrames as _, i}
				<button
					class="shrink-0 rounded border px-2 py-0.5 text-[10px] transition-colors
						{i === activeIndex
							? 'border-emerald-600 bg-emerald-600/20 text-emerald-400'
							: 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}"
					onclick={() => selectFrame(i)}
				>
					#{i}
				</button>
			{/each}
		</div>
	{/if}
</div>
