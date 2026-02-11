<script lang="ts">
	interface Props {
		value: string;
		onchange: (value: string) => void;
		placeholder?: string;
		allowEmpty?: boolean;
	}

	let { value, onchange, placeholder = 'Search keys...', allowEmpty = true }: Props = $props();

	let search = $state(value || '');
	let open = $state(false);
	let highlightIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();
	let listEl: HTMLDivElement | undefined = $state();

	const KEYS: { name: string; value: number }[] = [
		{ name: 'KEY_A', value: 4 }, { name: 'KEY_B', value: 5 }, { name: 'KEY_C', value: 6 },
		{ name: 'KEY_D', value: 7 }, { name: 'KEY_E', value: 8 }, { name: 'KEY_F', value: 9 },
		{ name: 'KEY_G', value: 10 }, { name: 'KEY_H', value: 11 }, { name: 'KEY_I', value: 12 },
		{ name: 'KEY_J', value: 13 }, { name: 'KEY_K', value: 14 }, { name: 'KEY_L', value: 15 },
		{ name: 'KEY_M', value: 16 }, { name: 'KEY_N', value: 17 }, { name: 'KEY_O', value: 18 },
		{ name: 'KEY_P', value: 19 }, { name: 'KEY_Q', value: 20 }, { name: 'KEY_R', value: 21 },
		{ name: 'KEY_S', value: 22 }, { name: 'KEY_T', value: 23 }, { name: 'KEY_U', value: 24 },
		{ name: 'KEY_V', value: 25 }, { name: 'KEY_W', value: 26 }, { name: 'KEY_X', value: 27 },
		{ name: 'KEY_Y', value: 28 }, { name: 'KEY_Z', value: 29 },
		{ name: 'KEY_1', value: 30 }, { name: 'KEY_2', value: 31 }, { name: 'KEY_3', value: 32 },
		{ name: 'KEY_4', value: 33 }, { name: 'KEY_5', value: 34 }, { name: 'KEY_6', value: 35 },
		{ name: 'KEY_7', value: 36 }, { name: 'KEY_8', value: 37 }, { name: 'KEY_9', value: 38 },
		{ name: 'KEY_0', value: 39 },
		{ name: 'KEY_ENTER', value: 40 }, { name: 'KEY_ESC', value: 41 },
		{ name: 'KEY_BACKSPACE', value: 42 }, { name: 'KEY_TAB', value: 43 },
		{ name: 'KEY_SPACE', value: 44 }, { name: 'KEY_MINUS', value: 45 },
		{ name: 'KEY_EQUAL', value: 46 }, { name: 'KEY_LEFTBRACE', value: 47 },
		{ name: 'KEY_RIGHTBRACE', value: 48 }, { name: 'KEY_BACKSLASH', value: 49 },
		{ name: 'KEY_HASHTILDE', value: 50 }, { name: 'KEY_SEMICOLON', value: 51 },
		{ name: 'KEY_APOSTROPHE', value: 52 }, { name: 'KEY_GRAVE', value: 53 },
		{ name: 'KEY_COMMA', value: 54 }, { name: 'KEY_DOT', value: 55 },
		{ name: 'KEY_SLASH', value: 56 }, { name: 'KEY_CAPSLOCK', value: 57 },
		{ name: 'KEY_F1', value: 58 }, { name: 'KEY_F2', value: 59 },
		{ name: 'KEY_F3', value: 60 }, { name: 'KEY_F4', value: 61 },
		{ name: 'KEY_F5', value: 62 }, { name: 'KEY_F6', value: 63 },
		{ name: 'KEY_F7', value: 64 }, { name: 'KEY_F8', value: 65 },
		{ name: 'KEY_F9', value: 66 }, { name: 'KEY_F10', value: 67 },
		{ name: 'KEY_F11', value: 68 }, { name: 'KEY_F12', value: 69 },
		{ name: 'KEY_SYSRQ', value: 70 }, { name: 'KEY_SCROLLLOCK', value: 71 },
		{ name: 'KEY_PAUSE', value: 72 }, { name: 'KEY_INSERT', value: 73 },
		{ name: 'KEY_HOME', value: 74 }, { name: 'KEY_PAGEUP', value: 75 },
		{ name: 'KEY_DELETE', value: 76 }, { name: 'KEY_END', value: 77 },
		{ name: 'KEY_PAGEDOWN', value: 78 },
		{ name: 'KEY_RIGHT', value: 79 }, { name: 'KEY_LEFT', value: 80 },
		{ name: 'KEY_DOWN', value: 81 }, { name: 'KEY_UP', value: 82 },
		{ name: 'KEY_NUMLOCK', value: 83 }, { name: 'KEY_KPSLASH', value: 84 },
		{ name: 'KEY_KPASTERISK', value: 85 }, { name: 'KEY_KPMINUS', value: 86 },
		{ name: 'KEY_KPPLUS', value: 87 }, { name: 'KEY_KPENTER', value: 88 },
		{ name: 'KEY_KP1', value: 89 }, { name: 'KEY_KP2', value: 90 },
		{ name: 'KEY_KP3', value: 91 }, { name: 'KEY_KP4', value: 92 },
		{ name: 'KEY_KP5', value: 93 }, { name: 'KEY_KP6', value: 94 },
		{ name: 'KEY_KP7', value: 95 }, { name: 'KEY_KP8', value: 96 },
		{ name: 'KEY_KP9', value: 97 }, { name: 'KEY_KP0', value: 98 },
		{ name: 'KEY_KPDOT', value: 99 }, { name: 'KEY_102ND', value: 100 },
		{ name: 'KEY_COMPOSE', value: 101 }, { name: 'KEY_POWER', value: 102 },
		{ name: 'KEY_KPEQUAL', value: 103 },
		{ name: 'KEY_F13', value: 104 }, { name: 'KEY_F14', value: 105 },
		{ name: 'KEY_F15', value: 106 }, { name: 'KEY_F16', value: 107 },
		{ name: 'KEY_F17', value: 108 }, { name: 'KEY_F18', value: 109 },
		{ name: 'KEY_F19', value: 110 }, { name: 'KEY_F20', value: 111 },
		{ name: 'KEY_F21', value: 112 }, { name: 'KEY_F22', value: 113 },
		{ name: 'KEY_F23', value: 114 }, { name: 'KEY_F24', value: 115 },
		{ name: 'KEY_OPEN', value: 116 }, { name: 'KEY_HELP', value: 117 },
		{ name: 'KEY_PROPS', value: 118 }, { name: 'KEY_FRONT', value: 119 },
		{ name: 'KEY_STOP', value: 120 }, { name: 'KEY_AGAIN', value: 121 },
		{ name: 'KEY_UNDO', value: 122 }, { name: 'KEY_CUT', value: 123 },
		{ name: 'KEY_COPY', value: 124 }, { name: 'KEY_PASTE', value: 125 },
		{ name: 'KEY_FIND', value: 126 }, { name: 'KEY_MUTE', value: 127 },
		{ name: 'KEY_VOLUMEUP', value: 128 }, { name: 'KEY_VOLUMEDOWN', value: 129 },
		{ name: 'KEY_KPCOMMA', value: 133 }, { name: 'KEY_RO', value: 135 },
		{ name: 'KEY_KATAKANAHIRAGANA', value: 136 }, { name: 'KEY_YEN', value: 137 },
		{ name: 'KEY_HENKAN', value: 138 }, { name: 'KEY_MUHENKAN', value: 139 },
		{ name: 'KEY_KPJPCOMMA', value: 140 }, { name: 'KEY_HANGEUL', value: 144 },
		{ name: 'KEY_HANJA', value: 145 }, { name: 'KEY_KATAKANA', value: 146 },
		{ name: 'KEY_HIRAGANA', value: 147 }, { name: 'KEY_ZENKAKUHANKAKU', value: 148 },
		{ name: 'KEY_KPLEFTPAREN', value: 182 }, { name: 'KEY_KPRIGHTPAREN', value: 183 },
		{ name: 'KEY_LEFTCTRL', value: 224 }, { name: 'KEY_LEFTSHIFT', value: 225 },
		{ name: 'KEY_LEFTALT', value: 226 }, { name: 'KEY_LEFTMETA', value: 227 },
		{ name: 'KEY_RIGHTCTRL', value: 228 }, { name: 'KEY_RIGHTSHIFT', value: 229 },
		{ name: 'KEY_RIGHTALT', value: 230 }, { name: 'KEY_RIGHTMETA', value: 231 },
		{ name: 'KEY_MEDIA_PLAYPAUSE', value: 232 }, { name: 'KEY_MEDIA_STOPCD', value: 233 },
		{ name: 'KEY_MEDIA_PREVIOUSSONG', value: 234 }, { name: 'KEY_MEDIA_NEXTSONG', value: 235 },
		{ name: 'KEY_MEDIA_EJECTCD', value: 236 }, { name: 'KEY_MEDIA_VOLUMEUP', value: 237 },
		{ name: 'KEY_MEDIA_VOLUMEDOWN', value: 238 }, { name: 'KEY_MEDIA_MUTE', value: 239 },
		{ name: 'KEY_MEDIA_WWW', value: 240 }, { name: 'KEY_MEDIA_BACK', value: 241 },
		{ name: 'KEY_MEDIA_FORWARD', value: 242 }, { name: 'KEY_MEDIA_STOP', value: 243 },
		{ name: 'KEY_MEDIA_FIND', value: 244 }, { name: 'KEY_MEDIA_SCROLLUP', value: 245 },
		{ name: 'KEY_MEDIA_SCROLLDOWN', value: 246 }, { name: 'KEY_MEDIA_EDIT', value: 247 },
		{ name: 'KEY_MEDIA_SLEEP', value: 248 }, { name: 'KEY_MEDIA_COFFEE', value: 249 },
		{ name: 'KEY_MEDIA_REFRESH', value: 250 }, { name: 'KEY_MEDIA_CALC', value: 251 },
	];

	let filtered = $derived.by(() => {
		if (!search) return KEYS;
		const q = search.toLowerCase().replace('key_', '');
		return KEYS.filter(k => {
			const name = k.name.toLowerCase().replace('key_', '');
			return name.includes(q) || k.value.toString() === q;
		});
	});

	function select(key: { name: string } | null) {
		if (key) {
			search = key.name;
			onchange(key.name);
		} else {
			search = '';
			onchange('');
		}
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
			const max = (allowEmpty ? 1 : 0) + filtered.length;
			highlightIndex = Math.min(highlightIndex + 1, max - 1);
			scrollToHighlight();
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			highlightIndex = Math.max(highlightIndex - 1, 0);
			scrollToHighlight();
			e.preventDefault();
		} else if (e.key === 'Enter') {
			if (allowEmpty && highlightIndex === 0) {
				select(null);
			} else {
				const idx = highlightIndex - (allowEmpty ? 1 : 0);
				if (filtered[idx]) select(filtered[idx]);
			}
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
		// Delay to allow click events on dropdown items
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

	{#if value}
		<button
			type="button"
			class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
			onmousedown={(e) => { e.preventDefault(); select(null); }}
		>
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
		</button>
	{/if}

	{#if open}
		<div
			bind:this={listEl}
			class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-lg"
		>
			{#if allowEmpty}
				<button
					type="button"
					class="flex w-full items-center px-3 py-1.5 text-left text-sm {highlightIndex === 0 ? 'bg-emerald-900/40 text-emerald-300' : 'text-zinc-400 hover:bg-zinc-700'}"
					onmousedown={(e) => { e.preventDefault(); select(null); }}
				>
					None
				</button>
			{/if}
			{#each filtered as key, i}
				{@const idx = i + (allowEmpty ? 1 : 0)}
				<button
					type="button"
					class="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm {idx === highlightIndex ? 'bg-emerald-900/40 text-emerald-300' : 'text-zinc-200 hover:bg-zinc-700'}"
					onmousedown={(e) => { e.preventDefault(); select(key); }}
				>
					<span class="font-mono text-xs">{key.name}</span>
					<span class="text-[10px] text-zinc-500">{key.value}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<div class="px-3 py-2 text-xs text-zinc-500">No matching keys</div>
			{/if}
		</div>
	{/if}
</div>
