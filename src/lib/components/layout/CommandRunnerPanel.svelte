<script lang="ts">
	import { runCommand, killCommand } from '$lib/tauri/commands';
	import { onRunnerStdout, onRunnerStderr, onRunnerExit } from '$lib/tauri/events';
	import { getGameStore } from '$lib/stores/game.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { onMount } from 'svelte';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	interface OutputLine {
		type: 'stdout' | 'stderr' | 'system';
		text: string;
	}

	let store = getGameStore();
	let settingsStore = getSettings();
	let settings = $derived($settingsStore);

	let commandInput = $state('');
	let output = $state<OutputLine[]>([]);
	let running = $state(false);
	let history = $state<string[]>([]);
	let historyIndex = $state(-1);
	let outputEl: HTMLDivElement | undefined = $state();

	let cwd = $derived(store.selectedGame?.path ?? settings.workspaces[0] ?? '');

	// Auto-scroll to bottom when output changes
	$effect(() => {
		void output.length;
		if (outputEl) {
			requestAnimationFrame(() => {
				outputEl!.scrollTop = outputEl!.scrollHeight;
			});
		}
	});

	onMount(() => {
		let unlistenStdout: UnlistenFn | null = null;
		let unlistenStderr: UnlistenFn | null = null;
		let unlistenExit: UnlistenFn | null = null;

		const setup = async () => {
			unlistenStdout = await onRunnerStdout((line) => {
				output = [...output, { type: 'stdout', text: line }];
			});
			unlistenStderr = await onRunnerStderr((line) => {
				output = [...output, { type: 'stderr', text: line }];
			});
			unlistenExit = await onRunnerExit((exitCode) => {
				output = [
					...output,
					{ type: 'system', text: `Process exited with code ${exitCode}\n` }
				];
				running = false;
			});
		};
		setup();

		return () => {
			unlistenStdout?.();
			unlistenStderr?.();
			unlistenExit?.();
		};
	});

	async function handleRun() {
		const cmd = commandInput.trim();
		if (!cmd || !cwd) return;

		running = true;
		output = [...output, { type: 'system', text: `$ ${cmd}\n` }];
		history = [...history, cmd];
		historyIndex = -1;
		commandInput = '';

		try {
			await runCommand(cwd, cmd);
		} catch (e) {
			output = [...output, { type: 'system', text: `Error: ${e}\n` }];
			running = false;
		}
	}

	async function handleKill() {
		try {
			await killCommand();
		} catch {
			// ignore
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleRun();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (history.length > 0) {
				const newIndex =
					historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
				historyIndex = newIndex;
				commandInput = history[newIndex];
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (historyIndex >= 0) {
				const newIndex = historyIndex + 1;
				if (newIndex >= history.length) {
					historyIndex = -1;
					commandInput = '';
				} else {
					historyIndex = newIndex;
					commandInput = history[newIndex];
				}
			}
		}
	}

	export function clearOutput() {
		output = [];
	}
</script>

<div class="flex h-full flex-col">
	<!-- Output area -->
	<div
		bind:this={outputEl}
		class="min-h-0 flex-1 overflow-auto bg-zinc-950 p-2 font-mono text-xs"
	>
		{#if output.length === 0}
			<span class="text-zinc-600">Run a command below. CWD: {cwd || '(none)'}</span>
		{:else}
			{#each output as line}
				<span
					class="whitespace-pre-wrap {line.type === 'stderr'
						? 'text-red-400/80'
						: line.type === 'system'
							? 'text-zinc-500'
							: 'text-zinc-300'}">{line.text}</span>
			{/each}
		{/if}
	</div>

	<!-- Input area -->
	<div class="flex items-center gap-1 border-t border-zinc-700 bg-zinc-900 px-2 py-1">
		<span class="text-[10px] text-zinc-600">$</span>
		<input
			type="text"
			class="min-w-0 flex-1 border-none bg-transparent font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
			placeholder={running ? 'Process running...' : 'Enter command...'}
			bind:value={commandInput}
			onkeydown={handleKeydown}
			disabled={running}
		/>
		{#if running}
			<button
				class="shrink-0 rounded bg-red-600/80 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-500"
				onclick={handleKill}
			>
				Stop
			</button>
		{:else}
			<button
				class="shrink-0 rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-600 disabled:opacity-40"
				disabled={!commandInput.trim() || !cwd}
				onclick={handleRun}
			>
				Run
			</button>
		{/if}
	</div>
</div>
