<script lang="ts" module>
	export interface Command {
		id: string;
		label: string;
		category?: string;
		shortcut?: string;
		action: () => void;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		open: boolean;
		commands: Command[];
		onclose: () => void;
	}

	let { open, commands, onclose }: Props = $props();

	let query = $state('');
	let selectedIndex = $state(0);
	let inputEl: HTMLInputElement;

	let filtered = $derived(() => {
		if (!query.trim()) return commands;
		const q = query.toLowerCase();
		return commands.filter(cmd => {
			const text = `${cmd.category ?? ''} ${cmd.label}`.toLowerCase();
			return fuzzyMatch(text, q);
		});
	});

	function fuzzyMatch(text: string, pattern: string): boolean {
		let pi = 0;
		for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
			if (text[ti] === pattern[pi]) pi++;
		}
		return pi === pattern.length;
	}

	$effect(() => {
		if (open) {
			query = '';
			selectedIndex = 0;
			tick().then(() => inputEl?.focus());
		}
	});

	// Reset selection when filter changes
	$effect(() => {
		void filtered();
		selectedIndex = 0;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const items = filtered();

		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const cmd = items[selectedIndex];
			if (cmd) {
				onclose();
				cmd.action();
			}
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
		onclick={handleBackdropClick}
	>
		<div class="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<div class="flex items-center border-b border-zinc-800 px-3">
				<svg class="mr-2 h-4 w-4 shrink-0 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
				</svg>
				<input
					bind:this={inputEl}
					class="flex-1 bg-transparent py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none"
					placeholder="Type a command..."
					bind:value={query}
				/>
			</div>
			<div class="max-h-64 overflow-y-auto py-1">
				{#each filtered() as cmd, i}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="flex cursor-pointer items-center justify-between px-3 py-2 text-sm {i === selectedIndex ? 'bg-emerald-600/20 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800'}"
						role="option"
						aria-selected={i === selectedIndex}
						onmouseenter={() => { selectedIndex = i; }}
						onclick={() => { onclose(); cmd.action(); }}
					>
						<div>
							{#if cmd.category}
								<span class="mr-2 text-xs text-zinc-500">{cmd.category}:</span>
							{/if}
							{cmd.label}
						</div>
						{#if cmd.shortcut}
							<span class="ml-4 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{cmd.shortcut}</span>
						{/if}
					</div>
				{/each}
				{#if filtered().length === 0}
					<div class="px-3 py-4 text-center text-sm text-zinc-500">No matching commands</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
