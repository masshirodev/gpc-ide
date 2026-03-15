<script lang="ts">
	import {
		InputDevice,
		HID_KEY_NAMES,
		MOUSE_BUTTON_NAMES,
		MouseButton,
		getInputName,
		type InputMapping
	} from '$lib/types/zmk';

	interface Props {
		mapping: InputMapping;
		onchange: (mapping: InputMapping) => void;
		compact?: boolean;
	}

	let { mapping, onchange, compact = false }: Props = $props();

	let listening = $state(false);
	let dropdownOpen = $state(false);
	let search = $state('');
	let highlightIndex = $state(0);
	let listEl: HTMLDivElement | undefined = $state();
	let captureEl: HTMLDivElement | undefined = $state();

	// Build keyboard entries list from HID_KEY_NAMES
	const KEYBOARD_ENTRIES: { name: string; code: number }[] = Object.entries(HID_KEY_NAMES)
		.map(([code, name]) => ({ name, code: parseInt(code) }))
		.sort((a, b) => a.code - b.code);

	// Build mouse entries list from MOUSE_BUTTON_NAMES
	const MOUSE_ENTRIES: { name: string; code: number }[] = Object.entries(MOUSE_BUTTON_NAMES)
		.map(([code, name]) => ({ name, code: parseInt(code) }))
		.sort((a, b) => a.code - b.code);

	// All entries combined for dropdown
	const ALL_ENTRIES: { name: string; code: number; type: InputDevice }[] = [
		...MOUSE_ENTRIES.map((e) => ({ ...e, type: InputDevice.Mouse as InputDevice })),
		...KEYBOARD_ENTRIES.map((e) => ({ ...e, type: InputDevice.Keyboard as InputDevice }))
	];

	let filtered = $derived.by(() => {
		if (!search) return ALL_ENTRIES;
		const q = search.toLowerCase();
		return ALL_ENTRIES.filter((e) => e.name.toLowerCase().includes(q));
	});

	// Map browser e.code to USB HID scancode
	const CODE_TO_HID: Record<string, number> = {
		KeyA: 0x04, KeyB: 0x05, KeyC: 0x06, KeyD: 0x07,
		KeyE: 0x08, KeyF: 0x09, KeyG: 0x0a, KeyH: 0x0b,
		KeyI: 0x0c, KeyJ: 0x0d, KeyK: 0x0e, KeyL: 0x0f,
		KeyM: 0x10, KeyN: 0x11, KeyO: 0x12, KeyP: 0x13,
		KeyQ: 0x14, KeyR: 0x15, KeyS: 0x16, KeyT: 0x17,
		KeyU: 0x18, KeyV: 0x19, KeyW: 0x1a, KeyX: 0x1b,
		KeyY: 0x1c, KeyZ: 0x1d,
		Digit1: 0x1e, Digit2: 0x1f, Digit3: 0x20, Digit4: 0x21,
		Digit5: 0x22, Digit6: 0x23, Digit7: 0x24, Digit8: 0x25,
		Digit9: 0x26, Digit0: 0x27,
		Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b,
		Space: 0x2c, Minus: 0x2d, Equal: 0x2e,
		BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31,
		Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
		Comma: 0x36, Period: 0x37, Slash: 0x38,
		CapsLock: 0x39,
		F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d,
		F5: 0x3e, F6: 0x3f, F7: 0x40, F8: 0x41,
		F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
		PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
		Insert: 0x49, Home: 0x4a, PageUp: 0x4b,
		Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
		ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
		NumLock: 0x53,
		NumpadDivide: 0x54, NumpadMultiply: 0x55, NumpadSubtract: 0x56,
		NumpadAdd: 0x57, NumpadEnter: 0x58,
		Numpad1: 0x59, Numpad2: 0x5a, Numpad3: 0x5b, Numpad4: 0x5c,
		Numpad5: 0x5d, Numpad6: 0x5e, Numpad7: 0x5f, Numpad8: 0x60,
		Numpad9: 0x61, Numpad0: 0x62, NumpadDecimal: 0x63,
		ContextMenu: 0x65,
		ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
		ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7
	};

	// Map browser mouse button index to Cronus MouseButton code
	const BROWSER_BUTTON_TO_CRONUS: Record<number, number> = {
		0: MouseButton.Left,
		1: MouseButton.Middle,
		2: MouseButton.Right,
		3: MouseButton.Button4,
		4: MouseButton.Button5
	};

	// Window-level handlers to intercept mouse 4/5 (back/forward) and context menu
	// before the webview can handle them as navigation
	function windowPointerdown(e: PointerEvent) {
		if (e.button < 2) return; // let left/middle through to element handler
		e.preventDefault();
		e.stopPropagation();
		const cronusCode = BROWSER_BUTTON_TO_CRONUS[e.button];
		if (cronusCode !== undefined) {
			onchange({ type: InputDevice.Mouse, code: cronusCode });
			stopListening();
		}
	}

	function windowMousedown(e: MouseEvent) {
		if (e.button >= 2) {
			e.preventDefault();
			e.stopPropagation();
			// Assign mouse button (backup for when pointerdown doesn't fire for buttons 3/4)
			const cronusCode = BROWSER_BUTTON_TO_CRONUS[e.button];
			if (cronusCode !== undefined && listening) {
				onchange({ type: InputDevice.Mouse, code: cronusCode });
				stopListening();
			}
		}
	}

	function windowMouseup(e: MouseEvent) {
		if (e.button >= 2) {
			e.preventDefault();
			e.stopPropagation();
			// Last resort fallback for buttons 3/4
			const cronusCode = BROWSER_BUTTON_TO_CRONUS[e.button];
			if (cronusCode !== undefined && listening) {
				onchange({ type: InputDevice.Mouse, code: cronusCode });
				stopListening();
			}
		}
	}

	function windowContextmenu(e: Event) {
		e.preventDefault();
		e.stopPropagation();
	}

	function startListening() {
		listening = true;
		dropdownOpen = false;
		// Register window-level capture handlers to block browser back/forward navigation
		window.addEventListener('pointerdown', windowPointerdown, true);
		window.addEventListener('mousedown', windowMousedown, true);
		window.addEventListener('mouseup', windowMouseup, true);
		window.addEventListener('contextmenu', windowContextmenu, true);
		requestAnimationFrame(() => captureEl?.focus());
	}

	function stopListening() {
		listening = false;
		if (blurTimeout) {
			clearTimeout(blurTimeout);
			blurTimeout = null;
		}
		window.removeEventListener('pointerdown', windowPointerdown, true);
		window.removeEventListener('mousedown', windowMousedown, true);
		window.removeEventListener('mouseup', windowMouseup, true);
		window.removeEventListener('contextmenu', windowContextmenu, true);
	}

	function handleCaptureKeydown(e: KeyboardEvent) {
		if (!listening) return;
		e.preventDefault();
		e.stopPropagation();

		if (e.code === 'Escape') {
			stopListening();
			return;
		}

		if (e.code === 'Backspace') {
			onchange({ type: InputDevice.None, code: 0x00 });
			stopListening();
			return;
		}

		const hidCode = CODE_TO_HID[e.code];
		if (hidCode !== undefined) {
			onchange({ type: InputDevice.Keyboard, code: hidCode });
			stopListening();
		}
	}

	function handleCapturePointerdown(e: PointerEvent) {
		if (!listening) return;
		e.preventDefault();
		e.stopPropagation();

		// Left and middle mouse handled here (3/4/5 caught by window handler)
		if (e.button <= 2) {
			const cronusCode = BROWSER_BUTTON_TO_CRONUS[e.button];
			if (cronusCode !== undefined) {
				onchange({ type: InputDevice.Mouse, code: cronusCode });
				stopListening();
			}
		}
	}

	function handleCaptureContextmenu(e: Event) {
		if (!listening) return;
		e.preventDefault();
		e.stopPropagation();
	}

	let blurTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleCaptureBlur() {
		// Delay blur so window-level mouse handlers can fire first
		blurTimeout = setTimeout(() => {
			if (listening) {
				stopListening();
			}
			blurTimeout = null;
		}, 100);
	}

	// Dropdown mode
	function toggleDropdown(e: MouseEvent) {
		e.stopPropagation();
		listening = false;
		dropdownOpen = !dropdownOpen;
		search = '';
		highlightIndex = 0;
	}

	function selectEntry(entry: { name: string; code: number; type: InputDevice } | null) {
		if (entry) {
			onchange({ type: entry.type, code: entry.code });
		} else {
			onchange({ type: InputDevice.None, code: 0x00 });
		}
		dropdownOpen = false;
		search = '';
	}

	function handleDropdownKeydown(e: KeyboardEvent) {
		if (!dropdownOpen) return;

		if (e.key === 'ArrowDown') {
			const max = 1 + filtered.length; // +1 for "None"
			highlightIndex = Math.min(highlightIndex + 1, max - 1);
			scrollToHighlight();
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			highlightIndex = Math.max(highlightIndex - 1, 0);
			scrollToHighlight();
			e.preventDefault();
		} else if (e.key === 'Enter') {
			if (highlightIndex === 0) {
				selectEntry(null);
			} else {
				const entry = filtered[highlightIndex - 1];
				if (entry) selectEntry(entry);
			}
			e.preventDefault();
		} else if (e.key === 'Escape') {
			dropdownOpen = false;
			e.preventDefault();
		}
	}

	function scrollToHighlight() {
		if (listEl) {
			const item = listEl.children[highlightIndex] as HTMLElement | undefined;
			item?.scrollIntoView({ block: 'nearest' });
		}
	}

	function handleDropdownBlur() {
		setTimeout(() => {
			dropdownOpen = false;
		}, 150);
	}

	let displayName = $derived(getInputName(mapping) || '—');
	let isEmpty = $derived(mapping.type === InputDevice.None);
