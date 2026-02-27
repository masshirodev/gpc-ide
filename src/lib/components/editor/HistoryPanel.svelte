<script lang="ts">
	import type { SnapshotMeta } from '$lib/tauri/commands';
	import { getSnapshot } from '$lib/tauri/commands';
	import { formatSnapshotDate } from '$lib/utils/editor-helpers';
	import { addToast } from '$lib/stores/toast.svelte';
	import MonacoEditor from './MonacoEditor.svelte';
	import DiffViewer from './DiffViewer.svelte';

	interface Props {
		snapshots: SnapshotMeta[];
		snapshotsLoading: boolean;
		snapshotPreview: { id: string; content: string } | null;
		renamingSnapshotId: string | null;
		renameLabel: string;
		gamePath: string;
		currentConfigContent?: string;
		onCreateSnapshot: () => void;
		onPreviewSnapshot: (id: string) => void;
		onRollback: (id: string) => void;
		onDeleteSnapshot: (id: string) => void;
		onStartRename: (id: string, label: string) => void;
		onCancelRename: () => void;
		onRenameSnapshot: (id: string) => void;
		onRenameLabelChange: (value: string) => void;
	}

	let {
		snapshots,
		snapshotsLoading,
		snapshotPreview,
		renamingSnapshotId,
		renameLabel,
		gamePath,
		currentConfigContent = '',
		onCreateSnapshot,
		onPreviewSnapshot,
		onRollback,
		onDeleteSnapshot,
		onStartRename,
		onCancelRename,
		onRenameSnapshot,
		onRenameLabelChange
	}: Props = $props();

	// --- Diff comparison ---
	let diffMode = $state(false);
	let diffLeftId = $state<string | null>(null);
	let diffRightId = $state<string | null>(null);
	let diffLeftContent = $state('');
	let diffRightContent = $state('');
	let diffLoading = $state(false);

	function getSnapshotLabel(id: string): string {
		if (id === '__current__') return 'Current';
		const snap = snapshots.find(s => s.id === id);
		return snap?.label ?? formatSnapshotDate(snap?.timestamp ?? 0);
	}

	async function startCompare() {
		if (!diffLeftId || !diffRightId || !gamePath) return;
		diffLoading = true;
		try {
			const [left, right] = await Promise.all([
				diffLeftId === '__current__'
					? Promise.resolve(currentConfigContent)
					: getSnapshot(gamePath, diffLeftId),
				diffRightId === '__current__'
					? Promise.resolve(currentConfigContent)
					: getSnapshot(gamePath, diffRightId)
			]);
			diffLeftContent = left;
			diffRightContent = right;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			addToast(`Failed to load snapshot for diff: ${msg}`, 'error');
		} finally {
			diffLoading = false;
		}
	}

	function closeDiff() {
		diffMode = false;
		diffLeftId = null;
		diffRightId = null;
		diffLeftContent = '';
		diffRightContent = '';
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
			Config Snapshots
		</h2>
		<div class="flex items-center gap-2">
			{#if snapshots.length >= 1}
				<button
					class="rounded border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 {diffMode ? 'border-emerald-600 text-emerald-400' : ''}"
					onclick={() => { diffMode = !diffMode; if (!diffMode) closeDiff(); }}
				>
					Compare
				</button>
			{/if}
			<button
				class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
				onclick={onCreateSnapshot}
			>
				Create Snapshot
			</button>
		</div>
	</div>

	<!-- Diff Compare Panel -->
	{#if diffMode}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
			<div class="mb-3 flex items-center gap-3">
				<div class="flex-1">
					<label class="mb-1 block text-xs text-zinc-500">Left (original)</label>
					<select
						class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
						value={diffLeftId ?? ''}
						onchange={(e) => { diffLeftId = (e.target as HTMLSelectElement).value || null; }}
					>
						<option value="">Select...</option>
						<option value="__current__">Current config</option>
						{#each snapshots as snap}
							<option value={snap.id}>{snap.label ?? formatSnapshotDate(snap.timestamp)}</option>
						{/each}
					</select>
				</div>
				<div class="flex-1">
					<label class="mb-1 block text-xs text-zinc-500">Right (modified)</label>
					<select
						class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
						value={diffRightId ?? ''}
						onchange={(e) => { diffRightId = (e.target as HTMLSelectElement).value || null; }}
					>
						<option value="">Select...</option>
						<option value="__current__">Current config</option>
						{#each snapshots as snap}
							<option value={snap.id}>{snap.label ?? formatSnapshotDate(snap.timestamp)}</option>
						{/each}
					</select>
				</div>
				<div class="pt-4">
					<button
						class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
						onclick={startCompare}
						disabled={!diffLeftId || !diffRightId || diffLeftId === diffRightId || diffLoading}
					>
						{diffLoading ? 'Loading...' : 'Diff'}
					</button>
				</div>
			</div>
			{#if diffLeftContent && diffRightContent}
				<div class="h-96 overflow-hidden rounded border border-zinc-800">
					<DiffViewer
						originalValue={diffLeftContent}
						modifiedValue={diffRightContent}
						originalLabel={getSnapshotLabel(diffLeftId ?? '')}
						modifiedLabel={getSnapshotLabel(diffRightId ?? '')}
					/>
				</div>
			{/if}
		</div>
	{/if}

	{#if snapshotsLoading}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
			Loading snapshots...
		</div>
	{:else if snapshots.length === 0}
		<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
			No snapshots yet. Create one to save the current config state.
		</div>
	{:else}
		<div class="space-y-2">
			{#each snapshots as snapshot}
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
					<div class="flex items-center justify-between">
						<div>
							{#if renamingSnapshotId === snapshot.id}
								<form
									class="flex items-center gap-2"
									onsubmit={(e) => {
										e.preventDefault();
										onRenameSnapshot(snapshot.id);
									}}
								>
									<input
										class="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-sm text-zinc-200"
										value={renameLabel}
										oninput={(e) => onRenameLabelChange(e.currentTarget.value)}
										placeholder="Snapshot label"
									/>
									<button
										type="submit"
										class="text-xs text-emerald-400 hover:text-emerald-300"
									>
										Save
									</button>
									<button
										type="button"
										class="text-xs text-zinc-500 hover:text-zinc-300"
										onclick={onCancelRename}
									>
										Cancel
									</button>
								</form>
							{:else}
								<button
									class="text-sm font-medium text-zinc-200 hover:text-zinc-100"
									onclick={() => {
										onStartRename(snapshot.id, snapshot.label ?? '');
									}}
									title="Click to rename"
								>
									{snapshot.label ?? 'Unnamed snapshot'}
								</button>
							{/if}
							<div class="text-xs text-zinc-500">{formatSnapshotDate(snapshot.timestamp)}</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
								onclick={() => onPreviewSnapshot(snapshot.id)}
							>
								{snapshotPreview?.id === snapshot.id ? 'Hide' : 'Preview'}
							</button>
							<button
								class="rounded border border-zinc-700 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30 hover:text-amber-300"
								onclick={() => onRollback(snapshot.id)}
							>
								Rollback
							</button>
							<button
								class="rounded border border-zinc-700 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300"
								onclick={() => onDeleteSnapshot(snapshot.id)}
							>
								Delete
							</button>
						</div>
					</div>
					{#if snapshotPreview?.id === snapshot.id}
						<div class="mt-3 overflow-hidden rounded border border-zinc-800">
							<div class="h-80">
								<MonacoEditor
									value={snapshotPreview.content}
									language="ini"
									readonly={true}
								/>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
