<script lang="ts">
	import { open as openDialog } from '@tauri-apps/plugin-dialog';
	import { readFile } from '$lib/tauri/commands';
	import { parseBdf, bdfToBitmapFont, generateGpcFontCode } from '$lib/utils/bdf-parser';
	import type { BdfFont } from '$lib/utils/bdf-parser';
	import { goto } from '$app/navigation';
	import { addToast } from '$lib/stores/toast.svelte';
	import ToolHeader from '$lib/components/layout/ToolHeader.svelte';
	import { setFontTransfer } from '$lib/stores/font-transfer.svelte';
	import { bitmapToCustomFont } from '../oled/fonts-custom';

	let bdfFont = $state<BdfFont | null>(null);
	let bitmapFont = $state<{ width: number; height: number; spacing: number; data: Map<number, number[]> } | null>(null);
	let gpcCode = $state('');
	let fontName = $state('custom');
	let previewText = $state('Hello World!');
	let previewCanvas: HTMLCanvasElement | undefined = $state();
	let loading = $state(false);

	// Render preview when font or preview text changes
	$effect(() => {
		if (bitmapFont && previewCanvas) {
			renderPreview(bitmapFont, previewText, previewCanvas);
		}
	});

	// Regenerate GPC code when font name changes
	$effect(() => {
		if (bitmapFont) {
			gpcCode = generateGpcFontCode(fontName, bitmapFont);
		}
	});

	async function handleImport() {
		const path = await openDialog({
			title: 'Import BDF Font',
			filters: [{ name: 'BDF Font', extensions: ['bdf'] }],
			multiple: false
		});
		if (!path) return;

		loading = true;
		try {
			const content = await readFile(path as string);
			bdfFont = parseBdf(content);
			bitmapFont = bdfToBitmapFont(bdfFont);
			fontName = bdfFont.name.split('-').pop()?.toLowerCase() || 'custom';
			gpcCode = generateGpcFontCode(fontName, bitmapFont);
			addToast(`Imported font: ${bdfFont.glyphs.size} glyphs`, 'success');
		} catch (e) {
			addToast(`Failed to parse BDF font: ${e}`, 'error');
		} finally {
			loading = false;
		}
	}

	function handlePaste() {
		navigator.clipboard.readText().then((text) => {
			if (!text.includes('STARTFONT')) {
				addToast('Clipboard does not contain BDF font data', 'error');
				return;
			}
			try {
				bdfFont = parseBdf(text);
				bitmapFont = bdfToBitmapFont(bdfFont);
				fontName = bdfFont.name.split('-').pop()?.toLowerCase() || 'custom';
				gpcCode = generateGpcFontCode(fontName, bitmapFont);
				addToast(`Parsed font: ${bdfFont.glyphs.size} glyphs`, 'success');
			} catch (e) {
				addToast(`Failed to parse BDF: ${e}`, 'error');
			}
		});
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(gpcCode);
			addToast('GPC code copied to clipboard', 'success');
		} catch {
			addToast('Failed to copy', 'error');
		}
	}

	function sendToFontEditor() {
		if (!bitmapFont) return;
		const customFont = bitmapToCustomFont(fontName, bitmapFont.width, bitmapFont.height, bitmapFont.spacing, bitmapFont.data);
		setFontTransfer(customFont);
		goto('/tools/oled');
		addToast('Font sent to OLED Creator — open the Font Editor', 'success');
	}

	function renderPreview(
		font: { width: number; height: number; spacing: number; data: Map<number, number[]> },
		text: string,
		canvas: HTMLCanvasElement
	) {
		const scale = 3;
		const charWidth = font.width + font.spacing;
		const totalWidth = Math.max(text.length * charWidth, 128);
		canvas.width = totalWidth * scale;
		canvas.height = font.height * scale;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.fillStyle = '#101010';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = '#00ff80';

		let px = 0;
		for (let i = 0; i < text.length; i++) {
			const code = text.charCodeAt(i);
			const rows = font.data.get(code);
			if (rows) {
				for (let r = 0; r < rows.length; r++) {
					for (let b = font.width - 1; b >= 0; b--) {
						if (rows[r] & (1 << b)) {
							ctx.fillRect(
								(px + (font.width - 1 - b)) * scale,
								r * scale,
								scale,
								scale
							);
						}
					}
				}
			}
			px += charWidth;
		}
	}

	// Glyph grid preview
	let showGlyphGrid = $state(false);

	function renderGlyphCanvas(
		canvas: HTMLCanvasElement,
		params: { rows: number[]; width: number; height: number }
	) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const scale = 2;
		ctx.fillStyle = '#101010';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = '#00ff80';
		for (let r = 0; r < params.rows.length; r++) {
			for (let b = params.width - 1; b >= 0; b--) {
				if (params.rows[r] & (1 << b)) {
					ctx.fillRect((params.width - 1 - b) * scale, r * scale, scale, scale);
				}
			}
		}

		return {
			update(newParams: { rows: number[]; width: number; height: number }) {
				ctx.fillStyle = '#101010';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = '#00ff80';
				for (let r = 0; r < newParams.rows.length; r++) {
					for (let b = newParams.width - 1; b >= 0; b--) {
						if (newParams.rows[r] & (1 << b)) {
							ctx.fillRect((newParams.width - 1 - b) * scale, r * scale, scale, scale);
						}
					}
				}
			}
		};
	}
