<script lang="ts">
	import type { GameConfig } from '$lib/types/config';

	interface Props {
		config: GameConfig;
		gamePath: string;
		profileCount: number;
		onAddModule: () => void;
		onRemoveModule: (index: number, name: string) => void;
		onOpenModuleManager: () => void;
		onOpenConfig: () => void;
	}

	let {
		config,
		gamePath,
		profileCount,
		onAddModule,
		onRemoveModule,
		onOpenModuleManager,
		onOpenConfig
	}: Props = $props();
</script>

<div class="grid grid-cols-2 gap-4">
	<!-- Menu Items -->
	<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
				Menu Items ({config.menu.length})
			</h2>
			<div class="flex gap-2">
				<button
					class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
					onclick={onAddModule}
				>
					+ Add Module
				</button>
				<button
					class="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
					onclick={onOpenModuleManager}
				>
					Module Manager
				</button>
			</div>
		</div>
		<div class="space-y-2">
			{#each config.menu as item, index}
				<div class="group flex items-center gap-1 rounded bg-zinc-800/50 transition-colors hover:bg-zinc-700/50">
					<button
						class="flex flex-1 cursor-pointer items-center justify-between px-3 py-2"
						onclick={onOpenConfig}
					>
						<span class="text-sm text-zinc-200">{item.name}</span>
						<div class="flex items-center gap-2">
							{#if item.profile_aware && profileCount > 0}
								<span class="rounded bg-blue-900/50 px-1.5 py-0.5 text-xs text-blue-400" title="This setting is per-profile">P</span>
							{/if}
							<span class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
								{item.type}
							</span>
							{#if item.state_display}
								<span class="text-xs text-zinc-500">{item.state_display}</span>
							{/if}
						</div>
					</button>
					<button
						class="mr-2 rounded p-1 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
						onclick={(e) => {
							e.stopPropagation();
							onRemoveModule(index, item.name);
						}}
						title="Remove module"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Button Mappings -->
	<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
		<h2 class="mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
			Button Mappings
		</h2>
		<div class="space-y-1.5">
			{#each Object.entries(config.buttons) as [key, value]}
				<button
					class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-800/30"
					onclick={onOpenConfig}
				>
					<span class="text-zinc-400">{key.replace(/_/g, ' ')}</span>
					<code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-emerald-400">{value}</code>
				</button>
			{/each}
		</div>

		{#if Object.keys(config.keyboard).length > 0}
			<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
				Keyboard Shortcuts
			</h2>
			<div class="space-y-1.5">
				{#each Object.entries(config.keyboard) as [key, value]}
					<button
						class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-zinc-800/30"
						onclick={onOpenConfig}
					>
						<span class="text-zinc-400">{key.replace(/_/g, ' ')}</span>
						<code class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-amber-400">{value}</code>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- File Path -->
<div
	class="mt-4 rounded border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500"
>
	{gamePath}
</div>
