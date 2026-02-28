<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	let { gameName = '' }: { gameName?: string } = $props();

	let maximized = $state(false);
	const appWindow = getCurrentWindow();

	onMount(() => {
		appWindow.isMaximized().then((v) => (maximized = v));

		const unlisten = appWindow.onResized(async () => {
			maximized = await appWindow.isMaximized();
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<header
	class="title-bar flex h-8 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950"
	data-tauri-drag-region
	ondblclick={() => appWindow.toggleMaximize()}
>
	<!-- Left: Logo + App Name -->
	<div class="flex items-center gap-2 pl-3" data-tauri-drag-region>
		<svg class="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
			<path
				d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.5 17a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-.5h-3v.5zM8.5 19a.5.5 0 00.5.5h2a.5.5 0 000-1H9a.5.5 0 00-.5.5z"
			/>
		</svg>
		<span class="text-xs font-semibold text-zinc-300" data-tauri-drag-region>GPC IDE</span>
	</div>

	<!-- Center: Current game name -->
	<div class="absolute inset-x-0 flex justify-center pointer-events-none" data-tauri-drag-region>
		{#if gameName}
			<span class="text-xs text-zinc-500" data-tauri-drag-region>{gameName}</span>
		{/if}
	</div>

	<!-- Right: Window Controls -->
	<div class="flex h-full">
		<!-- Minimize -->
		<button
			class="flex h-full w-12 items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
			onclick={() => appWindow.minimize()}
			title={m.layout_titlebar_minimize()}
		>
			<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
				<line x1="2" y1="6" x2="10" y2="6" />
			</svg>
		</button>

		<!-- Maximize / Restore -->
		<button
			class="flex h-full w-12 items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
			onclick={() => appWindow.toggleMaximize()}
			title={maximized ? m.layout_titlebar_restore() : m.layout_titlebar_maximize()}
		>
			{#if maximized}
				<!-- Restore icon (overlapping rectangles) -->
				<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="3" y="3" width="7" height="7" rx="0.5" />
					<path d="M3 9V2.5a.5.5 0 01.5-.5H9" />
				</svg>
			{:else}
				<!-- Maximize icon (single rectangle) -->
				<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="2" y="2" width="8" height="8" rx="0.5" />
				</svg>
			{/if}
		</button>

		<!-- Close -->
		<button
			class="flex h-full w-12 items-center justify-center text-zinc-400 hover:bg-red-600 hover:text-white"
			onclick={() => appWindow.close()}
			title={m.layout_titlebar_close()}
		>
			<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
				<line x1="2" y1="2" x2="10" y2="10" />
				<line x1="10" y1="2" x2="2" y2="10" />
			</svg>
		</button>
	</div>
</header>
