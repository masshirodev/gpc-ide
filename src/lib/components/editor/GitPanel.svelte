<script lang="ts">
	import {
		gitStatusDetailed,
		gitStage,
		gitUnstage,
		gitCommit,
		gitDiffFile
	} from '$lib/tauri/commands';
	import type { GitDetailedStatus } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';

	interface Props {
		gamePath: string;
		onCommitted?: () => void;
	}

	let { gamePath, onCommitted }: Props = $props();

	let statuses = $state<GitDetailedStatus[]>([]);
	let loading = $state(false);
	let commitMessage = $state('');
	let committing = $state(false);
	let diffPreview = $state<{ path: string; diff: string } | null>(null);

	// Derived: staged files (have index status)
	let staged = $derived(statuses.filter((s) => s.index_status && s.index_status !== '?'));
	// Derived: unstaged/untracked files (have worktree status or are untracked)
	let unstaged = $derived(
		statuses.filter(
			(s) => s.worktree_status || (s.index_status === '?' && s.worktree_status === '?')
		)
	);

	$effect(() => {
		if (gamePath) refresh();
	});

	async function refresh() {
		loading = true;
		try {
			statuses = await gitStatusDetailed(gamePath);
		} catch (e) {
			statuses = [];
		} finally {
			loading = false;
		}
	}

	async function handleStage(paths: string[]) {
		try {
			await gitStage(gamePath, paths);
			await refresh();
		} catch (e) {
			addToast(`Failed to stage: ${e}`, 'error');
		}
	}

	async function handleUnstage(paths: string[]) {
		try {
			await gitUnstage(gamePath, paths);
			await refresh();
		} catch (e) {
			addToast(`Failed to unstage: ${e}`, 'error');
		}
	}

	async function handleStageAll() {
		const paths = unstaged.map((s) => s.path);
		if (paths.length > 0) await handleStage(paths);
	}

	async function handleUnstageAll() {
		const paths = staged.map((s) => s.path);
		if (paths.length > 0) await handleUnstage(paths);
	}

	async function handleCommit() {
		if (!commitMessage.trim()) {
			addToast('Commit message cannot be empty', 'warning');
			return;
		}
		committing = true;
		try {
			await gitCommit(gamePath, commitMessage.trim());
			addToast('Changes committed successfully', 'success');
			commitMessage = '';
			diffPreview = null;
			await refresh();
			onCommitted?.();
		} catch (e) {
			addToast(`Commit failed: ${e}`, 'error');
		} finally {
			committing = false;
		}
	}

	async function handleShowDiff(path: string) {
		if (diffPreview?.path === path) {
			diffPreview = null;
			return;
		}
		try {
			const diff = await gitDiffFile(gamePath, path);
			diffPreview = { path, diff: diff || '(no diff available — file may be untracked)' };
		} catch {
			diffPreview = { path, diff: '(failed to load diff)' };
		}
	}

	function fileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'M': return 'Modified';
			case 'A': return 'Added';
			case 'D': return 'Deleted';
			case '?': return 'Untracked';
			case 'R': return 'Renamed';
			default: return status;
		}
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'M': return 'text-amber-400';
			case 'A': return 'text-emerald-400';
			case 'D': return 'text-red-400';
			case '?': return 'text-zinc-400';
			case 'R': return 'text-blue-400';
			default: return 'text-zinc-400';
		}
	}
</script>

