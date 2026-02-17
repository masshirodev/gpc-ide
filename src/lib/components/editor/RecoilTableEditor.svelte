<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { goto } from '$app/navigation';
    import { readFile } from '$lib/tauri/commands';
    import {
        parseRecoilTable,
        parseWeaponNames,
        serializeRecoilTable,
        updateWeaponValues,
        PHASE_LABELS,
        type WeaponRecoilEntry
    } from '$lib/utils/recoil-parser';
    import { setRecoilTransfer, getRecoilTransfer, clearRecoilTransfer } from '$lib/stores/recoil-transfer.svelte';

    interface Props {
        content: string;
        gamePath: string;
        filePath?: string;
        onchange: (newContent: string) => void;
    }

    let { content, gamePath, filePath, onchange }: Props = $props();

    let entries = $state<WeaponRecoilEntry[]>([]);
    let weaponNames = $state<string[]>([]);
    let selectedWeaponIdx = $state(0);
    let loadError = $state<string | null>(null);
    let loading = $state(true);

    // Searchable weapon select state
    let searchQuery = $state('');
    let dropdownOpen = $state(false);
    let highlightedIdx = $state(-1);
    let searchInputEl = $state<HTMLInputElement | null>(null);
    let dropdownEl = $state<HTMLDivElement | null>(null);

    let selectedEntry = $derived(
        entries.find((e) => e.index === selectedWeaponIdx) ?? null
    );

    function weaponLabel(entry: WeaponRecoilEntry): string {
        const name = getWeaponDisplayName(entry.index);
        return entry.type ? `${entry.index}. ${name} (${entry.type})` : `${entry.index}. ${name}`;
    }

    let filteredEntries = $derived.by(() => {
        if (!searchQuery.trim()) return entries;
        const q = searchQuery.toLowerCase();
        return entries.filter((e) => {
            const name = getWeaponDisplayName(e.index).toLowerCase();
            const idx = String(e.index);
            const type = e.type.toLowerCase();
            return name.includes(q) || idx.includes(q) || type.includes(q);
        });
    });

    function selectWeapon(index: number) {
        selectedWeaponIdx = index;
        searchQuery = '';
        dropdownOpen = false;
        highlightedIdx = -1;
    }

    function handleSearchKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!dropdownOpen) { dropdownOpen = true; highlightedIdx = 0; return; }
            highlightedIdx = Math.min(highlightedIdx + 1, filteredEntries.length - 1);
            scrollHighlightedIntoView();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIdx = Math.max(highlightedIdx - 1, 0);
            scrollHighlightedIntoView();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIdx >= 0 && highlightedIdx < filteredEntries.length) {
                selectWeapon(filteredEntries[highlightedIdx].index);
            }
        } else if (e.key === 'Escape') {
            dropdownOpen = false;
            searchQuery = '';
            highlightedIdx = -1;
        }
    }

    function scrollHighlightedIntoView() {
        requestAnimationFrame(() => {
            dropdownEl?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
        });
    }

    function handleClickOutside(e: MouseEvent) {
        const target = e.target as Node;
        if (!searchInputEl?.closest('.weapon-search')?.contains(target)) {
            dropdownOpen = false;
            searchQuery = '';
            highlightedIdx = -1;
        }
    }

    // Parse the recoil table from content - only track `content` as dependency
    $effect(() => {
        const parsed = parseRecoilTable(content);
        untrack(() => {
            entries = parsed;
            if (parsed.length > 0 && !parsed.find((e) => e.index === selectedWeaponIdx)) {
                selectedWeaponIdx = parsed[0].index;
            }
        });
    });

    // Load weapon names from weapondata.gpc in the same game directory
    onMount(async () => {
        const candidates = [
            `${gamePath}/modules/weapondata.gpc`,
            `${gamePath}/weapondata.gpc`
        ];
        for (const path of candidates) {
            try {
                const fileContent = await readFile(path);
                const names = parseWeaponNames(fileContent);
                if (names.length > 0) {
                    weaponNames = names;
                    break;
                }
            } catch {
                // Try next candidate
            }
        }
        if (weaponNames.length === 0) {
            // Fallback: use names from table comments
            weaponNames = entries.map((e) => e.name);
        }

        // Restore weapon index and apply values from spray tool transfer
        const transfer = getRecoilTransfer();
        if (transfer) {
            selectedWeaponIdx = transfer.weaponIndex;
            if (transfer.values.length > 0) {
                entries = updateWeaponValues(entries, transfer.weaponIndex, transfer.values);
                onchange(serializeRecoilTable(content, entries));
            }
            clearRecoilTransfer();
        }

        loading = false;
    });

    function getWeaponDisplayName(index: number): string {
        if (index < weaponNames.length) return weaponNames[index];
        const entry = entries.find((e) => e.index === index);
        return entry?.name ?? `Weapon ${index}`;
    }

    function handleValueChange(phaseIdx: number, component: 'v' | 'h', value: number) {
        if (!selectedEntry) return;
        const valIdx = component === 'v' ? phaseIdx * 2 : phaseIdx * 2 + 1;
        const newValues = [...selectedEntry.values];
        newValues[valIdx] = Math.max(-100, Math.min(100, value));
        entries = updateWeaponValues(entries, selectedWeaponIdx, newValues);
        onchange(serializeRecoilTable(content, entries));
    }

    function handleSendToTool() {
        if (!selectedEntry) return;
        setRecoilTransfer({
            weaponName: getWeaponDisplayName(selectedWeaponIdx),
            weaponIndex: selectedWeaponIdx,
            values: [...selectedEntry.values],
            returnTo: filePath ?? null
        });
        goto('/tools/recoil');
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={handleClickOutside} />

<div class="flex h-full flex-col overflow-y-auto bg-zinc-950 p-4">
    {#if loadError}
        <div class="mb-3 rounded border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
            {loadError}
        </div>
    {/if}

    {#if loading}
        <div class="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading weapon data...
        </div>
    {:else if entries.length === 0}
        <div class="flex flex-1 items-center justify-center text-sm text-zinc-500">
            No WeaponRecoilTable found in this file.
        </div>
    {:else}
        <!-- Toolbar -->
        <div class="mb-4 flex items-center gap-3">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="weapon-search relative" onkeydown={handleSearchKeydown}>
                <input
                    bind:this={searchInputEl}
                    type="text"
                    placeholder={selectedEntry ? weaponLabel(selectedEntry) : 'Search weapons...'}
                    bind:value={searchQuery}
                    onfocus={() => { dropdownOpen = true; highlightedIdx = 0; }}
                    class="w-64 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-400 focus:border-emerald-600 focus:outline-none"
                />
                {#if dropdownOpen}
                    <div
                        bind:this={dropdownEl}
                        class="absolute left-0 top-full z-50 mt-1 max-h-64 w-80 overflow-y-auto rounded border border-zinc-700 bg-zinc-800 py-1 shadow-lg"
                    >
                        {#if filteredEntries.length === 0}
                            <div class="px-3 py-2 text-xs text-zinc-500">No matches</div>
                        {:else}
                            {#each filteredEntries as entry, i}
                                <button
                                    data-highlighted={i === highlightedIdx}
                                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {entry.index === selectedWeaponIdx ? 'text-emerald-400' : 'text-zinc-200'} {i === highlightedIdx ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'}"
                                    onmouseenter={() => highlightedIdx = i}
                                    onclick={() => selectWeapon(entry.index)}
                                >
                                    <span class="w-6 text-right text-xs text-zinc-500">{entry.index}</span>
                                    <span class="flex-1 truncate">{getWeaponDisplayName(entry.index)}</span>
                                    {#if entry.type}
                                        <span class="text-xs uppercase text-zinc-500">{entry.type}</span>
                                    {/if}
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>

            <button
                class="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                onclick={handleSendToTool}
            >
                Send to Spray Tool
            </button>

            {#if selectedEntry?.type}
                <span class="rounded bg-zinc-800 px-2 py-1 text-xs uppercase text-zinc-400">
                    {selectedEntry.type}
                </span>
            {/if}
        </div>

        <!-- Phase Value Grid -->
        {#if selectedEntry}
            <div class="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-zinc-800">
                            <th class="w-16 px-3 py-2 text-left text-xs font-medium text-zinc-500"></th>
                            {#each PHASE_LABELS as label, i}
                                <th class="px-2 py-2 text-center text-xs font-medium text-zinc-400">
                                    <div>P{i}</div>
                                    <div class="font-normal text-zinc-600">{label}</div>
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Vertical row -->
                        <tr class="border-b border-zinc-800/50">
                            <td class="px-3 py-2 text-xs font-medium text-zinc-400">V</td>
                            {#each { length: 10 } as _, i}
                                <td class="px-1 py-1.5 text-center">
                                    <input
                                        type="number"
                                        min="-100"
                                        max="100"
                                        value={selectedEntry.values[i * 2]}
                                        class="w-14 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-center text-xs text-zinc-200 focus:border-emerald-600 focus:outline-none {selectedEntry.values[i * 2] !== 0 ? 'text-emerald-400' : 'text-zinc-500'}"
                                        onchange={(e) => handleValueChange(i, 'v', parseInt((e.target as HTMLInputElement).value) || 0)}
                                    />
                                </td>
                            {/each}
                        </tr>
                        <!-- Horizontal row -->
                        <tr>
                            <td class="px-3 py-2 text-xs font-medium text-zinc-400">H</td>
                            {#each { length: 10 } as _, i}
                                <td class="px-1 py-1.5 text-center">
                                    <input
                                        type="number"
                                        min="-100"
                                        max="100"
                                        value={selectedEntry.values[i * 2 + 1]}
                                        class="w-14 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-center text-xs text-zinc-200 focus:border-emerald-600 focus:outline-none {selectedEntry.values[i * 2 + 1] !== 0 ? 'text-amber-400' : 'text-zinc-500'}"
                                        onchange={(e) => handleValueChange(i, 'h', parseInt((e.target as HTMLInputElement).value) || 0)}
                                    />
                                </td>
                            {/each}
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- GPC Preview -->
            <div class="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3">
                <div class="mb-1 text-xs text-zinc-500">GPC Row</div>
                <code class="block select-all font-mono text-xs text-emerald-400">
                    {`{${selectedEntry.values.map((v) => String(v).padStart(3, ' ')).join(',')}}`}
                </code>
            </div>
        {/if}
    {/if}
</div>
