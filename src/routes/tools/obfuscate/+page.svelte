<script lang="ts">
	import { obfuscateGpc, readFile } from '$lib/tauri/commands';
	import type { ObfuscateResult } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';
	import MonacoEditor from '$lib/components/editor/MonacoEditor.svelte';

	let source = $state('');
	let result = $state<ObfuscateResult | null>(null);
	let level = $state(2);
	let loading = $state(false);
	let loadedFileName = $state('');

	const levelLabels: Record<number, { name: string; desc: string }> = {
		1: { name: 'Strip & Minify', desc: 'Remove comments and collapse whitespace' },
		2: { name: 'Rename Identifiers', desc: 'Rename variables, functions, and combos' },
		3: { name: 'Encode Strings', desc: 'Convert string constants to char arrays' },
		4: { name: 'Dead Code Injection', desc: 'Insert unused code to confuse readers' },
		5: { name: 'Control Flow', desc: 'Add opaque predicates and restructure logic' }
	};

	async function handleObfuscate() {
		if (!source.trim()) {
			addToast('Load a GPC file first', 'error');
			return;
		}
		loading = true;
		try {
			result = await obfuscateGpc(source, level);
			addToast('Obfuscation complete', 'success');
		} catch (e) {
			addToast(`Obfuscation failed: ${e}`, 'error');
		} finally {
			loading = false;
		}
	}

	async function handleLoadFile() {
		try {
			const { open } = await import('@tauri-apps/plugin-dialog');
			const selected = await open({
				multiple: false,
				filters: [{ name: 'GPC Files', extensions: ['gpc'] }]
			});
			if (selected) {
				const content = await readFile(selected);
				source = content;
				loadedFileName = selected.split('/').pop() ?? selected;
				result = null;
				addToast(`Loaded ${loadedFileName}`, 'success');
			}
		} catch (e) {
			addToast(`Failed to load file: ${e}`, 'error');
		}
	}

	async function handleCopy() {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(result.output);
			addToast('Copied to clipboard', 'success');
		} catch {
			addToast('Failed to copy to clipboard', 'error');
		}
	}

	async function handleSave() {
		if (!result) return;
		try {
			const { save } = await import('@tauri-apps/plugin-dialog');
			const path = await save({
				defaultPath: loadedFileName
					? loadedFileName.replace('.gpc', '_obf.gpc')
					: 'obfuscated.gpc',
				filters: [{ name: 'GPC Files', extensions: ['gpc'] }]
			});
			if (path) {
				const { writeFile } = await import('$lib/tauri/commands');
				await writeFile(path, result.output);
				addToast(`Saved to ${path.split('/').pop()}`, 'success');
			}
		} catch (e) {
			addToast(`Failed to save: ${e}`, 'error');
		}
	}

	let sizeReduction = $derived.by(() => {
		if (!result) return 0;
		const before = source.length;
		const after = result.output.length;
		if (before === 0) return 0;
		return Math.round(((before - after) / before) * 100);
	});
</script>

