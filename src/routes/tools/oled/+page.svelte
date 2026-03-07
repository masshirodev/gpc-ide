<script lang="ts">
	import OledCanvas from './OledCanvas.svelte';
	import ToolPanel from './ToolPanel.svelte';
	import ScenePanel from './ScenePanel.svelte';
	import PreviewPanel from './PreviewPanel.svelte';
	import ExportPanel from './ExportPanel.svelte';
	import ImportModal from './ImportModal.svelte';
	import AnimationPresetsModal from './AnimationPresetsModal.svelte';
	import FontEditor from './FontEditor.svelte';
	import SequencerPanel from './SequencerPanel.svelte';
	import CodeRunnerModal from './CodeRunnerModal.svelte';
	import SpriteStampPanel from './SpriteStampPanel.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getFlowOledTransfer, setFlowOledTransfer, clearFlowOledTransfer } from '$lib/stores/flow-transfer.svelte';
	import { goto } from '$app/navigation';
	import { PixelHistory } from './history';
	import { shiftPixels, drawText } from './drawing';
	import { createEmptyPixels, clonePixels, invertPixels, pixelsToBase64, base64ToPixels, getPixel } from './pixels';
	import { bytesPerRow } from '$lib/utils/sprite-pixels';
	import { getFont } from './fonts';
	import { OLED_WIDTH, OLED_HEIGHT, type OledScene, type DrawTool, type BrushShape, type AnimationConfig, type OledProject, type TextState } from './types';
	import { writeFile, readFile } from '$lib/tauri/commands';

	// --- Flow editor transfer ---
	const flowTransfer = getFlowOledTransfer();
	let isFlowMode = $state(!!flowTransfer);

	// --- State ---
	const initialId: string = flowTransfer?.scene?.id || (crypto.randomUUID() as string);
	const initialPixels: Uint8Array = flowTransfer?.scene?.pixels
		? base64ToPixels(flowTransfer.scene.pixels)
		: createEmptyPixels();
	let scenes = $state<OledScene[]>([
		{
			id: initialId,
			name: flowTransfer?.scene?.name || 'Scene 1',
			pixels: initialPixels
		}
	]);
	let activeSceneId = $state<string>(initialId);
	let tool = $state<DrawTool>('pen');
	let brush = $state<BrushShape>({ type: 'square', width: 1, height: 1 });
	let shapeFilled = $state(true);
	let animationConfig = $state<AnimationConfig>({ frameDelayMs: 500, loop: true });
	let textState = $state<TextState>({ text: '', fontSize: '5x7', align: 'left', originX: -1, originY: -1 });
	let showImport = $state(false);
	let showExport = $state(false);
	let showPresets = $state(false);
	let showFontEditor = $state(false);
	let showSequencer = $state(false);
	let showCodeRunner = $state(false);
	let showStamps = $state(false);
	let stampData = $state<{ pixels: Uint8Array; width: number; height: number; scale: number } | null>(null);
	let importStampActive = $state(false);
	let importStampBase = $state<{ pixels: Uint8Array; width: number; height: number } | null>(null);
	let pixelVersion = $state(0);

	// Per-scene history
	let historyMap = $state<Map<string, PixelHistory>>(new Map());

	function getHistory(sceneId: string): PixelHistory {
		let h = historyMap.get(sceneId);
		if (!h) {
			h = new PixelHistory();
			historyMap.set(sceneId, h);
		}
		return h;
	}

	let activeScene = $derived(scenes.find((s) => s.id === activeSceneId) || scenes[0]);

	// --- Scene CRUD ---
	function addScene() {
		const scene: OledScene = {
			id: crypto.randomUUID() as string,
			name: `Scene ${scenes.length + 1}`,
			pixels: createEmptyPixels()
		};
		scenes = [...scenes, scene];
		activeSceneId = scene.id;
	}

	function duplicateScene(id: string) {
		const src = scenes.find((s) => s.id === id);
		if (!src) return;
		const idx = scenes.indexOf(src);
		const dup: OledScene = {
			id: crypto.randomUUID() as string,
			name: `${src.name} Copy`,
			pixels: clonePixels(src.pixels)
		};
		scenes = [...scenes.slice(0, idx + 1), dup, ...scenes.slice(idx + 1)];
		activeSceneId = dup.id;
	}

	function deleteScene(id: string) {
		if (scenes.length <= 1) return;
		const idx = scenes.findIndex((s) => s.id === id);
		scenes = scenes.filter((s) => s.id !== id);
		historyMap.delete(id);
		if (activeSceneId === id) {
			activeSceneId = scenes[Math.min(idx, scenes.length - 1)].id;
		}
	}

	function renameScene(id: string, name: string) {
		scenes = scenes.map((s) => (s.id === id ? { ...s, name } : s));
	}

	function reorderScene(fromIndex: number, toIndex: number) {
		const updated = [...scenes];
		const [moved] = updated.splice(fromIndex, 1);
		updated.splice(toIndex, 0, moved);
		scenes = updated;
	}

	// --- Drawing callbacks ---
	function handleBeforeDraw() {
		getHistory(activeSceneId).push(activeScene.pixels);
	}

	function handleDraw(newPixels: Uint8Array) {
		scenes = scenes.map((s) =>
			s.id === activeSceneId ? { ...s, pixels: newPixels } : s
		);
		pixelVersion++;
	}

	// --- Canvas actions ---
	function handleClear() {
		handleBeforeDraw();
		handleDraw(createEmptyPixels());
	}

	function handleInvert() {
		handleBeforeDraw();
		handleDraw(invertPixels(activeScene.pixels));
	}

	function handleShift(dx: number, dy: number) {
		handleBeforeDraw();
		handleDraw(shiftPixels(activeScene.pixels, dx, dy));
	}

	// --- Undo/Redo ---
	function undo() {
		const h = getHistory(activeSceneId);
		const prev = h.undo(activeScene.pixels);
		if (prev) {
			handleDraw(prev);
		}
	}

	function redo() {
		const h = getHistory(activeSceneId);
		const next = h.redo(activeScene.pixels);
		if (next) {
			handleDraw(next);
		}
	}

	// --- Import ---
	function oledPixelsToStamp(pixels: Uint8Array): { pixels: Uint8Array; width: number; height: number } | null {
		let minX = OLED_WIDTH, minY = OLED_HEIGHT, maxX = -1, maxY = -1;
		for (let y = 0; y < OLED_HEIGHT; y++) {
			for (let x = 0; x < OLED_WIDTH; x++) {
				if (getPixel(pixels, x, y)) {
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			}
		}
		if (maxX < 0) return null;

		const w = maxX - minX + 1;
		const h = maxY - minY + 1;
		const bpr = bytesPerRow(w);
		const spritePixels = new Uint8Array(bpr * h);

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (getPixel(pixels, minX + x, minY + y)) {
					const byteIdx = y * bpr + Math.floor(x / 8);
					const bitIdx = 7 - (x % 8);
					spritePixels[byteIdx] |= 1 << bitIdx;
				}
			}
		}
		return { pixels: spritePixels, width: w, height: h };
	}

	function handleImportApply(pixels: Uint8Array) {
		showImport = false;
		const stamp = oledPixelsToStamp(pixels);
		if (!stamp) {
			addToast('No visible pixels in imported image', 'warning', 2000);
			return;
		}
		importStampBase = stamp;
		importStampActive = true;
		stampData = { ...stamp, scale: 1 };
		showStamps = false;
		addToast('Click on canvas to place, Escape to cancel', 'info', 3000);
	}

	function handleImportStampScale(newScale: number) {
		if (!importStampBase) return;
		stampData = { ...importStampBase, scale: newScale };
	}

	function handleImportStampPlaced() {
		if (!importStampActive) return;
		importStampActive = false;
		importStampBase = null;
		stampData = null;
	}

	function cancelImportStamp() {
		importStampActive = false;
		importStampBase = null;
		stampData = null;
	}

	// --- Text tool ---
	function handleTextOriginSet(x: number, y: number) {
		textState = { ...textState, originX: x, originY: y };
	}

	function handleTextChange(state: TextState) {
		textState = state;
	}

	function handleTextApply() {
		if (!textState.text || textState.originX < 0) return;
		handleBeforeDraw();
		const font = getFont(textState.fontSize);
		const updated = clonePixels(activeScene.pixels);
		drawText(updated, textState.text, textState.originX, textState.originY, font, true, textState.align);
		handleDraw(updated);
		textState = { ...textState, text: '', originX: -1, originY: -1 };
	}

	// --- Save / Load ---
	async function handleSave() {
		try {
			const { save } = await import('@tauri-apps/plugin-dialog');
			let path = await save({
				filters: [{ name: 'OLED Project', extensions: ['oled.json'] }]
			});
			if (!path) return;
			if (!path.endsWith('.oled.json')) path += '.oled.json';

			const project: OledProject = {
				version: 1,
				scenes: scenes.map((s) => ({
					id: s.id,
					name: s.name,
					pixels: pixelsToBase64(s.pixels)
				})),
				activeSceneId,
				animation: animationConfig
			};
			await writeFile(path, JSON.stringify(project, null, 2));
			addToast('Project saved', 'success', 2000);
		} catch (e) {
			addToast(`Save failed: ${e}`, 'error');
		}
	}

	async function handleLoad() {
		try {
			const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
			const path = await openDialog({
				filters: [{ name: 'OLED Project', extensions: ['oled.json'] }]
			});
			if (!path) return;

			const content = await readFile(path as string);
			const project: OledProject = JSON.parse(content);

			scenes = project.scenes.map((s) => ({
				id: s.id,
				name: s.name,
				pixels: base64ToPixels(s.pixels)
			}));
			activeSceneId = project.activeSceneId;
			animationConfig = project.animation;
			historyMap = new Map();
			pixelVersion++;
			addToast('Project loaded', 'success', 2000);
		} catch (e) {
			addToast(`Load failed: ${e}`, 'error');
		}
	}

	// --- Animation presets ---
	function handleInsertPresetScenes(newScenes: import('./types').OledScene[]) {
		scenes = [...scenes, ...newScenes];
		activeSceneId = newScenes[0].id;
		pixelVersion++;
		showPresets = false;
		addToast(`Inserted ${newScenes.length} animation scenes`, 'success', 2000);
	}

	// --- Keyboard shortcuts ---
	function handleKeydown(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;

		if (e.key === 'Escape' && importStampActive) {
			e.preventDefault();
			cancelImportStamp();
			return;
		}

		if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		} else if (e.ctrlKey && (e.key === 'Z' || e.key === 'y')) {
			e.preventDefault();
			redo();
		} else if (e.ctrlKey && e.key === 's') {
			e.preventDefault();
			handleSave();
		} else if (e.ctrlKey && e.key === 'i') {
			e.preventDefault();
			handleInvert();
		} else if (e.key === 'Delete') {
			handleClear();
		} else if (!e.ctrlKey && !e.altKey) {
			switch (e.key.toLowerCase()) {
				case 'p': tool = 'pen'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case 'e': tool = 'eraser'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case 'l': tool = 'line'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case 'r': tool = 'rect'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case 'o': tool = 'ellipse'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case 'g': tool = 'fill'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case 't': tool = 'text'; break;
				case 'm': tool = 'move'; textState = { ...textState, originX: -1, originY: -1 }; break;
				case '[':
					brush = { ...brush, width: Math.max(1, brush.width - 1), height: Math.max(1, brush.height - 1) };
					break;
				case ']':
					brush = { ...brush, width: Math.min(32, brush.width + 1), height: Math.min(32, brush.height + 1) };
					break;
				case 'arrowleft': e.preventDefault(); handleShift(-1, 0); break;
				case 'arrowright': e.preventDefault(); handleShift(1, 0); break;
				case 'arrowup': e.preventDefault(); handleShift(0, -1); break;
				case 'arrowdown': e.preventDefault(); handleShift(0, 1); break;
			}
		}
	}

	// --- Send back to flow editor ---
	function handleSendToFlow() {
		if (!flowTransfer) return;
		const pixelData = pixelsToBase64(activeScene.pixels);
		setFlowOledTransfer({
			...flowTransfer,
			scene: {
				id: activeScene.id,
				name: activeScene.name,
				pixels: pixelData,
			},
		});
		goto(flowTransfer.returnPath ?? '/tools/flow');
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col bg-zinc-950">
	<!-- Header -->
	<div class="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
		{#if isFlowMode}
			<button
				class="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500"
				onclick={handleSendToFlow}
			>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
				</svg>
				Send to Flow Editor
			</button>
		{:else}
			<a
				href="/"
				class="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
			>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
				</svg>
				Back
			</a>
		{/if}

		<h1 class="text-lg font-semibold text-zinc-100">OLED Creator</h1>

		<div class="ml-auto flex items-center gap-2">
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={handleLoad}
			>
				Open
			</button>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={handleSave}
			>
				Save
			</button>
			<button
				class="rounded px-3 py-1 text-xs {showExport
					? 'bg-emerald-600/20 text-emerald-400'
					: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
				onclick={() => { showExport = !showExport; if (showExport) { showSequencer = false; showStamps = false; stampData = null; } }}
			>
				Export
			</button>
			<span class="mx-1 text-zinc-700">|</span>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={() => (showPresets = true)}
			>
				Presets
			</button>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={() => (showFontEditor = true)}
			>
				Fonts
			</button>
			<button
				class="rounded px-3 py-1 text-xs {showSequencer
					? 'bg-emerald-600/20 text-emerald-400'
					: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
				onclick={() => { showSequencer = !showSequencer; if (showSequencer) { showExport = false; showStamps = false; stampData = null; } }}
			>
				Sequencer
			</button>
			<button
				class="rounded px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				onclick={() => (showCodeRunner = true)}
			>
				Code
			</button>
			<button
				class="rounded px-3 py-1 text-xs {showStamps
					? 'bg-emerald-600/20 text-emerald-400'
					: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
				onclick={() => {
					showStamps = !showStamps;
					if (showStamps) { showExport = false; showSequencer = false; cancelImportStamp(); }
					if (!showStamps) { stampData = null; }
				}}
			>
				Stamps
			</button>
		</div>

		<div class="flex items-center gap-2 text-xs text-zinc-600">
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">P</kbd> pen
			</span>
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">E</kbd> eraser
			</span>
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">T</kbd> text
			</span>
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">M</kbd> move
			</span>
			<span>
				<kbd class="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Ctrl+Z</kbd> undo
			</span>
		</div>
	</div>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left sidebar -->
		<div class="scrollbar-none flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-800 p-3">
			<ToolPanel
				{tool}
				{brush}
				filled={shapeFilled}
				{textState}
				onToolChange={(t) => {
					if (t !== 'text') textState = { ...textState, originX: -1, originY: -1 };
					tool = t;
				}}
				onBrushChange={(b) => (brush = b)}
				onFilledChange={(f) => (shapeFilled = f)}
				onTextChange={handleTextChange}
				onTextApply={handleTextApply}
				onClear={handleClear}
				onInvert={handleInvert}
				onShift={handleShift}
				onImport={() => (showImport = true)}
			/>

			<ScenePanel
				{scenes}
				{activeSceneId}
				onSelect={(id) => (activeSceneId = id)}
				onAdd={addScene}
				onDuplicate={duplicateScene}
				onDelete={deleteScene}
				onRename={renameScene}
				onReorder={reorderScene}
			/>

			<PreviewPanel
				{scenes}
				{activeSceneId}
				animation={animationConfig}
				onAnimationChange={(c) => (animationConfig = c)}
			/>
		</div>

		<!-- Main canvas area -->
		<div class="relative flex flex-1 overflow-hidden">
			<div class="flex-1">
				<OledCanvas
					pixels={activeScene.pixels}
					{tool}
					{brush}
					filled={shapeFilled}
					version={pixelVersion}
					{textState}
					{stampData}
					onBeforeDraw={handleBeforeDraw}
					onDraw={handleDraw}
					onTextOriginSet={handleTextOriginSet}
					onStampPlaced={importStampActive ? handleImportStampPlaced : undefined}
				/>

				{#if importStampActive && importStampBase}
					<div class="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/95 px-4 py-2 shadow-xl backdrop-blur-sm">
						<span class="text-xs text-zinc-400">Scale</span>
						<input
							type="range"
							min="1"
							max="4"
							value={stampData?.scale ?? 1}
							oninput={(e) => handleImportStampScale(parseInt(e.currentTarget.value))}
							class="w-20 accent-emerald-600"
						/>
						<span class="w-5 text-xs text-zinc-300">{stampData?.scale ?? 1}x</span>
						<span class="mx-1 text-zinc-700">|</span>
						<span class="text-xs text-zinc-500">{importStampBase.width}×{importStampBase.height}px</span>
						<span class="mx-1 text-zinc-700">|</span>
						<button
							class="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
							onclick={cancelImportStamp}
						>
							Cancel
						</button>
					</div>
				{/if}
			</div>

			<!-- Right sidebar panels (overlay so they don't push canvas off-screen) -->
			{#if showExport}
				<div class="scrollbar-none absolute top-0 right-0 z-10 h-full w-80 overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-3">
					<ExportPanel
						{scenes}
						{activeSceneId}
						animation={animationConfig}
					/>
				</div>
			{:else if showSequencer}
				<div class="absolute top-0 right-0 z-10 h-full w-80 border-l border-zinc-800 bg-zinc-950">
					<SequencerPanel
						{scenes}
						animation={animationConfig}
						onClose={() => (showSequencer = false)}
					/>
				</div>
			{:else if showStamps}
				<div class="absolute top-0 right-0 z-10 h-full w-72 border-l border-zinc-800 bg-zinc-950">
					<SpriteStampPanel
						onStamp={(spritePixels, width, height, scale) => {
							// Stamp is handled via stampData + canvas click
						}}
						onSelectFrame={(spritePixels, width, height, scale) => {
							if (spritePixels) {
								stampData = { pixels: spritePixels, width, height, scale };
							} else {
								stampData = null;
							}
						}}
						onClose={() => { showStamps = false; stampData = null; }}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>

<ImportModal
	open={showImport}
	onApply={handleImportApply}
	onCancel={() => (showImport = false)}
/>

<AnimationPresetsModal
	open={showPresets}
	onInsert={handleInsertPresetScenes}
	onCancel={() => (showPresets = false)}
/>

<FontEditor
	open={showFontEditor}
	onClose={() => (showFontEditor = false)}
/>

<CodeRunnerModal
	open={showCodeRunner}
	currentPixels={activeScene.pixels}
	onApply={(pixels) => {
		handleBeforeDraw();
		handleDraw(pixels);
		showCodeRunner = false;
		addToast('Code applied to canvas', 'success', 2000);
	}}
	onCancel={() => (showCodeRunner = false)}
/>
