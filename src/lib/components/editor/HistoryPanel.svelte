<script lang="ts">
	import type { SnapshotMeta } from '$lib/tauri/commands';
	import { formatSnapshotDate } from '$lib/utils/editor-helpers';
	import MonacoEditor from './MonacoEditor.svelte';

	interface Props {
		snapshots: SnapshotMeta[];
		snapshotsLoading: boolean;
		snapshotPreview: { id: string; content: string } | null;
		renamingSnapshotId: string | null;
		renameLabel: string;
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
		onCreateSnapshot,
		onPreviewSnapshot,
		onRollback,
		onDeleteSnapshot,
		onStartRename,
		onCancelRename,
		onRenameSnapshot,
		onRenameLabelChange
	}: Props = $props();
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
			Config Snapshots
		</h2>
		<button
			class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
			onclick={onCreateSnapshot}
		>
			Create Snapshot
		</button>
	</div>

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
