<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		parseKeyboardMappings,
		serializeKeyboardMappings,
		removeMapping,
		toggleMapping,
		type KeyMapping
	} from '$lib/utils/keyboard-parser';
	import {
		CONTROLLER_LAYOUT,
		KEYBOARD_KEYS,
		BUTTON_GROUPS,
		getButtonLabel,
		getControllerButtons,
		getLayoutButtonName
	} from '$lib/utils/keyboard-constants';
	import {
		CONSOLE_TYPES,
		CONSOLE_LABELS,
		type ConsoleType
	} from '$lib/utils/console-buttons';
	import { setKeyboardTransfer } from '$lib/stores/keyboard-transfer.svelte';

	interface Props {
		content: string;
		gamePath: string;
		filePath?: string;
		consoleType?: ConsoleType;
		onchange: (newContent: string) => void;
	}

	let { content, gamePath, filePath, consoleType = 'ps5', onchange }: Props = $props();

	let mappings = $state<KeyMapping[]>([]);
	let selectedButton = $state<string | null>(null);
	let assigningSource = $state(false);
	let sourceFilter = $state('');
	let inputConsole = $state<ConsoleType>(consoleType);

	// Output console = game's console (the controller diagram)
	let outputConsole = $derived(consoleType);

	// Parse content on load
	$effect(() => {
		const parsed = parseKeyboardMappings(content);
		untrack(() => {
			mappings = parsed;
		});
	});

	function emitChange() {
		onchange(serializeKeyboardMappings(content, mappings));
	}

	function handleRemoveMapping(idx: number) {
		mappings = removeMapping(mappings, idx);
		emitChange();
	}

	function handleToggleMapping(idx: number) {
		mappings = toggleMapping(mappings, idx);
		emitChange();
	}

	function handleControllerButtonClick(buttonName: string) {
		selectedButton = buttonName;
		assigningSource = true;
		sourceFilter = '';
	}

	function handleAssignSource(source: string, type: 'keyboard' | 'controller') {
		if (!selectedButton) return;

		const isAxis = selectedButton.endsWith('X') || selectedButton.endsWith('Y');
		const defaultValue = type === 'controller' ? 0 : isAxis ? -100 : 100;

		const newMapping: KeyMapping = {
			source,
			target: selectedButton,
			value: defaultValue,
			type,
			enabled: true
		};

		mappings = [...mappings, newMapping];
		selectedButton = null;
		assigningSource = false;
		emitChange();
	}

	function handleCancelAssign() {
		selectedButton = null;
		assigningSource = false;
	}

	function handleSendToTool() {
		setKeyboardTransfer({
			mappings: [...mappings],
			returnTo: filePath ?? null,
			outputConsole,
			inputConsole
		});
		goto('/tools/keyboard');
	}

	function getMappingsForButton(buttonName: string): KeyMapping[] {
		return mappings.filter((m) => m.target === buttonName);
	}

	function getButtonColor(buttonName: string): string {
		const btnMappings = getMappingsForButton(buttonName);
		if (btnMappings.length === 0) return 'bg-zinc-700 text-zinc-400';
		if (btnMappings.some((m) => !m.enabled)) return 'bg-amber-900/50 text-amber-400';
		return 'bg-emerald-900/50 text-emerald-400';
	}

	let filteredSources = $derived.by(() => {
		const q = sourceFilter.toLowerCase();
		const ctrlButtons = getControllerButtons(inputConsole);
		const all = [
			...KEYBOARD_KEYS.map((k) => ({ ...k, type: 'keyboard' as const })),
			...ctrlButtons.map((k) => ({ ...k, type: 'controller' as const }))
		];
		if (!q) return all;
		return all.filter(
			(s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
		);
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-zinc-950">
	<!-- Toolbar -->
	<div class="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
		<span class="text-sm font-medium text-zinc-300">Keyboard Mapper</span>
		<span class="text-xs text-zinc-500">({mappings.length} mappings)</span>
		<div class="flex-1"></div>
		<button
			class="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
			onclick={handleSendToTool}
		>
			Open in Tool
		</button>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<!-- Controller layout -->
		<div class="flex flex-1 flex-col overflow-auto p-4">
			<div class="relative mx-auto w-full max-w-lg" style="aspect-ratio: 16/10;">
				<!-- Controller body outline -->
				<div
					class="absolute inset-0 rounded-3xl border-2 border-zinc-700 bg-zinc-900/50"
				></div>

				<!-- Controller buttons -->
				{#each CONTROLLER_LAYOUT as pos}
					{@const btnName = getLayoutButtonName(pos, outputConsole)}
					{@const btnMappings = getMappingsForButton(btnName)}
					<button
						class="absolute flex flex-col items-center justify-center rounded-md border text-[10px] font-medium transition-colors hover:brightness-125 {selectedButton ===
						btnName
							? 'border-blue-400 ring-2 ring-blue-400/50'
							: 'border-zinc-600'} {getButtonColor(btnName)}"
						style="left: {pos.x}%; top: {pos.y}%; width: {pos.width}%; height: {pos.height}%;"
						onclick={() => handleControllerButtonClick(btnName)}
						title={btnMappings.length > 0
							? btnMappings.map((m) => getButtonLabel(m.source)).join(', ')
							: getButtonLabel(btnName)}
					>
						<span>{getButtonLabel(btnName)}</span>
						{#if btnMappings.length > 0}
							<span class="text-[8px] opacity-75"
								>{getButtonLabel(btnMappings[0].source)}</span
							>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Source assignment popup -->
			{#if assigningSource && selectedButton}
				<div class="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm text-zinc-300">
							Assign to <span class="font-medium text-emerald-400"
								>{getButtonLabel(selectedButton)}</span
							>
						</span>
						<div class="flex items-center gap-2">
							<label class="text-xs text-zinc-500">Input:</label>
							<select
								class="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
								bind:value={inputConsole}
							>
								{#each CONSOLE_TYPES as ct}
									<option value={ct}>{CONSOLE_LABELS[ct]}</option>
								{/each}
							</select>
							<button
								class="text-xs text-zinc-500 hover:text-zinc-300"
								onclick={handleCancelAssign}
							>
								Cancel
							</button>
						</div>
					</div>
					<input
						type="text"
						placeholder="Search keys..."
						bind:value={sourceFilter}
						class="mb-2 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
					/>
					<div class="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
						{#each filteredSources as source}
							<button
								class="rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-[10px] text-zinc-300 transition-colors hover:border-emerald-500 hover:bg-zinc-700"
								onclick={() => handleAssignSource(source.id, source.type)}
								title={source.id}
							>
								{source.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Mapping list -->
		<div class="w-72 overflow-y-auto border-l border-zinc-800 p-3">
			<div class="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
				Mappings
			</div>
			{#if mappings.length === 0}
				<p class="py-4 text-center text-xs text-zinc-600">
					Click a controller button to add a mapping
				</p>
			{:else}
				<div class="space-y-1">
					{#each mappings as mapping, idx}
						<div
							class="group flex items-center gap-2 rounded px-2 py-1.5 text-xs {mapping.enabled
								? 'bg-zinc-800/50'
								: 'bg-zinc-800/20 opacity-50'}"
						>
							<span
								class="rounded px-1.5 py-0.5 {mapping.type === 'keyboard'
									? 'bg-blue-900/50 text-blue-400'
									: 'bg-amber-900/50 text-amber-400'}"
							>
								{getButtonLabel(mapping.source)}
							</span>
							<span class="text-zinc-600">&rarr;</span>
							<span class="text-zinc-300">{getButtonLabel(mapping.target)}</span>
							{#if mapping.value !== 0 && mapping.value !== 100}
								<span class="text-zinc-500">({mapping.value})</span>
							{/if}
							<div class="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
								<button
									class="text-zinc-500 hover:text-zinc-300"
									onclick={() => handleToggleMapping(idx)}
									title={mapping.enabled ? 'Disable' : 'Enable'}
								>
									{mapping.enabled ? '●' : '○'}
								</button>
								<button
									class="text-zinc-500 hover:text-red-400"
									onclick={() => handleRemoveMapping(idx)}
									title="Remove"
								>
									✕
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
