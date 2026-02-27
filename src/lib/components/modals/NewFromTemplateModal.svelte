<script lang="ts">
	import {
		listProjectTemplates,
		createGameFromTemplate,
		deleteProjectTemplate
	} from '$lib/tauri/commands';
	import type { ProjectTemplateInfo } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { loadGames, selectGame } from '$lib/stores/game.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	let templates = $state<ProjectTemplateInfo[]>([]);
	let loading = $state(false);
	let selectedTemplate = $state<ProjectTemplateInfo | null>(null);
	let gameName = $state('');
	let selectedWorkspace = $state('');
	let creating = $state(false);

	$effect(() => {
		if (open) {
			loadTemplates();
			gameName = '';
			selectedTemplate = null;
			selectedWorkspace = settings.workspaces[0] ?? '';
		}
	});

	async function loadTemplates() {
		loading = true;
		try {
			templates = await listProjectTemplates(settings.workspaces);
		} catch (e) {
			templates = [];
		} finally {
			loading = false;
		}
	}

	async function handleCreate() {
		if (!selectedTemplate || !gameName.trim() || !selectedWorkspace) return;
		creating = true;
		try {
			const gamePath = await createGameFromTemplate(
				selectedTemplate.path,
				gameName.trim(),
				selectedWorkspace
			);
			addToast(`Game "${gameName.trim()}" created from template`, 'success');
			await loadGames(settings.workspaces);
			onclose();
		} catch (e) {
			addToast(`Failed to create game: ${e}`, 'error');
		} finally {
			creating = false;
		}
	}

	async function handleDelete(tpl: ProjectTemplateInfo, e: MouseEvent) {
		e.stopPropagation();
		try {
			await deleteProjectTemplate(tpl.path);
			addToast(`Template "${tpl.meta.name}" deleted`, 'success');
			if (selectedTemplate?.id === tpl.id) selectedTemplate = null;
			await loadTemplates();
		} catch (e) {
			addToast(`Failed to delete: ${e}`, 'error');
		}
	}

	function formatDate(ts: number): string {
		return new Date(ts * 1000).toLocaleDateString();
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
		<div class="flex h-[28rem] w-full max-w-2xl flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<div class="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
				<h2 class="text-base font-semibold text-zinc-100">New Game from Template</h2>
				<button class="text-zinc-500 hover:text-zinc-300" onclick={onclose}>
					<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>

			<div class="flex min-h-0 flex-1">
				<!-- Template list -->
				<div class="w-64 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
					{#if loading}
						<div class="py-8 text-center text-xs text-zinc-600">Loading...</div>
					{:else if templates.length === 0}
						<div class="py-8 text-center text-xs text-zinc-600">
							No project templates yet.<br />
							Save a game as a template first.
						</div>
					{:else}
						<div class="space-y-1">
							{#each templates as tpl}
								<button
									class="group flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors {selectedTemplate?.id === tpl.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
									onclick={() => (selectedTemplate = tpl)}
								>
									<div class="min-w-0 flex-1">
										<div class="truncate text-xs font-medium">{tpl.meta.name}</div>
										<div class="mt-0.5 text-[10px] text-zinc-500">
											{tpl.meta.game_type.toUpperCase()} &middot; {tpl.file_count} files
										</div>
									</div>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<span
										class="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400"
										role="button"
										tabindex="-1"
										onclick={(e) => handleDelete(tpl, e)}
										title="Delete template"
									>
										<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
										</svg>
									</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Details / form -->
				<div class="flex flex-1 flex-col p-4">
					{#if selectedTemplate}
						<div class="mb-4">
							<h3 class="text-sm font-medium text-zinc-200">{selectedTemplate.meta.name}</h3>
							{#if selectedTemplate.meta.description}
								<p class="mt-1 text-xs text-zinc-500">{selectedTemplate.meta.description}</p>
							{/if}
							<div class="mt-2 flex gap-2 text-[10px] text-zinc-500">
								<span class="rounded bg-zinc-800 px-1.5 py-0.5 uppercase">{selectedTemplate.meta.game_type}</span>
								<span class="rounded bg-zinc-800 px-1.5 py-0.5 uppercase">{selectedTemplate.meta.console_type}</span>
								<span>{selectedTemplate.file_count} files</span>
								<span>Created {formatDate(selectedTemplate.meta.created_at)}</span>
							</div>
						</div>

						<div class="space-y-3">
							<div>
								<label class="mb-1 block text-xs text-zinc-400">New Game Name</label>
								<input
									type="text"
									class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
									bind:value={gameName}
									placeholder="my-new-game"
								/>
							</div>

							{#if settings.workspaces.length > 1}
								<div>
									<label class="mb-1 block text-xs text-zinc-400">Workspace</label>
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

						<div class="mt-auto pt-4">
							<button
								class="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
								disabled={!gameName.trim() || creating}
								onclick={handleCreate}
							>
								{creating ? 'Creating...' : 'Create Game'}
							</button>
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-xs text-zinc-600">
							Select a template to get started
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