</script>

<div class="relative flex items-center gap-1">
	{#if listening}
		<!-- Key capture overlay -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			bind:this={captureEl}
			tabindex="0"
			role="textbox"
			class="flex-1 animate-pulse cursor-pointer rounded border border-emerald-500 bg-emerald-950/30 px-2 py-1 text-sm text-emerald-400 focus:outline-none"
			onkeydown={handleCaptureKeydown}
			onpointerdown={handleCapturePointerdown}
			oncontextmenu={handleCaptureContextmenu}
			onblur={handleCaptureBlur}
		>
			Press a key...
		</div>
	{:else}
		<!-- Display current mapping, click to capture -->
		<button
			type="button"
			class="flex-1 rounded border px-2 py-1 text-left text-sm transition-colors {isEmpty
				? 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
				: 'border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:border-emerald-600'}"
			onclick={startListening}
			title="Click to rebind"
		>
			{displayName}
		</button>
	{/if}

	<!-- Dropdown toggle button -->
	<button
		type="button"
		class="shrink-0 rounded border border-zinc-700 bg-zinc-800 p-1 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
		onclick={toggleDropdown}
		title="Browse keys"
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	<!-- Dropdown panel -->
	{#if dropdownOpen}
		<div
			class="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg"
		>
			<div class="border-b border-zinc-700 p-1">
				<input
					type="text"
					bind:value={search}
					placeholder="Search..."
					class="w-full rounded bg-zinc-900 px-2 py-1 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none"
					onkeydown={handleDropdownKeydown}
					onblur={handleDropdownBlur}
					autofocus
				/>
			</div>
			<div bind:this={listEl} class="max-h-48 overflow-y-auto py-1">
				<!-- None option -->
				<button
					type="button"
					class="flex w-full items-center px-3 py-1 text-left text-sm {highlightIndex === 0
						? 'bg-emerald-900/40 text-emerald-300'
						: 'text-zinc-400 hover:bg-zinc-700'}"
					onmousedown={(e) => {
						e.preventDefault();
						selectEntry(null);
					}}
				>
					None
				</button>
				{#each filtered as entry, i}
					{@const idx = i + 1}
					<button
						type="button"
						class="flex w-full items-center justify-between px-3 py-1 text-left text-sm {idx ===
						highlightIndex
							? 'bg-emerald-900/40 text-emerald-300'
							: 'text-zinc-200 hover:bg-zinc-700'}"
						onmousedown={(e) => {
							e.preventDefault();
							selectEntry(entry);
						}}
					>
						<span class="text-xs">{entry.name}</span>
						<span class="text-[10px] text-zinc-500">
							{entry.type === InputDevice.Mouse ? 'Mouse' : 'Key'}
						</span>
					</button>
				{/each}
				{#if filtered.length === 0}
					<div class="px-3 py-2 text-xs text-zinc-500">No matches</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
