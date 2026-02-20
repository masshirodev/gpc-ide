<script lang="ts">
	import MonacoEditor from './MonacoEditor.svelte';

	interface Props {
		value: string;
		language?: string;
		readonly?: boolean;
		onchange?: (value: string) => void;
		label?: string;
	}

	let { value, language = 'gpc', readonly = false, onchange, label }: Props = $props();

	let expanded = $state(false);
	let expandedValue = $state('');

	function openExpanded() {
		expandedValue = value;
		expanded = true;
	}

	function closeExpanded() {
		if (!readonly && onchange && expandedValue !== value) {
			onchange(expandedValue);
		}
		expanded = false;
	}

	function handleExpandedChange(v: string) {
		expandedValue = v;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			closeExpanded();
		}
	}
</script>

<div class="relative h-full w-full">
	<MonacoEditor {value} {language} {readonly} {onchange} />
	<button
		class="absolute right-1 top-1 z-10 rounded bg-zinc-800/80 p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-700 hover:text-zinc-200 [div:hover>&]:opacity-100"
		onclick={openExpanded}
		title="Expand editor"
	>
		<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
		</svg>
	</button>
</div>

{#if expanded}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
		onmousedown={(e) => { if (e.target === e.currentTarget) closeExpanded(); }}
		onkeydown={handleKeydown}
	>
		<div class="flex h-[80vh] w-[80vw] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
				<span class="text-sm text-zinc-300">{label || 'Code Editor'}{readonly ? ' (read-only)' : ''}</span>
				<button
					class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					onclick={closeExpanded}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-hidden">
				<MonacoEditor
					value={expandedValue}
					{language}
					{readonly}
					onchange={handleExpandedChange}
				/>
			</div>
		</div>
	</div>
{/if}
