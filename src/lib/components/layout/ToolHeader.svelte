<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		children?: Snippet;
	}

	let { title, subtitle, children }: Props = $props();
</script>

<div class="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
	<a href="/" class="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
		<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
				clip-rule="evenodd"
			/>
		</svg>
		Back
	</a>
	<div>
		<h1 class="text-lg font-semibold text-zinc-100">{title}</h1>
		{#if subtitle}
			<p class="text-xs text-zinc-500">{subtitle}</p>
		{/if}
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
