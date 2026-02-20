<script lang="ts">
	import { listWidgets, listCategories, CATEGORY_LABELS } from '$lib/oled-widgets/registry';
	import type { OledWidgetDef } from '$lib/oled-widgets/types';
	import { addToast } from '$lib/stores/toast.svelte';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';

	let categories = listCategories();
	let selectedCategory = $state<OledWidgetDef['category']>(categories[0]);
	let widgets = $derived(listWidgets(selectedCategory));
	let selectedWidget = $state<OledWidgetDef | null>(null);
	let config = $state<Record<string, unknown>>({});
	let previewValue = $state(50);

	let canvasEl: HTMLCanvasElement | undefined = $state();

	function selectWidget(w: OledWidgetDef) {
		selectedWidget = w;
		const c: Record<string, unknown> = {};
		for (const p of w.params) {
			c[p.key] = p.default;
		}
		config = c;
	}

	function renderToCanvas(canvas: HTMLCanvasElement, widget: OledWidgetDef, cfg: Record<string, unknown>, value: number) {
		const pixels = new Uint8Array(1024);
		const cx = Math.floor((128 - widget.width) / 2);
		const cy = Math.floor((64 - widget.height) / 2);
		widget.render(cfg, value, pixels, cx, cy);

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 384, 192);
		for (let y = 0; y < 64; y++) {
			for (let x = 0; x < 128; x++) {
				const byteIdx = y * 16 + Math.floor(x / 8);
				const bitIdx = 7 - (x % 8);
				if (pixels[byteIdx] & (1 << bitIdx)) {
					ctx.fillStyle = '#fff';
					ctx.fillRect(x * 3, y * 3, 3, 3);
				}
			}
		}
		ctx.strokeStyle = '#1a1a2e';
		ctx.lineWidth = 0.5;
		for (let x = 0; x <= 128; x++) {
			ctx.beginPath();
			ctx.moveTo(x * 3, 0);
			ctx.lineTo(x * 3, 192);
			ctx.stroke();
		}
		for (let y = 0; y <= 64; y++) {
			ctx.beginPath();
			ctx.moveTo(0, y * 3);
			ctx.lineTo(384, y * 3);
			ctx.stroke();
		}
	}

	// Single effect that re-renders whenever widget, config, value, or canvas changes
	$effect(() => {
		if (selectedWidget && canvasEl) {
			renderToCanvas(canvasEl, selectedWidget, config, previewValue);
		}
	});

	function handleConfigChange(key: string, value: unknown) {
		config = { ...config, [key]: value };
	}

	let gpcOutput = $derived.by(() => {
		if (!selectedWidget) return '';
		const cx = Math.floor((128 - selectedWidget.width) / 2);
		const cy = Math.floor((64 - selectedWidget.height) / 2);
		return selectedWidget.generateGpc(config, 'myValue', cx, cy);
	});

	function handleCopyGpc() {
		if (!selectedWidget) return;
		const cx = Math.floor((128 - selectedWidget.width) / 2);
		const cy = Math.floor((64 - selectedWidget.height) / 2);
		const code = selectedWidget.generateGpc(config, 'myValue', cx, cy);
		navigator.clipboard.writeText(code);
		addToast('GPC code copied to clipboard', 'success');
	}

	function handleCopyGpcCustom() {
		if (!selectedWidget) return;
		const code = selectedWidget.generateGpc(config, 'myValue', 0, 0);
		navigator.clipboard.writeText(code);
		addToast('GPC code (at 0,0) copied to clipboard', 'success');
	}
</script>

