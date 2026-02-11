<script lang="ts">
    interface Props {
        output: string;
        onCopy: () => void;
    }

    let { output, onCopy }: Props = $props();
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
    <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">GPC Output</h3>

    <div
        class="select-all rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-xs leading-relaxed text-emerald-400"
    >
        {output}
    </div>

    <button
        class="mt-2 w-full rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        onclick={onCopy}
    >
        Copy
    </button>
</div>
