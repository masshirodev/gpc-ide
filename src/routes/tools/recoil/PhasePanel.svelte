<script lang="ts">
    interface PhaseValue {
        v: number;
        h: number;
        assigned: boolean;
    }

    interface Props {
        phaseValues: PhaseValue[];
        phaseLabels: string[];
        phaseColors: string[];
        mode: 'manual' | 'auto';
        onClearPhase: (phaseIdx: number) => void;
    }

    let { phaseValues, phaseLabels, phaseColors, mode, onClearPhase }: Props = $props();
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
    <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Phases</h3>

    <div class="flex flex-col gap-1">
        {#each phaseValues as pv, i}
            <div
                class="flex items-center gap-2 rounded px-2 py-1 text-xs {pv.assigned ? 'bg-zinc-800/50' : ''}"
            >
                <span
                    class="h-2.5 w-2.5 shrink-0 rounded-full"
                    style:background={pv.assigned ? phaseColors[i] : '#3f3f46'}
                ></span>
                <span class="w-6 font-bold" style:color={phaseColors[i]}>P{i}</span>
                <span class="w-14 text-zinc-500">{phaseLabels[i]}</span>
                {#if pv.assigned}
                    <span class="font-mono text-emerald-400">
                        V:{pv.v} H:{pv.h}
                    </span>
                    {#if mode === 'manual'}
                        <button
                            class="ml-auto text-zinc-600 hover:text-red-400"
                            onclick={() => onClearPhase(i)}
                            title="Clear phase"
                        >
                            &times;
                        </button>
                    {/if}
                {:else}
                    <span class="text-zinc-600">&mdash;</span>
                {/if}
            </div>
        {/each}
    </div>
</div>
