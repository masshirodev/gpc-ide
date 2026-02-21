<script lang="ts">
	import {
		listTemplates,
		listTemplateCategories,
		TEMPLATE_CATEGORY_LABELS,
	} from '$lib/templates/registry';
	import type { ScriptTemplate, TemplateOutput } from '$lib/templates/types';
	import { addToast } from '$lib/stores/toast.svelte';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';
	import { loadGraph } from '$lib/stores/flow.svelte';
	import { goto } from '$app/navigation';

	let categories = listTemplateCategories();
	let selectedCategory = $state<ScriptTemplate['category'] | null>(null);
	let templates = $derived(
		selectedCategory ? listTemplates(selectedCategory) : listTemplates()
	);
	let selectedTemplate = $state<ScriptTemplate | null>(null);
	let params = $state<Record<string, unknown>>({});
	let output = $state<TemplateOutput | null>(null);

	function selectTemplate(t: ScriptTemplate) {
		selectedTemplate = t;
		const p: Record<string, unknown> = {};
		for (const param of t.params) {
			p[param.key] = param.default;
		}
		params = p;
		output = null;
	}

	function handleGenerate() {
		if (!selectedTemplate) return;
		try {
			output = selectedTemplate.generate(params);
			addToast('Template generated', 'success');
		} catch (e) {
			addToast(`Generation failed: ${e}`, 'error');
		}
	}

	function handleOpenInFlow() {
		if (!output?.flowGraph) return;
		loadGraph(output.flowGraph, '');
		goto('/tools/flow');
	}

	function handleCopyCode() {
		if (!output?.code) return;
		navigator.clipboard.writeText(output.code);
		addToast('Code copied to clipboard', 'success');
	}

	function handleParamChange(key: string, value: unknown) {
		params = { ...params, [key]: value };
		output = null;
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
		<h1 class="text-xl font-bold">Script Templates</h1>
	</div>

	<div class="flex min-h-0 flex-1">
		<!-- Template browser -->
		<div class="w-72 overflow-y-auto border-r border-zinc-800 p-3">
			<!-- Category filter -->
			<div class="mb-3 flex flex-wrap gap-1">
				<button
					class="rounded px-2 py-1 text-xs {selectedCategory === null
						? 'bg-emerald-600 text-white'
						: 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
					onclick={() => (selectedCategory = null)}
				>
					All
				</button>
				{#each categories as cat}
					<button
						class="rounded px-2 py-1 text-xs {selectedCategory === cat
							? 'bg-emerald-600 text-white'
							: 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
						onclick={() => (selectedCategory = cat)}
					>
						{TEMPLATE_CATEGORY_LABELS[cat] || cat}
					</button>
				{/each}
			</div>

			<!-- Template cards -->
			<div class="space-y-2">
				{#each templates as t}
					<button
						class="w-full rounded border p-3 text-left {selectedTemplate?.id === t.id
							? 'border-emerald-600 bg-zinc-800'
							: 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}"
						onclick={() => selectTemplate(t)}
					>
						<div class="mb-1 text-sm font-medium text-zinc-200">{t.name}</div>
						<div class="{t.creator ? 'mb-1' : 'mb-2'} text-xs text-zinc-500">{t.description}</div>
						{#if t.creator}
							<div class="mb-2 text-[10px] text-zinc-600">Originally made by {t.creator}</div>
						{/if}
						<div class="flex gap-1">
							<span
								class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400"
							>
								{t.outputType === 'flow' ? 'Flow Graph' : 'Code'}
							</span>
							{#each t.tags.slice(0, 2) as tag}
								<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
									{tag}
								</span>
							{/each}
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Config + Preview -->
		<div class="flex flex-1 flex-col">
			{#if selectedTemplate}
				<div class="flex min-h-0 flex-1">
					<!-- Parameters -->
					<div class="w-72 overflow-y-auto border-r border-zinc-800 p-4">
						<h3 class="mb-3 text-sm font-semibold text-zinc-300">Parameters</h3>
						{#each selectedTemplate.params as param}
							<div class="mb-3">
								<label class="mb-1 block text-xs text-zinc-500">{param.label}</label>
								{#if param.type === 'text'}
									<input
										type="text"
										value={params[param.key] as string}
										class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
										oninput={(e) =>
											handleParamChange(
												param.key,
												(e.target as HTMLInputElement).value
											)}
									/>
								{:else if param.type === 'number'}
									<input
										type="number"
										value={params[param.key] as number}
										min={param.min}
										max={param.max}
										class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
										oninput={(e) =>
											handleParamChange(
												param.key,
												parseInt((e.target as HTMLInputElement).value) ||
													param.default
											)}
									/>
								{:else if param.type === 'boolean'}
									<label class="flex items-center gap-2 text-sm text-zinc-300">
										<input
											type="checkbox"
											checked={params[param.key] as boolean}
											onchange={(e) =>
												handleParamChange(
													param.key,
													(e.target as HTMLInputElement).checked
												)}
											class="accent-emerald-500"
										/>
										{param.label}
									</label>
								{:else if param.type === 'select' && param.options}
									<select
										value={params[param.key] as string}
										class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
										onchange={(e) =>
											handleParamChange(
												param.key,
												(e.target as HTMLSelectElement).value
											)}
									>
										{#each param.options as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{/if}
								{#if param.description}
									<p class="mt-0.5 text-xs text-zinc-600">{param.description}</p>
								{/if}
							</div>
						{/each}

						<button
							class="mt-4 w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
							onclick={handleGenerate}
						>
							Generate
						</button>
					</div>

					<!-- Output preview -->
					<div class="flex flex-1 flex-col p-4">
						{#if output}
							<div class="mb-3 flex items-center justify-between">
								<h3 class="text-sm font-semibold text-zinc-300">
									Output: {output.description}
								</h3>
								<div class="flex gap-2">
									{#if output.type === 'flow' && output.flowGraph}
										<button
											class="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
											onclick={handleOpenInFlow}
										>
											Open in Flow Editor
										</button>
									{/if}
									{#if output.type === 'code' && output.code}
										<button
											class="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
											onclick={handleCopyCode}
										>
											Copy Code
										</button>
									{/if}
								</div>
							</div>

							{#if output.type === 'flow' && output.flowGraph}
								<!-- Flow graph preview -->
								<div
									class="flex-1 overflow-auto rounded border border-zinc-700 bg-zinc-900 p-4"
								>
									<div class="mb-3 text-xs text-zinc-500">
										{output.flowGraph.nodes.length} nodes, {output.flowGraph.edges
											.length} edges
									</div>
									<div class="space-y-2">
										{#each output.flowGraph.nodes as node}
											<div class="flex items-center gap-2 text-sm">
												<span
													class="inline-block h-3 w-3 rounded-sm"
													style="background: {node.type === 'intro'
														? '#3b82f6'
														: node.type === 'home'
															? '#22c55e'
															: node.type === 'menu'
																? '#a855f7'
																: node.type === 'submenu'
																	? '#f97316'
																	: node.type === 'screensaver'
																		? '#06b6d4'
																		: '#6b7280'}"
												></span>
												<span class="text-zinc-300">{node.label}</span>
												<span class="text-xs text-zinc-600">({node.type})</span>
												{#if node.isInitialState}
													<span
														class="rounded bg-emerald-900 px-1 text-xs text-emerald-400"
														>initial</span
													>
												{/if}
											</div>
										{/each}
										<div class="mt-3 border-t border-zinc-800 pt-2">
											{#each output.flowGraph.edges as edge}
												{@const src = output.flowGraph?.nodes.find(
													(n) => n.id === edge.sourceNodeId
												)}
												{@const tgt = output.flowGraph?.nodes.find(
													(n) => n.id === edge.targetNodeId
												)}
												<div class="flex items-center gap-1 text-xs text-zinc-500">
													<span>{src?.label || '?'}</span>
													<span class="text-zinc-600">--[{edge.label}]--></span>
													<span>{tgt?.label || '?'}</span>
												</div>
											{/each}
										</div>
									</div>
								</div>
							{:else if output.type === 'code' && output.code}
								<!-- Code preview -->
								<div class="flex-1 overflow-hidden rounded border border-zinc-700">
									<MonacoEditor value={output.code} language="gpc" readonly={true} />
								</div>
							{/if}
						{:else}
							<div
								class="flex flex-1 items-center justify-center text-sm text-zinc-500"
							>
								Configure parameters and click "Generate" to preview the output.
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center text-sm text-zinc-500">
					Select a template from the left panel to configure and generate.
				</div>
			{/if}
		</div>
	</div>
</div>
