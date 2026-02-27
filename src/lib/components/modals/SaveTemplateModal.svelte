<script lang="ts">
	import { saveProjectTemplate } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';

	interface Props {
		open: boolean;
		gamePath: string;
		gameName: string;
		onclose: () => void;
		onsuccess?: () => void;
	}

	let { open, gamePath, gameName, onclose, onsuccess }: Props = $props();

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	let name = $state('');
	let description = $state('');
	let saving = $state(false);
	let selectedWorkspace = $state('');

	$effect(() => {
		if (open) {
			name = gameName;
			description = '';
			saving = false;
			selectedWorkspace = settings.workspaces[0] ?? '';
		}
	});

	async function handleSave() {
		if (!name.trim() || !selectedWorkspace) return;
		saving = true;
		try {
			const result = await saveProjectTemplate(gamePath, selectedWorkspace, name.trim(), description.trim());
			addToast(`Template "${result.meta.name}" saved (${result.file_count} files)`, 'success');
			onsuccess?.();
			onclose();
		} catch (e) {
			addToast(`Failed to save template: ${e}`, 'error');
		} finally {
			saving = false;
		}
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdrop}
		onkeydown={handleKeydown}
	>
		<div class="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
			<h2 class="mb-4 text-base font-semibold text-zinc-100">Save as Project Template</h2>

			<div class="space-y-3">
				<div>
					<label class="mb-1 block text-xs text-zinc-400">Template Name</label>
					<input
						type="text"
						class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
						bind:value={name}
						placeholder="My Template"
					/>
				</div>

				<div>
					<label class="mb-1 block text-xs text-zinc-400">Description (optional)</label>
					<textarea
						class="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
						rows="2"
						bind:value={description}
						placeholder="What this template is for..."
					></textarea>
				</div>

				{#if settings.workspaces.length > 1}
					<div>
						<label class="mb-1 block text-xs text-zinc-400">Save to Workspace</label>
						<select
							class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
							bind:value={selectedWorkspace}
						>
							{#each settings.workspaces as ws}
								<option value={ws}>{ws}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<div class="mt-5 flex justify-end gap-2">
				<button
					class="rounded border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
					onclick={onclose}
				>
					Cancel
				</button>
				<button
					class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
					disabled={!name.trim() || saving}
					onclick={handleSave}
				>
					{saving ? 'Saving...' : 'Save Template'}
				</button>
			</div>
		</div>
	</div>
{/if}