<div class="flex h-full flex-col bg-zinc-950 text-zinc-100">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
		<div class="flex items-center gap-3">
			<a
				href="/"
				class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
				title="Back to dashboard"
			>
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 011.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
						clip-rule="evenodd"
					/>
				</svg>
			</a>
			<div>
				<h1 class="text-lg font-semibold">Code Obfuscator</h1>
				<p class="text-xs text-zinc-500">Protect your GPC scripts with layered obfuscation</p>
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="flex flex-wrap items-center gap-4 border-b border-zinc-800 px-4 py-3">
		<button
			onclick={handleLoadFile}
			class="flex items-center gap-2 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
			Load .gpc File
		</button>

		{#if loadedFileName}
			<span class="text-xs text-zinc-500">{loadedFileName}</span>
		{/if}

		<div class="flex items-center gap-3">
			<label class="text-sm text-zinc-400" for="level-slider">Level:</label>
			<input
				id="level-slider"
				type="range"
				min="1"
				max="5"
				bind:value={level}
				class="h-2 w-32 cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-emerald-500"
			/>
			<div class="min-w-[140px]">
				<span class="text-sm font-medium text-emerald-400">{level}</span>
				<span class="text-sm text-zinc-400"> - {levelLabels[level].name}</span>
			</div>
		</div>

		<button
			onclick={handleObfuscate}
			disabled={loading || !source.trim()}
			class="flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if loading}
				<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					></path>
				</svg>
				Processing...
			{:else}
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
						clip-rule="evenodd"
					/>
				</svg>
				Obfuscate
			{/if}
		</button>

		{#if result}
			<div class="ml-auto flex items-center gap-2">
				<button
					onclick={handleCopy}
					class="flex items-center gap-1.5 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					Copy
				</button>
				<button
					onclick={handleSave}
					class="flex items-center gap-1.5 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
						/>
					</svg>
					Save As
				</button>
			</div>
		{/if}
	</div>

	<!-- Level description tooltip -->
	<div class="border-b border-zinc-800/50 bg-zinc-900/50 px-4 py-1.5">
		<p class="text-xs text-zinc-500">
			<span class="text-zinc-400">Layers applied:</span>
			{#each Array.from({ length: level }, (_, i) => i + 1) as l}
				<span class="ml-1.5">
					<span class="text-emerald-500">{l}</span>
					<span class="text-zinc-500">{levelLabels[l].name}</span>
					{#if l < level}<span class="text-zinc-600"> +</span>{/if}
				</span>
			{/each}
		</p>
	</div>

	<!-- Editor split view -->
	<div class="flex min-h-0 flex-1">
		<!-- Source panel -->
		<div class="flex flex-1 flex-col border-r border-zinc-800">
			<div class="border-b border-zinc-800/50 px-3 py-1.5">
				<span class="text-xs font-medium text-zinc-500">SOURCE</span>
			</div>
			<div class="min-h-0 flex-1">
				{#if source}
					<MonacoEditor value={source} readonly={true} />
				{:else}
					<div class="flex h-full items-center justify-center text-zinc-600">
						<div class="text-center">
							<svg
								class="mx-auto mb-2 h-12 w-12"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<p class="text-sm">Load a .gpc file to get started</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Output panel -->
		<div class="flex flex-1 flex-col">
			<div class="border-b border-zinc-800/50 px-3 py-1.5">
				<span class="text-xs font-medium text-zinc-500">OBFUSCATED OUTPUT</span>
			</div>
			<div class="min-h-0 flex-1">
				{#if result}
					<MonacoEditor value={result.output} readonly={true} />
				{:else}
					<div class="flex h-full items-center justify-center text-zinc-600">
						<div class="text-center">
							<svg
								class="mx-auto mb-2 h-12 w-12"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
							<p class="text-sm">Obfuscated output will appear here</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Stats bar -->
	{#if result}
		<div
			class="flex flex-wrap items-center gap-6 border-t border-zinc-800 bg-zinc-900/50 px-4 py-2"
		>
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-zinc-500">Identifiers renamed:</span>
				<span class="text-xs font-medium text-emerald-400"
					>{result.stats.identifiers_renamed}</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-zinc-500">Comments removed:</span>
				<span class="text-xs font-medium text-emerald-400"
					>{result.stats.comments_removed}</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-zinc-500">Strings encoded:</span>
				<span class="text-xs font-medium text-emerald-400"
					>{result.stats.strings_encoded}</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-zinc-500">Dead code blocks:</span>
				<span class="text-xs font-medium text-emerald-400"
					>{result.stats.dead_code_blocks}</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-zinc-500">Lines:</span>
				<span class="text-xs text-zinc-300"
					>{result.stats.lines_before} → {result.stats.lines_after}</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-zinc-500">Size:</span>
				<span class="text-xs font-medium" class:text-emerald-400={sizeReduction > 0} class:text-amber-400={sizeReduction <= 0}>
					{sizeReduction > 0 ? `-${sizeReduction}%` : `+${Math.abs(sizeReduction)}%`}
				</span>
			</div>
		</div>
	{/if}
</div>
