<script lang="ts">
	import type { BuildResult, FileDiff } from '$lib/tauri/commands';
	import { computeLineDiff, parseBuildErrorLink } from '$lib/utils/editor-helpers';
	import MonacoEditor from './MonacoEditor.svelte';

	interface Props {
		buildDiffMode: boolean;
		buildDiffs: FileDiff[];
		buildDiffSelectedFile: number;
		buildDiffLoading: boolean;
		buildResult: BuildResult | null;
		buildOutputContent: string | null;
		buildOutputLoading: boolean;
		building: boolean;
		regeneratingAll: boolean;
		onBuild: () => void;
		onBuildCancel: () => void;
		onBuildCommit: () => void;
		onRegenerateAll: () => void;
		onBuildErrorClick: (error: string) => void;
		onCopyBuildOutput: () => void;
		onSelectDiffFile: (index: number) => void;
	}

	let {
		buildDiffMode,
		buildDiffs,
		buildDiffSelectedFile,
		buildDiffLoading,
		buildResult,
		buildOutputContent,
		buildOutputLoading,
		building,
		regeneratingAll,
		onBuild,
		onBuildCancel,
		onBuildCommit,
		onRegenerateAll,
		onBuildErrorClick,
		onCopyBuildOutput,
		onSelectDiffFile
	}: Props = $props();
</script>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		{#if buildDiffMode}
			<button
				class="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
				onclick={onBuildCancel}
			>
				Cancel
			</button>
			<button
				class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
				onclick={onBuildCommit}
			>
				Commit & Build
			</button>
			<span class="text-sm text-amber-400">
				{buildDiffs.length} file{buildDiffs.length !== 1 ? 's' : ''} changed
			</span>
		{:else}
			<button
				class="rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
				onclick={onRegenerateAll}
				disabled={regeneratingAll}
			>
				{regeneratingAll ? 'Regenerating...' : 'Regenerate'}
			</button>
			<button
				class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
				onclick={onBuild}
				disabled={building || buildDiffLoading}
			>
				{buildDiffLoading ? 'Checking...' : building ? 'Building...' : 'Build Game'}
			</button>
			{#if buildResult}
				<span
					class="text-sm"
					class:text-emerald-400={buildResult.success}
					class:text-red-400={!buildResult.success}
				>
					{buildResult.success ? 'Build succeeded' : 'Build failed'}
				</span>
			{/if}
		{/if}
	</div>

	{#if buildDiffMode}
		<!-- Diff Preview -->
		<div class="overflow-hidden rounded-lg border border-zinc-800">
			<!-- File tabs -->
			<div class="flex gap-0 overflow-x-auto border-b border-zinc-800 bg-zinc-900/80">
				{#each buildDiffs as diff, i}
					<button
						class="whitespace-nowrap border-r border-zinc-800 px-3 py-2 text-xs transition-colors {buildDiffSelectedFile === i ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}"
						onclick={() => onSelectDiffFile(i)}
					>
						{diff.path}
					</button>
				{/each}
			</div>
			<!-- Diff content -->
			{#if buildDiffs[buildDiffSelectedFile]}
				{@const diffLines = computeLineDiff(
					buildDiffs[buildDiffSelectedFile].old_content.split('\n'),
					buildDiffs[buildDiffSelectedFile].new_content.split('\n')
				)}
				<div class="max-h-[600px] overflow-auto bg-zinc-950 p-0 font-mono text-xs">
					<table class="w-full border-collapse">
						{#each diffLines as line}
							<tr class={line.type === 'removed' ? 'bg-red-950/40' : line.type === 'added' ? 'bg-emerald-950/40' : ''}>
								<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
									{line.oldNum ?? ''}
								</td>
								<td class="select-none px-2 py-0 text-right text-zinc-700 {line.type === 'removed' ? 'text-red-800' : line.type === 'added' ? 'text-emerald-800' : ''}" style="width: 3rem">
									{line.newNum ?? ''}
								</td>
								<td class="select-none px-1 py-0 {line.type === 'removed' ? 'text-red-500' : line.type === 'added' ? 'text-emerald-500' : 'text-zinc-700'}" style="width: 1rem">
									{line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
								</td>
								<td class="whitespace-pre py-0 pr-4 {line.type === 'removed' ? 'text-red-300/80' : line.type === 'added' ? 'text-emerald-300/80' : 'text-zinc-400'}">
									{line.text}
								</td>
							</tr>
						{/each}
					</table>
				</div>
			{/if}
		</div>
	{:else if buildResult}
		<!-- Build Status -->
		<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs">
			{#if buildResult.success}
				<div class="text-emerald-400">Build successful!</div>
				<div class="mt-1 text-zinc-400">Output: {buildResult.output_path}</div>
			{/if}

			{#if buildResult.warnings.length > 0}
				<div class="mt-2 border-t border-zinc-800 pt-2">
					<div class="text-amber-400">Warnings:</div>
					{#each buildResult.warnings as warning}
						<div class="text-amber-300/70">{warning}</div>
					{/each}
				</div>
			{/if}

			{#if buildResult.errors.length > 0}
				<div class="mt-2 border-t border-zinc-800 pt-2">
					<div class="text-red-400">Errors:</div>
					{#each buildResult.errors as error}
						{#if parseBuildErrorLink(error)}
							<button
								class="block w-full cursor-pointer text-left text-red-300/70 underline decoration-red-500/30 hover:text-red-200 hover:decoration-red-400/50"
								onclick={() => onBuildErrorClick(error)}
							>
								{error}
							</button>
						{:else}
							<div class="text-red-300/70">{error}</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Build Output File Content -->
		{#if buildOutputLoading}
			<div
				class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-500"
			>
				Loading build output...
			</div>
		{:else if buildOutputContent !== null}
			<div class="overflow-hidden rounded-lg border border-zinc-800">
				<div
					class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5"
				>
					<span class="text-xs text-zinc-400">
						{buildResult.output_path.split('/').pop()}
					</span>
					<div class="flex items-center gap-3">
						<span class="text-xs text-zinc-600">
							{buildOutputContent.split('\n').length} lines
						</span>
						<button
							class="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
							onclick={onCopyBuildOutput}
							title="Copy to clipboard"
						>
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
							Copy
						</button>
					</div>
				</div>
				<div class="h-96">
					<MonacoEditor value={buildOutputContent} language="gpc" readonly={true} />
				</div>
			</div>
		{/if}
	{:else if !building && !buildDiffLoading}
		<div
			class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500"
		>
			Click "Build Game" to preprocess and compile this game's scripts.
			<br />
			<span class="text-xs text-zinc-600">
				This merges all #include directives into a single .gpc file.
			</span>
		</div>
	{:else}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
			<div
				class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
			></div>
			<div class="mt-2 text-sm text-zinc-400">
				{buildDiffLoading ? 'Checking for changes...' : 'Preprocessing and building...'}
			</div>
		</div>
	{/if}
</div>
