<script lang="ts">
	import type { ModuleNodeData } from '$lib/types/flow';
	import { addToast } from '$lib/stores/toast.svelte';

	interface Props {
		open: boolean;
		moduleData: ModuleNodeData | null;
		onclose: () => void;
		onsave: (updates: Partial<ModuleNodeData>) => void;
	}

	let { open, moduleData, onclose, onsave }: Props = $props();

	let weaponNames = $state<string[]>([]);
	let newWeaponName = $state('');
	let pasteText = $state('');
	let showPaste = $state(false);

	$effect(() => {
		if (open && moduleData) {
			weaponNames = [...(moduleData.weaponNames ?? [])];
			newWeaponName = '';
			pasteText = '';
			showPaste = false;
		}
	});

	function addWeapon() {
		const name = newWeaponName.trim();
		if (!name || weaponNames.includes(name)) {
			newWeaponName = '';
			return;
		}
		weaponNames = [...weaponNames, name];
		newWeaponName = '';
	}

	function removeWeapon(index: number) {
		weaponNames = weaponNames.filter((_, i) => i !== index);
	}

	function handlePaste() {
		const text = pasteText.trim();
		if (!text) return;

		const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
		const names: string[] = [];

		for (const line of lines) {
			// Take the first column if comma/tab separated, otherwise the whole line
			const parts = line.split(/[\t,]+/).map((p) => p.trim());
			const name = parts[0];
			if (name) names.push(name);
		}

		weaponNames = names;
		pasteText = '';
		showPaste = false;
		addToast(`Imported ${names.length} weapons`, 'success');
	}

	function handleSave() {
		onsave({
			weaponNames: [...weaponNames],
		});
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.stopPropagation();
			e.preventDefault();
			onclose();
		}
	}

	function moveWeapon(from: number, to: number) {
		if (to < 0 || to >= weaponNames.length) return;
		const names = [...weaponNames];
		const [name] = names.splice(from, 1);
		names.splice(to, 0, name);
		weaponNames = names;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onmousedown={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); onclose(); } }}
	>
		<div class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
				<h2 class="text-lg font-semibold text-zinc-100">Weapon Data</h2>
				<div class="flex items-center gap-2">
					<button
						class="rounded px-2 py-1 text-xs {showPaste ? 'bg-amber-600 text-white' : 'text-amber-400 hover:bg-zinc-800'}"
						onclick={() => { showPaste = !showPaste; }}
					>
						Paste
					</button>
					<button
						class="text-zinc-500 hover:text-zinc-300"
						onclick={onclose}
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Paste area (collapsible) -->
			{#if showPaste}
				<div class="border-b border-zinc-700 bg-zinc-800/50 px-5 py-3">
					<p class="mb-1.5 text-xs text-zinc-400">
						Paste weapon names — one per line.
					</p>
					<textarea
						class="mb-2 h-24 w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
						bind:value={pasteText}
						placeholder={"M4A1\nAK-47\nMP5"}
					></textarea>
					<button
						class="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
						disabled={!pasteText.trim()}
						onclick={handlePaste}
					>
						Import
					</button>
				</div>
			{/if}

			<!-- Weapon list -->
			<div class="min-h-0 flex-1 overflow-auto px-5 py-3">
				{#if weaponNames.length > 0}
					<table class="w-full">
						<thead>
							<tr class="text-left text-xs text-zinc-500">
								<th class="w-8 pb-2 text-center">#</th>
								<th class="pb-2">Weapon</th>
								<th class="w-20 pb-2"></th>
							</tr>
						</thead>
						<tbody>
							{#each weaponNames as weapon, i}
								<tr class="group border-t border-zinc-800">
									<td class="py-1 text-center text-xs text-zinc-600">{i}</td>
									<td class="py-1 pr-2">
										<input
											type="text"
											class="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-zinc-200 hover:border-zinc-700 focus:border-emerald-500 focus:bg-zinc-800 focus:outline-none"
											value={weapon}
											onchange={(e) => {
												const val = (e.target as HTMLInputElement).value.trim();
												if (val) {
													const names = [...weaponNames];
													names[i] = val;
													weaponNames = names;
												}
											}}
										/>
									</td>
									<td class="py-1">
										<div class="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100">
											<button
												class="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
												title="Move up"
												disabled={i === 0}
												onclick={() => moveWeapon(i, i - 1)}
											>
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
											</button>
											<button
												class="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
												title="Move down"
												disabled={i === weaponNames.length - 1}
												onclick={() => moveWeapon(i, i + 1)}
											>
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
											</button>
											<button
												class="rounded p-0.5 text-zinc-600 hover:text-red-400"
												title="Remove {weapon}"
												onclick={() => removeWeapon(i)}
											>
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<div class="flex flex-col items-center justify-center py-10 text-zinc-500">
						<svg class="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
						<p class="text-sm">No weapons configured</p>
						<p class="text-xs text-zinc-600">Add weapons below or paste data above</p>
					</div>
				{/if}
			</div>

			<!-- Add weapon + footer -->
			<div class="border-t border-zinc-700 px-5 py-3">
				<form
					class="mb-3 flex items-center gap-2"
					onsubmit={(e) => { e.preventDefault(); addWeapon(); }}
				>
					<input
						type="text"
						class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
						bind:value={newWeaponName}
						placeholder="Add weapon name..."
					/>
					<button
						type="submit"
						class="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
						disabled={!newWeaponName.trim()}
					>
						+ Add
					</button>
				</form>
				<div class="flex items-center justify-between">
					<p class="text-xs text-zinc-500">
						{weaponNames.length} weapons — generates <code class="text-zinc-400">Weapons[]</code>, <code class="text-zinc-400">WEAPON_COUNT</code>, <code class="text-zinc-400">WEAPON_MAX_INDEX</code>
					</p>
					<div class="flex gap-2">
						<button
							class="rounded border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
							onclick={onclose}
						>
							Cancel
						</button>
						<button
							class="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
							onclick={handleSave}
						>
							Save
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
