<script lang="ts">
	import type { BuildResult } from '$lib/tauri/commands';
	import { parseBuildErrorLink } from '$lib/utils/editor-helpers';
	import MonacoEditor from './MonacoEditor.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		buildResult: BuildResult | null;
		buildOutputContent: string | null;
		buildOutputLoading: boolean;
		building: boolean;
		onBuild: () => void;
		onBuildErrorClick: (error: string) => void;
		onCopyBuildOutput: () => void;
		onSendToZenStudio: () => void;
		sendingToZenStudio?: boolean;
	}

	let {
		buildResult,
		buildOutputContent,
		buildOutputLoading,
		building,
		onBuild,
		onBuildErrorClick,
		onCopyBuildOutput,
		onSendToZenStudio,
		sendingToZenStudio = false
	}: Props = $props();
</script>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<button
			class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
			onclick={onBuild}
			disabled={building}
		>
			{building ? m.common_building() : m.editor_build_button()}
		</button>
		{#if buildResult}
			<span
				class="text-sm"
				class:text-emerald-400={buildResult.success}
				class:text-red-400={!buildResult.success}
			>
				{buildResult.success ? m.editor_build_succeeded() : m.editor_build_failed()}
			</span>
		{/if}
	</div>

	{#if buildResult}
		<!-- Build Status -->
		<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-4 select-text font-mono text-xs">
			{#if buildResult.success}
				<div class="text-emerald-400">{m.editor_build_successful()}</div>
				<div class="mt-1 text-zinc-400">{m.editor_build_output({ path: buildResult.output_path })}</div>
			{/if}

			{#if buildResult.warnings.length > 0}
				<div class="mt-2 border-t border-zinc-800 pt-2">
					<div class="text-amber-400">{m.editor_build_warnings()}</div>
					{#each buildResult.warnings as warning}
						<div class="text-amber-300/70">{warning}</div>
					{/each}
				</div>
			{/if}

			{#if buildResult.errors.length > 0}
				<div class="mt-2 border-t border-zinc-800 pt-2">
					<div class="text-red-400">{m.editor_build_errors()}</div>
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
				{m.editor_build_loading_output()}
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
							{m.editor_build_lines({ count: buildOutputContent.split('\n').length })}
						</span>
						<button
							class="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
							onclick={onCopyBuildOutput}
							title={m.editor_build_copy_clipboard()}
						>
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
							{m.common_copy()}
						</button>
						<button
							class="hidden items-center gap-1 rounded border border-blue-700/50 px-2 py-0.5 text-xs text-blue-400 transition-colors hover:bg-blue-900/30 hover:text-blue-300 disabled:opacity-50"
							onclick={onSendToZenStudio}
							disabled={sendingToZenStudio}
							title={m.editor_build_send_zen_studio()}
						>
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								/>
							</svg>
							{sendingToZenStudio ? m.editor_build_sending_zen_studio() : m.editor_build_send_zen_studio()}
						</button>
					</div>
				</div>
				<div class="h-96">
					<MonacoEditor value={buildOutputContent} language="gpc" readonly={true} />
				</div>
			</div>
		{/if}
	{:else if !building}
		<div
			class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500"
		>
			{m.editor_build_idle_message()}
			<br />
			<span class="text-xs text-zinc-600">
				{m.editor_build_idle_hint()}
			</span>
		</div>
	{:else}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
			<div
				class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
			></div>
			<div class="mt-2 text-sm text-zinc-400">
				{m.editor_build_processing()}
			</div>
		</div>
	{/if}
</div>
