<script lang="ts">
	import { tick } from 'svelte';
	import { OLED_WIDTH, OLED_HEIGHT } from './types';
	import { clonePixels } from './pixels';
	import { evaluate } from './interpreter/evaluator';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';

	interface Props {
		open: boolean;
		onApply: (pixels: Uint8Array) => void;
		onCancel: () => void;
		currentPixels: Uint8Array;
	}

	let { open, onApply, onCancel, currentPixels }: Props = $props();

	let previewCanvas = $state<HTMLCanvasElement>(null!);
	let code = $state(localStorage.getItem('oled-code-runner') || defaultCode());
	let error = $state<{ message: string; line: number } | null>(null);
	let resultPixels = $state<Uint8Array | null>(null);
	let mode = $state<'blank' | 'current'>('blank');

	function defaultCode(): string {
		return `// Draw on the 128x64 OLED display
// Available functions:
//   cls_oled(color)
//   pixel_oled(x, y, color)
//   line_oled(x, y, tox, toy, thickness, color)
//   rect_oled(x, y, w, h, fill, color)
//   circle_oled(x, y, r, fill, color)
//   puts_oled(x, y, font, "text", color)
// Constants: OLED_BLACK, OLED_WHITE
// Fonts: OLED_FONT_SMALL, OLED_FONT_MEDIUM, OLED_FONT_LARGE

cls_oled(OLED_BLACK);
rect_oled(0, 0, 128, 64, 0, OLED_WHITE);
puts_oled(30, 28, OLED_FONT_MEDIUM, "Hello!", OLED_WHITE);
`;
	}

	function runCode() {
		// Save code to localStorage
		localStorage.setItem('oled-code-runner', code);

		const base = mode === 'current' ? clonePixels(currentPixels) : undefined;
		const result = evaluate(code, base);

		if (result.ok) {
			error = null;
			resultPixels = result.pixels;
			tick().then(renderPreview);
		} else {
			error = result.error;
			resultPixels = null;
		}
	}

	function renderPreview() {
		if (!previewCanvas || !resultPixels) return;
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
		if (!resultPixels) {
			// Run first if no result yet
			runCode();
			if (!resultPixels) return; // still no result (error)
		}
		onApply(resultPixels);
	}

	function handleCancel() {
		// Save code before closing
		localStorage.setItem('oled-code-runner', code);
		onCancel();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) handleCancel();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleCancel();
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			runCode();
		}
	}

	function handleEditorChange(value: string) {
		code = value;
		// Clear previous results when code changes
		error = null;
		resultPixels = null;
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onclick={handleBackdropClick}
	>
		<div
			class="flex max-h-[90vh] w-[720px] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
				<h2 class="text-sm font-semibold text-zinc-100">Run GPC Code</h2>
				<button
					class="text-zinc-500 hover:text-zinc-300"
					onclick={handleCancel}
					aria-label="Close"
				>
					&times;
				</button>
			</div>

			<!-- Editor -->
			<div class="h-[320px] shrink-0 border-b border-zinc-800">
				<MonacoEditor value={code} language="gpc" onchange={handleEditorChange} />
			</div>

			<!-- Error display -->
			{#if error}
				<div class="border-b border-red-900/50 bg-red-950/30 px-5 py-2 text-xs text-red-400">
					<span class="font-medium">Line {error.line}:</span>
					{error.message}
				</div>
			{/if}

			<!-- Controls + Preview -->
			<div class="flex items-start gap-4 px-5 py-3">
				<div class="flex flex-1 flex-col gap-2">
					<!-- Mode toggle -->
					<div class="flex items-center gap-3">
						<span class="text-xs text-zinc-500">Base:</span>
						<label class="flex items-center gap-1.5 text-xs text-zinc-300">
							<input type="radio" bind:group={mode} value="blank" class="accent-emerald-600" />
							Blank canvas
						</label>
						<label class="flex items-center gap-1.5 text-xs text-zinc-300">
							<input type="radio" bind:group={mode} value="current" class="accent-emerald-600" />
							Current scene
						</label>
					</div>

					<div class="text-[10px] leading-relaxed text-zinc-600">
						Ctrl+Enter to run
					</div>
				</div>

				<!-- Preview canvas -->
				<div>
					<span class="mb-1 block text-xs text-zinc-500">Preview</span>
					<canvas
						bind:this={previewCanvas}
						width={OLED_WIDTH * 2}
						height={OLED_HEIGHT * 2}
						class="rounded border border-zinc-700 bg-black"
					></canvas>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-3 border-t border-zinc-800 px-5 py-3">
				<button
					class="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
					onclick={handleCancel}
				>
					Cancel
				</button>
				<button
					class="rounded bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
					onclick={runCode}
				>
					Run
				</button>
				<button
					class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					disabled={!resultPixels}
					onclick={handleApply}
				>
					Apply
				</button>
			</div>
		</div>
	</div>
{/if}
