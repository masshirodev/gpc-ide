<script lang="ts">
	import type { ModuleNodeData, WeaponADTProfile } from '$lib/types/flow';
	import { addToast } from '$lib/stores/toast.svelte';

	interface Props {
		open: boolean;
		moduleData: ModuleNodeData | null;
		/** Weapon names from the weapondata module node */
		weaponNames: string[];
		onclose: () => void;
		onsave: (updates: Partial<ModuleNodeData>) => void;
	}

	let { open, moduleData, weaponNames, onclose, onsave }: Props = $props();

	let profiles = $state<WeaponADTProfile[]>([]);
	let pasteText = $state('');
	let showPaste = $state(false);
	let rowPasteIndex = $state<number | null>(null);
	let rowPasteText = $state('');

	const FIELDS = ['mode', 'start', 'force1', 'force2', 'strLow', 'strMid', 'strHigh', 'freq'] as const;
	const FIELD_LABELS = ['Mode', 'Start', 'F1', 'F2', 'StrL', 'StrM', 'StrH', 'Freq'];

	function emptyProfile(weaponIndex: number): WeaponADTProfile {
		return { weaponIndex, mode: 0, start: 0, force1: 0, force2: 0, strLow: 0, strMid: 0, strHigh: 0, freq: 0 };
	}

	function isProfileEmpty(p: WeaponADTProfile): boolean {
		return FIELDS.every((f) => p[f] === 0);
	}

	function profileKey(p: WeaponADTProfile): string {
		return FIELDS.map((f) => p[f]).join(',');
	}

	/** Map from profile index to names of other weapons sharing the same signature */
	let duplicates = $derived.by(() => {
		const map = new Map<number, string[]>();
		// Group indices by signature key
		const groups = new Map<string, number[]>();
		for (let i = 0; i < profiles.length; i++) {
			if (isProfileEmpty(profiles[i])) continue;
			const key = profileKey(profiles[i]);
			let g = groups.get(key);
			if (!g) { g = []; groups.set(key, g); }
			g.push(i);
		}
		// Mark all members of groups with 2+ entries
		for (const indices of groups.values()) {
			if (indices.length < 2) continue;
			for (const i of indices) {
				map.set(i, indices.filter((j) => j !== i).map((j) => getWeaponName(profiles[j].weaponIndex)));
			}
		}
		return map;
	});

	$effect(() => {
		if (open && moduleData) {
			const existing = moduleData.adpProfiles ?? [];
			// Build profiles for each weapon (1-based index, 0 = auto/none)
			profiles = weaponNames.map((_, i) => {
				const idx = i + 1;
				const found = existing.find((p) => p.weaponIndex === idx);
				return found ? { ...found } : emptyProfile(idx);
			});
			pasteText = '';
			showPaste = false;
		}
	});

	function getWeaponName(weaponIndex: number): string {
		if (weaponIndex <= 0 || weaponIndex > weaponNames.length) return `Weapon ${weaponIndex}`;
		return weaponNames[weaponIndex - 1];
	}

	/** Format a number as 0x hex string */
	function toHex(v: number): string {
		return '0x' + (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
	}

	/** Parse a hex or decimal string to a number */
	function parseValue(s: string): number {
		s = s.trim();
		if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16) || 0;
		return parseInt(s, 10) || 0;
	}

	function updateProfile(index: number, field: keyof WeaponADTProfile, value: number) {
		const p = [...profiles];
		p[index] = { ...p[index], [field]: Math.max(0, Math.min(255, value)) };
		profiles = p;
	}

	function handlePaste() {
		const text = pasteText.trim();
		if (!text) return;

		// Parse pasted data. Expected format per line (comma or tab separated):
		// Mode, Start, F1, F2, StrLow, StrMid, StrHigh, Freq
		// Or with weapon name prefix:
		// Name, Mode, Start, F1, F2, StrLow, StrMid, StrHigh, Freq
		// Values can be hex (0x26) or decimal (38)
		const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
		let imported = 0;

		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			// Strip comments (// or /* */)
			const line = lines[lineIdx].replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
			if (!line) continue;

			// Remove surrounding braces if present (from GPC array syntax)
			const cleaned = line.replace(/^\{/, '').replace(/\}[,;]?\s*$/, '').trim();
			const parts = cleaned.split(/[\t,]+/).map((p) => p.trim()).filter(Boolean);
			if (parts.length === 0) continue;

			let targetIdx = lineIdx;
			let values: number[];

			// If first part looks like a hex/number, treat as pure values
			const firstIsNumber = /^(0x[\da-fA-F]+|\d+)$/.test(parts[0]);

			if (firstIsNumber && parts.length >= 8) {
				// Pure values: Mode, Start, F1, F2, StrLow, StrMid, StrHigh, Freq
				// (may have the 3 padding zeros from full 11-column format)
				const nums = parts.map(parseValue);
				if (parts.length >= 11) {
					// Full 11-column format: Mode, Start, F1, F2, StrL, StrM, StrH, 0, 0, Freq, 0
					values = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], nums[6], nums[9]];
				} else {
					// 8-column format: Mode, Start, F1, F2, StrL, StrM, StrH, Freq
					values = nums.slice(0, 8);
				}
			} else if (!firstIsNumber && parts.length >= 9) {
				// Name + values
				const name = parts[0];
				const nameIdx = weaponNames.findIndex(
					(w) => w.toLowerCase() === name.toLowerCase()
				);
				if (nameIdx >= 0) targetIdx = nameIdx;
				const nums = parts.slice(1).map(parseValue);
				if (parts.length >= 12) {
					values = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], nums[6], nums[9]];
				} else {
					values = nums.slice(0, 8);
				}
			} else {
				continue;
			}

			if (targetIdx < profiles.length) {
				profiles[targetIdx] = {
					...profiles[targetIdx],
					mode: values[0] & 0xff,
					start: values[1] & 0xff,
					force1: values[2] & 0xff,
					force2: values[3] & 0xff,
					strLow: values[4] & 0xff,
					strMid: values[5] & 0xff,
					strHigh: values[6] & 0xff,
					freq: values[7] & 0xff,
				};
				imported++;
			}
		}

		if (imported > 0) {
			profiles = [...profiles];
			addToast(`Imported ADP values for ${imported} weapons`, 'success');
		} else {
			addToast('No valid ADP data found', 'error');
		}
		pasteText = '';
		showPaste = false;
	}

	function clearAllValues() {
		profiles = profiles.map((p) => emptyProfile(p.weaponIndex));
	}

	function handleSave() {
		// Only save profiles that have non-zero values
		const nonEmpty = profiles.filter((p) => !isProfileEmpty(p));
		onsave({ adpProfiles: nonEmpty });
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.stopPropagation();
			e.preventDefault();
			onclose();
		}
	}

	function copyAsText() {
		const lines = profiles.map((p) => {
			const name = getWeaponName(p.weaponIndex);
			const vals = FIELDS.map((f) => toHex(p[f]));
			return `${name}\t${vals.join('\t')}`;
		});
		navigator.clipboard.writeText(lines.join('\n'));
		addToast('Copied ADP values to clipboard', 'success');
	}

	/** Parse a single { ... } object and apply it to a specific row */
	function parseRowObject(text: string): number[] | null {
		const cleaned = text.replace(/\/\/.*$/gm, '').replace(/\/\*.*?\*\//g, '')
			.replace(/^\{/, '').replace(/\}[,;]?\s*$/, '').trim();
		const parts = cleaned.split(/[\t,]+/).map((p) => p.trim()).filter(Boolean);
		if (parts.length < 8) return null;
		const nums = parts.map(parseValue);
		if (parts.length >= 11) {
			// Full 11-column: Mode, Start, F1, F2, StrL, StrM, StrH, 0, 0, Freq, 0
			return [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], nums[6], nums[9]];
		}
		// 8-column: Mode, Start, F1, F2, StrL, StrM, StrH, Freq
		return nums.slice(0, 8);
	}

	function applyRowPaste() {
		if (rowPasteIndex === null) return;
		const values = parseRowObject(rowPasteText.trim());
		if (!values) {
			addToast('Invalid format', 'error');
			return;
		}
		const p = [...profiles];
		p[rowPasteIndex] = {
			...p[rowPasteIndex],
			mode: values[0] & 0xff,
			start: values[1] & 0xff,
			force1: values[2] & 0xff,
			force2: values[3] & 0xff,
			strLow: values[4] & 0xff,
			strMid: values[5] & 0xff,
			strHigh: values[6] & 0xff,
			freq: values[7] & 0xff,
		};
		profiles = p;
		addToast(`Applied values to ${getWeaponName(profiles[rowPasteIndex].weaponIndex)}`, 'success');
		rowPasteIndex = null;
		rowPasteText = '';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		onmousedown={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); onclose(); } }}
	>
		<div class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
				<div>
					<h2 class="text-lg font-semibold text-zinc-100">Weapon Detection (ADP)</h2>
					<p class="text-xs text-zinc-500">Configure PS5 adaptive trigger signatures per weapon — generates <code class="text-zinc-400">ADP_Values[][]</code></p>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
						onclick={copyAsText}
						title="Copy all values to clipboard"
					>
						Copy
					</button>
					<button
						class="rounded px-2 py-1 text-xs {showPaste ? 'bg-amber-600 text-white' : 'text-amber-400 hover:bg-zinc-800'}"
						onclick={() => { showPaste = !showPaste; }}
					>
						Paste
					</button>
					<button
						class="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
						onclick={clearAllValues}
						title="Reset all ADP values to 0"
					>
						Clear
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
						Paste ADP values — one weapon per line. Accepts hex or decimal. Format: <code class="text-zinc-300">Mode, Start, F1, F2, StrL, StrM, StrH, Freq</code> or full 11-column GPC format.
					</p>
					<textarea
						class="mb-2 h-24 w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
						bind:value={pasteText}
						placeholder={"{ 0x26, 0xF8, 0x03, 0x00, 0xB6, 0x6D, 0x1B, 0, 0, 0x0B, 0 },\n{ 0x26, 0xF8, 0x03, 0x00, 0xB6, 0x6D, 0x1B, 0, 0, 0x0A, 0 },"}
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

			<!-- ADP table -->
			<div class="min-h-0 flex-1 overflow-auto px-5 py-3">
				{#if profiles.length > 0}
					<table class="w-full">
						<thead>
							<tr class="text-left text-xs text-zinc-500">
								<th class="w-6 pb-2 text-center">#</th>
								<th class="pb-2 pl-1">Weapon</th>
								{#each FIELD_LABELS as label}
									<th class="w-[4.5rem] pb-2 text-center">{label}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each profiles as profile, i}
								{@const empty = isProfileEmpty(profile)}
								{@const dupOf = duplicates.get(i)}
								<tr class="group border-t border-zinc-800 {empty ? 'opacity-40' : ''} {dupOf ? 'bg-amber-950/20' : ''}">
									<td class="py-0.5 text-center text-xs text-zinc-600">{profile.weaponIndex}</td>
									<td class="py-0.5 pl-1 pr-2">
										<span class="text-sm text-zinc-200">{getWeaponName(profile.weaponIndex)}</span>
										{#if dupOf}
											<span class="ml-1 text-[10px] text-amber-500" title="Same signature — ADP won't distinguish them">= {dupOf.join(', ')}</span>
										{/if}
									</td>
									{#each FIELDS as field}
										<td class="py-0.5 px-0.5">
											<input
												type="text"
												class="w-full rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
												value={toHex(profile[field])}
												onchange={(e) => updateProfile(i, field, parseValue((e.target as HTMLInputElement).value))}
											/>
										</td>
									{/each}
									<td class="py-0.5 pl-1">
										<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
											<button
												class="rounded p-0.5 text-zinc-600 hover:text-amber-400"
												title="Paste row"
												onclick={() => { rowPasteIndex = rowPasteIndex === i ? null : i; rowPasteText = ''; }}
											>
												<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
											</button>
											{#if !empty}
												<button
													class="rounded p-0.5 text-zinc-600 hover:text-red-400"
													title="Clear row"
													onclick={() => { const p = [...profiles]; p[i] = emptyProfile(profile.weaponIndex); profiles = p; }}
												>
													<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											{/if}
										</div>
									</td>
								</tr>
								{#if rowPasteIndex === i}
									<tr class="border-t border-zinc-800/50">
										<td></td>
										<td colspan={FIELDS.length + 1} class="py-1.5 pr-2 pl-1">
											<form class="flex items-center gap-2" onsubmit={(e) => { e.preventDefault(); applyRowPaste(); }}>
												<input
													type="text"
													class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
													bind:value={rowPasteText}
													placeholder="0x26, 0xF8, 0x03, 0x00, 0xB6, 0x6D, 0x1B, 0, 0, 0x0B, 0"
												/>
												<button
													type="submit"
													class="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
													disabled={!rowPasteText.trim()}
												>
													Apply
												</button>
												<button
													type="button"
													class="rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
													onclick={() => { rowPasteIndex = null; rowPasteText = ''; }}
												>
													Cancel
												</button>
											</form>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				{:else}
					<div class="flex flex-col items-center justify-center py-10 text-zinc-500">
						<svg class="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
						<p class="text-sm">No weapons configured</p>
						<p class="text-xs text-zinc-600">Add weapons in the Weapon Data module first</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="border-t border-zinc-700 px-5 py-3">
				<div class="flex items-center justify-between">
					<p class="text-xs text-zinc-500">
						{profiles.filter((p) => !isProfileEmpty(p)).length} of {profiles.length} weapons have ADP signatures
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
