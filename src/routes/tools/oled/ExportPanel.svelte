<script lang="ts">
	import type { ExportFormat, OledScene, AnimationConfig } from './types';
	import { exportScene, exportAnimation } from './export';
	import { addToast } from '$lib/stores/toast.svelte';
	import MiniMonaco from '$lib/components/editor/MiniMonaco.svelte';

	interface Props {
		scenes: OledScene[];
		activeSceneId: string;
		animation: AnimationConfig;
	}

	let { scenes, activeSceneId, animation }: Props = $props();

	let format = $state<ExportFormat>('array_8bit');
	let exportAll = $state(false);

	let output = $derived.by(() => {
		if (exportAll && scenes.length > 1) {
			return exportAnimation(scenes, format, animation.frameDelayMs);
		}
		const scene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
		if (!scene) return '';
		return exportScene(scene, format);
	});

	function handleCopy() {
		navigator.clipboard.writeText(output).then(() => {
			addToast('Copied to clipboard', 'success', 2000);
		});
	}

	const formats: { id: ExportFormat; label: string }[] = [
		{ id: 'pixel_calls', label: 'pixel_oled() calls' },
		{ id: 'array_8bit', label: 'Packed 8-bit array' },
		{ id: 'array_16bit', label: 'Packed 16-bit array' }
	];
</script>

<div class="flex h-full flex-col gap-3">
	<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Export</h3>

	<div class="space-y-2">
		<div class="flex flex-col gap-1">
			{#each formats as f}
				<label class="flex items-center gap-2 text-xs text-zinc-300">
					<input
						type="radio"
						name="format"
						value={f.id}
						checked={format === f.id}
						onchange={() => (format = f.id)}
						class="accent-emerald-600"
					/>
					{f.label}
				</label>
			{/each}
		</div>

		{#if scenes.length > 1}
			<label class="flex items-center gap-2 text-xs text-zinc-300">
				<input
					type="checkbox"
					bind:checked={exportAll}
					class="accent-emerald-600"
				/>
				Export all scenes (animation)
			</label>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-zinc-700">
		<MiniMonaco value={output} language="gpc" readonly={true} label="OLED Export" />
	</div>

	<button
		class="w-full rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
		onclick={handleCopy}
	>
		Copy to Clipboard
	</button>
</div>
