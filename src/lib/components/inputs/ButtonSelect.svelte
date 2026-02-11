<script lang="ts">
	interface Props {
		value: string;
		onchange: (value: string) => void;
		placeholder?: string;
	}

	let { value, onchange, placeholder = 'Search buttons...' }: Props = $props();

	let search = $state(value || '');
	let open = $state(false);
	let highlightIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();
	let listEl: HTMLDivElement | undefined = $state();

	const BUTTONS: string[] = [
		'PS5_CROSS', 'PS5_CIRCLE', 'PS5_SQUARE', 'PS5_TRIANGLE',
		'PS5_L1', 'PS5_L2', 'PS5_L3', 'PS5_R1', 'PS5_R2', 'PS5_R3',
		'PS5_UP', 'PS5_DOWN', 'PS5_LEFT', 'PS5_RIGHT',
		'PS5_OPTIONS', 'PS5_CREATE', 'PS5_PS', 'PS5_TOUCH',
		'PS5_RX', 'PS5_RY', 'PS5_LX', 'PS5_LY',
	];

	let filtered = $derived.by(() => {
		if (!search) return BUTTONS;
		const q = search.toLowerCase().replace('ps5_', '');
		return BUTTONS.filter(b => b.toLowerCase().replace('ps5_', '').includes(q));
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