<div class="flex h-full gap-4 overflow-hidden">
	<!-- Left: staged/unstaged lists + commit -->
	<div class="flex w-96 shrink-0 flex-col overflow-hidden">
		<!-- Unstaged changes -->
		<div class="flex flex-col overflow-hidden border-b border-zinc-800 pb-2">
			<div class="flex items-center justify-between px-1 py-1.5">
				<span class="text-xs font-semibold text-zinc-300">
					Changes ({unstaged.length})
				</span>
				{#if unstaged.length > 0}
					<button
						class="text-[10px] text-zinc-500 hover:text-zinc-300"
						onclick={handleStageAll}
					>
						Stage All
					</button>
				{/if}
			</div>
			<div class="max-h-40 overflow-y-auto">
				{#if loading}
					<div class="px-2 py-4 text-center text-xs text-zinc-600">Loading...</div>
				{:else if unstaged.length === 0}
					<div class="px-2 py-4 text-center text-xs text-zinc-600">No unstaged changes</div>
				{:else}
					{#each unstaged as file}
						<div class="group flex items-center gap-1.5 rounded px-2 py-1 hover:bg-zinc-800/50">
							<span class="w-4 text-center text-[10px] font-bold {statusColor(file.worktree_status || file.index_status)}">
								{file.worktree_status || file.index_status}
							</span>
							<button
								class="min-w-0 flex-1 truncate text-left text-xs text-zinc-400 hover:text-zinc-200"
								title={file.path}
								onclick={() => handleShowDiff(file.path)}
							>
								{fileName(file.path)}
							</button>
							<button
								class="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-zinc-300"
								onclick={() => handleStage([file.path])}
								title="Stage file"
							>
								+
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Staged changes -->
		<div class="flex flex-col overflow-hidden border-b border-zinc-800 pb-2">
			<div class="flex items-center justify-between px-1 py-1.5">
				<span class="text-xs font-semibold text-emerald-400">
					Staged ({staged.length})
				</span>
				{#if staged.length > 0}
					<button
						class="text-[10px] text-zinc-500 hover:text-zinc-300"
						onclick={handleUnstageAll}
					>
						Unstage All
					</button>
				{/if}
			</div>
			<div class="max-h-40 overflow-y-auto">
				{#if staged.length === 0}
					<div class="px-2 py-4 text-center text-xs text-zinc-600">No staged changes</div>
				{:else}
					{#each staged as file}
						<div class="group flex items-center gap-1.5 rounded px-2 py-1 hover:bg-zinc-800/50">
							<span class="w-4 text-center text-[10px] font-bold {statusColor(file.index_status)}">
								{file.index_status}
							</span>
							<button
								class="min-w-0 flex-1 truncate text-left text-xs text-zinc-300"
								title={file.path}
								onclick={() => handleShowDiff(file.path)}
							>
								{fileName(file.path)}
							</button>
							<button
								class="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-zinc-300"
								onclick={() => handleUnstage([file.path])}
								title="Unstage file"
							>
								−
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Commit area -->
		<div class="flex flex-col gap-2 pt-2">
			<textarea
				class="w-full resize-none rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
				rows="3"
				placeholder="Commit message..."
				bind:value={commitMessage}
				onkeydown={(e) => {
					if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						handleCommit();
					}
				}}
			></textarea>
			<button
				class="w-full rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
				disabled={staged.length === 0 || !commitMessage.trim() || committing}
				onclick={handleCommit}
			>
				{committing ? 'Committing...' : `Commit (${staged.length} file${staged.length !== 1 ? 's' : ''})`}
			</button>
			<div class="text-center text-[10px] text-zinc-600">Ctrl+Enter to commit</div>
		</div>

		<!-- Refresh button -->
		<div class="mt-auto pt-2">
			<button
				class="w-full rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
				onclick={refresh}
			>
				Refresh
			</button>
		</div>
	</div>

	<!-- Right: diff preview -->
	<div class="flex flex-1 flex-col overflow-hidden rounded border border-zinc-800">
		{#if diffPreview}
			<div class="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
				<span class="truncate text-xs text-zinc-300">{fileName(diffPreview.path)}</span>
				<button
					class="text-xs text-zinc-500 hover:text-zinc-300"
					onclick={() => (diffPreview = null)}
				>
					Close
				</button>
			</div>
			<pre class="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">{#each diffPreview.diff.split('\n') as line}<span class={line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400' : line.startsWith('-') && !line.startsWith('---') ? 'text-red-400' : line.startsWith('@@') ? 'text-blue-400' : 'text-zinc-500'}>{line}</span>
{/each}</pre>
		{:else}
			<div class="flex h-full items-center justify-center text-xs text-zinc-600">
				Click a file to preview its diff
			</div>
		{/if}
	</div>
</div>