</script>

<div class="flex h-full flex-col bg-zinc-950 text-zinc-200">
	<!-- Header -->
	<ToolHeader title="OLED Font Import" subtitle="Import BDF bitmap fonts as GPC arrays" />

	<!-- Controls -->
	<div class="flex flex-wrap items-center gap-3 border-b border-zinc-800 p-4">
		<button
			class="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
			onclick={handleImport}
			disabled={loading}
		>
			{loading ? 'Loading...' : 'Import BDF File'}
		</button>
		<button
			class="rounded bg-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600"
			onclick={handlePaste}
		>
			Paste from Clipboard
		</button>

		{#if bitmapFont}
			<div class="mx-2 h-5 w-px bg-zinc-700"></div>
			<div class="flex items-center gap-2">
				<label class="text-[10px] text-zinc-500 uppercase">Name</label>
				<input
					type="text"
					class="w-32 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
					bind:value={fontName}
				/>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-[10px] text-zinc-500 uppercase">Preview</label>
				<input
					type="text"
					class="w-48 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500"
					bind:value={previewText}
				/>
			</div>
			<div class="mx-2 h-5 w-px bg-zinc-700"></div>
			<button
				class="rounded bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
				onclick={sendToFontEditor}
			>
				Send to Font Editor
			</button>
		{/if}
	</div>

	{#if bitmapFont && bdfFont}
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
			<!-- Font info -->
			<div class="flex flex-wrap gap-4 text-xs text-zinc-400">
				<span>Size: {bitmapFont.width}x{bitmapFont.height}px</span>
				<span>Glyphs: {bitmapFont.data.size}</span>
				<span>Point size: {bdfFont.pointSize}</span>
			</div>

			<!-- Preview -->
			<div class="rounded border border-zinc-800 bg-zinc-900 p-3">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-xs font-medium text-zinc-400">Preview</h3>
				</div>
				<div class="overflow-auto rounded bg-zinc-950 p-2" style="image-rendering: pixelated">
					<canvas bind:this={previewCanvas} class="block"></canvas>
				</div>
			</div>

			<!-- Glyph grid toggle -->
			<div>
				<button
					class="text-xs text-zinc-500 hover:text-zinc-300"
					onclick={() => (showGlyphGrid = !showGlyphGrid)}
				>
					{showGlyphGrid ? 'Hide' : 'Show'} glyph grid ({bitmapFont.data.size} chars)
				</button>
				{#if showGlyphGrid}
					<div class="mt-2 flex flex-wrap gap-1">
						{#each [...bitmapFont.data.entries()].sort((a, b) => a[0] - b[0]) as [code, rows]}
							<div
								class="flex flex-col items-center rounded border border-zinc-800 bg-zinc-900 p-1"
								title={`'${String.fromCharCode(code)}' (${code})`}
							>
								<canvas
									class="block"
									width={bitmapFont.width * 2}
									height={bitmapFont.height * 2}
									style="image-rendering: pixelated"
									use:renderGlyphCanvas={{ rows, width: bitmapFont.width, height: bitmapFont.height }}
								></canvas>
								<span class="mt-0.5 text-[8px] text-zinc-500">{String.fromCharCode(code)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- GPC code output -->
			<div class="rounded border border-zinc-800 bg-zinc-900 p-3">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-xs font-medium text-zinc-400">Generated GPC Code</h3>
					<button
						class="rounded bg-zinc-700 px-3 py-1 text-[10px] text-zinc-300 hover:bg-zinc-600"
						onclick={copyCode}
					>
						Copy
					</button>
				</div>
				<pre class="max-h-96 overflow-auto rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-300">{gpcCode}</pre>
			</div>
		</div>
	{:else}
		<div class="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
			<svg class="h-16 w-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 6h16M4 12h16m-7 6h7" />
			</svg>
			<p class="text-sm">Import a BDF bitmap font file to generate GPC code</p>
			<p class="text-xs text-zinc-700">
				Supports standard BDF format. Common sources: X11 fonts, Font Forge exports
			</p>
		</div>
	{/if}
</div>
