<script lang="ts">
	import { getButtonNames, getConsolePrefix, type ConsoleType } from '$lib/utils/console-buttons';

	interface Props {
		value: string;
		onchange: (value: string) => void;
		consoleType?: ConsoleType;
		placeholder?: string;
	}

	let { value, onchange, consoleType = 'ps5', placeholder = 'Search buttons...' }: Props = $props();

	let search = $state(value || '');
	let open = $state(false);
	let highlightIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();
	let listEl: HTMLDivElement | undefined = $state();

	let buttons = $derived(getButtonNames(consoleType));
	let prefix = $derived(getConsolePrefix(consoleType).toLowerCase());

	let filtered = $derived.by(() => {
		if (!search) return buttons;
		const q = search.toLowerCase().replace(prefix, '');
		return buttons.filter(b => b.toLowerCase().replace(prefix, '').includes(q));
	});

	// Reset search text when value changes externally (e.g., console type switch)
	$effect(() => {
		search = value || '';
	});

	function select(btn: string) {
		search = btn;
		onchange(btn);
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) {
			if (e.key === 'ArrowDown' || e.key === 'Enter') {
				open = true;
				highlightIndex = 0;
				e.preventDefault();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			highlightIndex = Math.min(highlightIndex + 1, filtered.length - 1);
			scrollToHighlight();
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			highlightIndex = Math.max(highlightIndex - 1, 0);
			scrollToHighlight();
			e.preventDefault();
		} else if (e.key === 'Enter') {
			if (filtered[highlightIndex]) select(filtered[highlightIndex]);
			e.preventDefault();
		} else if (e.key === 'Escape') {
			open = false;
			search = value || '';
			e.preventDefault();
		}
	}

	function scrollToHighlight() {
		if (listEl) {
			const item = listEl.children[highlightIndex] as HTMLElement | undefined;
			item?.scrollIntoView({ block: 'nearest' });
		}
	}

	function handleFocus() {
		open = true;
		highlightIndex = 0;
		search = '';
	}

	function handleBlur() {
		setTimeout(() => {
			open = false;
			search = value || '';
		}, 150);
	}

	function handleInput() {
		open = true;
		highlightIndex = 0;
	}
</script>

<div class="relative">
	<input
		bind:this={inputEl}
		type="text"
		bind:value={search}
		onfocus={handleFocus}
		onblur={handleBlur}
		oninput={handleInput}
		onkeydown={handleKeydown}
		{placeholder}
		class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
	/>

	{#if open}
		<div
			bind:this={listEl}
			class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-lg"
		>
			{#each filtered as btn, i}
				<button
					type="button"
					class="flex w-full items-center px-3 py-1.5 text-left text-sm font-mono text-xs {i === highlightIndex ? 'bg-emerald-900/40 text-emerald-300' : 'text-zinc-200 hover:bg-zinc-700'}"
					onmousedown={(e) => { e.preventDefault(); select(btn); }}
				>
					{btn}
				</button>
			{/each}
			{#if filtered.length === 0}
				<div class="px-3 py-2 text-xs text-zinc-500">No matching buttons</div>
			{/if}
		</div>
	{/if}
</div>
