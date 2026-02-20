<script lang="ts">
	import type { OledScene, AnimationConfig } from './types';
	import { exportAnimation } from './export';
	import { addToast } from '$lib/stores/toast.svelte';

	interface SequenceEntry {
		sceneId: string;
		durationMs: number;
		transition: 'cut' | 'fade';
	}

	interface Props {
		scenes: OledScene[];
		animation: AnimationConfig;
		onClose: () => void;
	}

	let { scenes, animation, onClose }: Props = $props();

	let sequence = $state<SequenceEntry[]>(
		scenes.map((s) => ({
			sceneId: s.id,
			durationMs: animation.frameDelayMs,
			transition: 'cut' as const,
		}))
	);

	let playbackFrame = $state(-1);
	let playbackTimer = $state<ReturnType<typeof setInterval> | null>(null);

	function addEntry() {
		if (scenes.length === 0) return;
		sequence = [
			...sequence,
			{
				sceneId: scenes[0].id,
				durationMs: 500,
				transition: 'cut',
			},
		];
	}

	function removeEntry(index: number) {
		sequence = sequence.filter((_, i) => i !== index);
	}

	function moveEntry(index: number, direction: -1 | 1) {
		const newIdx = index + direction;
		if (newIdx < 0 || newIdx >= sequence.length) return;
		const updated = [...sequence];
		[updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
		sequence = updated;
	}

	function updateEntry(index: number, updates: Partial<SequenceEntry>) {
		sequence = sequence.map((e, i) => (i === index ? { ...e, ...updates } : e));
	}

	function getSceneName(sceneId: string): string {
		return scenes.find((s) => s.id === sceneId)?.name || 'Unknown';
	}

	// Preview playback
	function startPlayback() {
		stopPlayback();
		if (sequence.length === 0) return;
		playbackFrame = 0;
		scheduleNextFrame();
	}

	function scheduleNextFrame() {
		if (playbackFrame < 0 || playbackFrame >= sequence.length) {
			stopPlayback();
			return;
		}
		const entry = sequence[playbackFrame];
		playbackTimer = setTimeout(() => {
			playbackFrame++;
			if (playbackFrame >= sequence.length) {
				playbackFrame = 0; // Loop
			}
			scheduleNextFrame();
		}, entry.durationMs);
	}

	function stopPlayback() {
		if (playbackTimer) {
			clearTimeout(playbackTimer);
			playbackTimer = null;
		}
		playbackFrame = -1;
	}

	let previewScene = $derived.by(() => {
		if (playbackFrame >= 0 && playbackFrame < sequence.length) {
			const entry = sequence[playbackFrame];
			return scenes.find((s) => s.id === entry.sceneId);
		}
		return null;
	});

	let previewCanvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!previewCanvas) return;
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 256, 128);

		if (previewScene) {
			for (let y = 0; y < 64; y++) {
				for (let x = 0; x < 128; x++) {
					const byteIdx = y * 16 + Math.floor(x / 8);
					const bitIdx = 7 - (x % 8);
					if (previewScene.pixels[byteIdx] & (1 << bitIdx)) {
						ctx.fillStyle = '#fff';
						ctx.fillRect(x * 2, y * 2, 2, 2);
					}
				}
			}
		}
	});

	function handleExportSequence() {
		// Build ordered scene list from sequence
		const orderedScenes: OledScene[] = [];
		for (const entry of sequence) {
			const scene = scenes.find((s) => s.id === entry.sceneId);
			if (scene) orderedScenes.push(scene);
		}

		if (orderedScenes.length === 0) {
			addToast('No scenes in sequence', 'warning');
			return;
		}

		// Use average duration as frame delay
		const avgDelay =
			sequence.reduce((sum, e) => sum + e.durationMs, 0) / sequence.length;

		const code = exportAnimation(orderedScenes, 'array_8bit', Math.round(avgDelay));
		navigator.clipboard.writeText(code);
		addToast('Sequencer GPC code copied to clipboard', 'success');
	}

	let totalDuration = $derived(
		sequence.reduce((sum, e) => sum + e.durationMs, 0)
	);
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
		<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Sequencer</h3>
		<button class="text-xs text-zinc-400 hover:text-zinc-200" onclick={onClose}>
			Close
		</button>
	</div>

	<!-- Timeline -->
	<div class="flex-1 overflow-y-auto p-3">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs text-zinc-500">
				{sequence.length} entries, {(totalDuration / 1000).toFixed(1)}s total
			</span>
			<button
				class="rounded px-2 py-0.5 text-xs text-emerald-400 hover:bg-zinc-800"
				onclick={addEntry}
			>
				+ Add
			</button>
		</div>

		<div class="space-y-1">
			{#each sequence as entry, i}
				<div
					class="flex items-center gap-2 rounded border px-2 py-1.5 {playbackFrame === i
						? 'border-emerald-600 bg-emerald-950'
						: 'border-zinc-800 bg-zinc-900'}"
				>
					<span class="w-5 text-center text-xs text-zinc-600">{i + 1}</span>

					<select
						class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200"
						value={entry.sceneId}
						onchange={(e) =>
							updateEntry(i, {
								sceneId: (e.target as HTMLSelectElement).value,
							})}
					>
						{#each scenes as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>

					<input
						type="number"
						class="w-16 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200"
						value={entry.durationMs}
						min="50"
						max="10000"
						step="50"
						oninput={(e) =>
							updateEntry(i, {
								durationMs: parseInt((e.target as HTMLInputElement).value) || 500,
							})}
					/>
					<span class="text-xs text-zinc-600">ms</span>

					<div class="flex gap-0.5">
						<button
							class="text-zinc-500 hover:text-zinc-300"
							onclick={() => moveEntry(i, -1)}
							disabled={i === 0}
						>
							<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
							</svg>
						</button>
						<button
							class="text-zinc-500 hover:text-zinc-300"
							onclick={() => moveEntry(i, 1)}
							disabled={i === sequence.length - 1}
						>
							<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
						<button
							class="text-zinc-500 hover:text-red-400"
							onclick={() => removeEntry(i)}
						>
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Preview -->
	<div class="border-t border-zinc-800 p-3">
		<canvas
			bind:this={previewCanvas}
			width="256"
			height="128"
			class="mb-2 w-full rounded border border-zinc-700 bg-black"
		></canvas>

		<div class="flex gap-2">
			{#if playbackTimer}
				<button
					class="flex-1 rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200"
					onclick={stopPlayback}
				>
					Stop
				</button>
			{:else}
				<button
					class="flex-1 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500"
					onclick={startPlayback}
					disabled={sequence.length === 0}
				>
					Play
				</button>
			{/if}
			<button
				class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
				onclick={handleExportSequence}
				disabled={sequence.length === 0}
			>
				Export GPC
			</button>
		</div>
	</div>
</div>
