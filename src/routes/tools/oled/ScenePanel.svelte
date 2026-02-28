<script lang="ts">
	import { OLED_WIDTH, OLED_HEIGHT, type OledScene } from './types';
	import { getPixel } from './pixels';

	interface Props {
		scenes: OledScene[];
		activeSceneId: string;
		onSelect: (id: string) => void;
		onAdd: () => void;
		onDuplicate: (id: string) => void;
		onDelete: (id: string) => void;
		onRename: (id: string, name: string) => void;
		onReorder: (fromIndex: number, toIndex: number) => void;
	}

	let { scenes, activeSceneId, onSelect, onAdd, onDuplicate, onDelete, onRename, onReorder }: Props = $props();

	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let dragIndex = $state(-1);
	let dragOverIndex = $state(-1);

	const THUMB_W = 64;
	const THUMB_H = 32;

	function thumbAction(canvasEl: HTMLCanvasElement, scene: OledScene) {
		function render(s: OledScene) {
			const ctx = canvasEl.getContext('2d');
			if (!ctx) return;
			ctx.fillStyle = '#000000';
			ctx.fillRect(0, 0, THUMB_W, THUMB_H);

			const sx = THUMB_W / OLED_WIDTH;
			const sy = THUMB_H / OLED_HEIGHT;

			ctx.fillStyle = '#e4e4e7';
			for (let y = 0; y < OLED_HEIGHT; y++) {
				for (let x = 0; x < OLED_WIDTH; x++) {
					if (getPixel(s.pixels, x, y)) {
						ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
					}
				}
			}
		}

		render(scene);

		return {
			update(newScene: OledScene) {
				render(newScene);
			}
		};
	}

	function startRename(id: string, name: string) {
		editingId = id;
		editingName = name;
	}

	function finishRename() {
		if (editingId && editingName.trim()) {
			onRename(editingId, editingName.trim());
		}
		editingId = null;
	}

	function handleDragStart(e: DragEvent, index: number) {
		dragIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragIndex >= 0 && dragIndex !== index) {
			onReorder(dragIndex, index);
		}
		dragIndex = -1;
		dragOverIndex = -1;
	}

	function handleDragEnd() {
		dragIndex = -1;
		dragOverIndex = -1;
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Scenes</h3>
		<button
			class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400"
			onclick={onAdd}
			title="Add Scene"
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
			</svg>
		</button>
	</div>

	<div class="scrollbar-none max-h-64 space-y-1 overflow-y-auto">
		{#each scenes as scene, i}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left transition-colors
					{activeSceneId === scene.id
						? 'bg-emerald-600/20 text-emerald-400'
						: 'text-zinc-300 hover:bg-zinc-800'}
					{dragOverIndex === i && dragIndex !== i ? 'border-t-2 border-emerald-500' : ''}"
				onclick={() => onSelect(scene.id)}
				onkeydown={(e) => { if (e.key === 'Enter') onSelect(scene.id); }}
				role="button"
				tabindex="0"
				draggable={true}
				ondragstart={(e) => handleDragStart(e, i)}
				ondragover={(e) => handleDragOver(e, i)}
				ondrop={(e) => handleDrop(e, i)}
				ondragend={handleDragEnd}
			>
				<canvas
					width={THUMB_W}
					height={THUMB_H}
					class="rounded border border-zinc-700 shrink-0"
					use:thumbAction={scene}
				></canvas>
				<div class="min-w-0 flex-1">
					{#if editingId === scene.id}
						<input
							type="text"
							bind:value={editingName}
							class="w-full rounded border border-zinc-600 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200 focus:border-emerald-600 focus:outline-none"
							onblur={finishRename}
							onkeydown={(e) => {
								if (e.key === 'Enter') finishRename();
								if (e.key === 'Escape') { editingId = null; }
							}}
						/>
					{:else}
						<span
							class="block truncate text-xs"
							ondblclick={() => startRename(scene.id, scene.name)}
						>
							{scene.name}
						</span>
					{/if}
				</div>
				<div class="flex shrink-0 gap-0.5">
					<button
						class="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
						onclick={(e) => { e.stopPropagation(); onDuplicate(scene.id); }}
						title="Duplicate"
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" /></svg>
					</button>
					{#if scenes.length > 1}
						<button
							class="rounded p-0.5 text-zinc-500 hover:text-red-400"
							onclick={(e) => { e.stopPropagation(); onDelete(scene.id); }}
							title="Delete"
						>
							<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
