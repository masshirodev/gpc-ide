<script lang="ts">
    interface Props {
        assignMode: 'manual' | 'auto';
        bulletCount: number;
        fireRate: number;
        scale: number;
        onClear: () => void;
    }

    let {
        assignMode = $bindable('auto'),
        bulletCount = $bindable(30),
        fireRate = $bindable(600),
        scale = $bindable(3),
        onClear
    }: Props = $props();

    let rpmCalcOpen = $state(false);
    let magSize = $state(30);
    let emptyTime = $state(3);
    let calculatedRpm = $derived(emptyTime > 0 ? Math.round((magSize / emptyTime) * 60) : 0);
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
    <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Configuration</h3>

    <!-- Mode toggle -->
    <div class="mb-3 flex gap-1 rounded-md bg-zinc-800 p-0.5">
        <button
            class="flex-1 rounded px-2 py-1 text-xs font-medium transition-colors {assignMode === 'manual' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'}"
            onclick={() => assignMode = 'manual'}
        >
            Manual
        </button>
        <button
            class="flex-1 rounded px-2 py-1 text-xs font-medium transition-colors {assignMode === 'auto' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'}"
            onclick={() => assignMode = 'auto'}
        >
            Auto
        </button>
    </div>

    {#if assignMode === 'auto'}
        <div class="space-y-2">
            <label class="block">
                <span class="text-xs text-zinc-400">Bullet Count</span>
                <input
                    type="number"
                    bind:value={bulletCount}
                    min="1"
                    max="200"
                    class="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                />
            </label>
            <label class="block">
                <span class="text-xs text-zinc-400">Fire Rate (RPM)</span>
                <input
                    type="number"
                    bind:value={fireRate}
                    min="60"
                    max="2400"
                    step="10"
                    class="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                />
            </label>
            <p class="text-xs text-zinc-600">
                {Math.round(60000 / fireRate)}ms between shots
            </p>

            <!-- RPM Calculator -->
            <div class="border-t border-zinc-800 pt-2">
                <button
                    class="flex w-full items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400"
                    onclick={() => rpmCalcOpen = !rpmCalcOpen}
                >
                    <svg
                        class="h-3 w-3 transition-transform {rpmCalcOpen ? 'rotate-90' : ''}"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    RPM Calculator
                </button>
                {#if rpmCalcOpen}
                    <div class="mt-2 space-y-2">
                        <label class="block">
                            <span class="text-xs text-zinc-400">Magazine Size</span>
                            <input
                                type="number"
                                bind:value={magSize}
                                min="1"
                                max="999"
                                class="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                            />
                        </label>
                        <label class="block">
                            <span class="text-xs text-zinc-400">Time to Empty (seconds)</span>
                            <input
                                type="number"
                                bind:value={emptyTime}
                                min="0.1"
                                max="60"
                                step="0.1"
                                class="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                            />
                        </label>
                        {#if calculatedRpm > 0}
                            <div class="flex items-center justify-between">
                                <p class="text-xs text-zinc-300">
                                    = <span class="font-medium text-emerald-400">{calculatedRpm}</span> RPM
                                </p>
                                <button
                                    class="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                                    onclick={() => fireRate = calculatedRpm}
                                >
                                    Apply
                                </button>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <p class="text-xs leading-relaxed text-zinc-500">
            Click canvas to place points, then press
            <kbd class="rounded bg-zinc-800 px-1 text-zinc-400">Space</kbd>
            to switch to phase assignment mode.
        </p>
    {/if}

    <div class="mt-3 border-t border-zinc-800 pt-3">
        <label class="block">
            <span class="text-xs text-zinc-400">Scale (px/unit)</span>
            <input
                type="number"
                bind:value={scale}
                min="0.5"
                max="20"
                step="0.5"
                class="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
            />
        </label>
    </div>

    <button
        class="mt-3 w-full rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
        onclick={onClear}
    >
        Clear All
    </button>
</div>