<div class="flex h-full flex-col bg-zinc-950 text-zinc-100">
	<!-- Header -->
	<div class="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
		<a href="/" class="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Back
		</a>
		<h1 class="text-xl font-bold">OLED Widget Library</h1>
	</div>

	<div class="flex min-h-0 flex-1">
		<!-- Widget browser -->
		<div class="w-64 overflow-y-auto border-r border-zinc-800 p-3">
			<!-- Category tabs -->
			<div class="mb-3 flex flex-wrap gap-1">
				{#each categories as cat}
					<button
						class="rounded px-2 py-1 text-xs {selectedCategory === cat
							? 'bg-emerald-600 text-white'
							: 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
						onclick={() => {
							selectedCategory = cat;
							selectedWidget = null;
						}}
					>
						{CATEGORY_LABELS[cat]}
					</button>
				{/each}
			</div>

			<!-- Widget list -->
			<div class="space-y-1">
				{#each widgets as w}
					<button
						class="w-full rounded px-3 py-2 text-left text-sm {selectedWidget?.id === w.id
							? 'bg-zinc-700 text-emerald-400'
							: 'text-zinc-300 hover:bg-zinc-800'}"
						onclick={() => selectWidget(w)}
					>
						<div class="font-medium">{w.name}</div>
						<div class="text-xs text-zinc-500">{w.description}</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Preview + Config -->
		<div class="flex flex-1 flex-col">
			{#if selectedWidget}
				<!-- OLED Preview -->
				<div class="flex flex-col items-center border-b border-zinc-800 p-6">
					<div class="mb-2 text-sm text-zinc-400">128 x 64 OLED Preview</div>
					<div class="rounded border border-zinc-700 bg-black p-1">
						<canvas bind:this={canvasEl} width="384" height="192" class="block"></canvas>
					</div>

					<!-- Value slider -->
					<div class="mt-4 flex w-full max-w-sm items-center gap-3">
						<span class="text-xs text-zinc-500">Value</span>
						<input
							type="range"
							min="0"
							max="100"
							bind:value={previewValue}
							class="flex-1 accent-emerald-500"
						/>
						<span class="w-8 text-right text-sm text-zinc-300">{previewValue}</span>
					</div>
				</div>

				<!-- Config + Code -->
				<div class="flex min-h-0 flex-1">
					<!-- Config panel -->
					<div class="w-72 overflow-y-auto border-r border-zinc-800 p-4">
						<h3 class="mb-3 text-sm font-semibold text-zinc-300">Configuration</h3>

						{#each selectedWidget.params as param}
							<div class="mb-3">
								<label class="mb-1 block text-xs text-zinc-500">{param.label}</label>
								{#if param.type === 'number'}
									<input
										type="number"
										value={config[param.key] as number}
										min={param.min}
										max={param.max}
										class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
										oninput={(e) =>
											handleConfigChange(
												param.key,
												parseInt((e.target as HTMLInputElement).value) || param.default
											)}
									/>
								{:else if param.type === 'boolean'}
									<label class="flex items-center gap-2 text-sm text-zinc-300">
										<input
											type="checkbox"
											checked={config[param.key] as boolean}
											onchange={(e) =>
												handleConfigChange(
													param.key,
													(e.target as HTMLInputElement).checked
												)}
											class="accent-emerald-500"
										/>
										{param.label}
									</label>
								{:else if param.type === 'select' && param.options}
									<select
										value={config[param.key] as string}
										class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
										onchange={(e) =>
											handleConfigChange(
												param.key,
												(e.target as HTMLSelectElement).value
											)}
									>
										{#each param.options as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{/if}
							</div>
						{/each}

						<h3 class="mb-3 mt-6 text-sm font-semibold text-zinc-300">Widget Info</h3>
						<div class="space-y-1 text-xs text-zinc-500">
							<div>Size: {selectedWidget.width} x {selectedWidget.height} px</div>
							<div>Category: {CATEGORY_LABELS[selectedWidget.category]}</div>
							<div>ID: {selectedWidget.id}</div>
						</div>
					</div>

					<!-- GPC Code output -->
					<div class="flex flex-1 flex-col p-4">
						<h3 class="mb-2 text-sm font-semibold text-zinc-300">Generated GPC Code</h3>
						<div class="flex-1 overflow-hidden rounded border border-zinc-700">
							<MonacoEditor value={gpcOutput} language="gpc" readonly={true} />
						</div>

						<div class="mt-3 flex gap-2">
							<button
								class="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
								onclick={handleCopyGpc}
							>
								Copy GPC Code
							</button>
							<button
								class="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
								onclick={handleCopyGpcCustom}
							>
								Copy at (0,0)
							</button>
						</div>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center text-sm text-zinc-500">
					Select a widget from the left panel to preview and configure it.
				</div>
			{/if}
		</div>
	</div>
</div>
