<script lang="ts">
	import { runTask } from '$lib/tauri/commands';
	import type { TaskResult } from '$lib/tauri/commands';
	import { addToast } from '$lib/stores/toast.svelte';

	interface TaskDef {
		id: string;
		label: string;
		command: string;
	}

	interface Props {
		gamePath: string;
	}

	let { gamePath }: Props = $props();

	// Persist tasks per game in localStorage
	let storageKey = $derived(`gpc-ide-tasks:${gamePath}`);

	let tasks = $state<TaskDef[]>([]);
	let newLabel = $state('');
	let newCommand = $state('');
	let runningTaskId = $state<string | null>(null);
	let lastResult = $state<{ taskId: string; result: TaskResult } | null>(null);

	// Load tasks from localStorage
	$effect(() => {
		const key = storageKey;
		try {
			const stored = localStorage.getItem(key);
			if (stored) {
				tasks = JSON.parse(stored);
			} else {
				tasks = [];
			}
		} catch {
			tasks = [];
		}
	});

	function saveTasks() {
		localStorage.setItem(storageKey, JSON.stringify(tasks));
	}

	function addTask() {
		if (!newLabel.trim() || !newCommand.trim()) return;
		const task: TaskDef = {
			id: crypto.randomUUID(),
			label: newLabel.trim(),
			command: newCommand.trim()
		};
		tasks = [...tasks, task];
		newLabel = '';
		newCommand = '';
		saveTasks();
	}

	function removeTask(id: string) {
		tasks = tasks.filter((t) => t.id !== id);
		saveTasks();
	}

	async function executeTask(task: TaskDef) {
		runningTaskId = task.id;
		lastResult = null;
		try {
			const result = await runTask(gamePath, task.command);
			lastResult = { taskId: task.id, result };
			if (result.success) {
				addToast(`Task "${task.label}" completed`, 'success');
			} else {
				addToast(`Task "${task.label}" failed (exit ${result.exit_code})`, 'error');
			}
		} catch (e) {
			addToast(`Task "${task.label}" error: ${e}`, 'error');
		} finally {
			runningTaskId = null;
		}
	}
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
	<h3 class="mb-3 text-sm font-semibold text-zinc-300">Task Runner</h3>

	<!-- Task list -->
	{#if tasks.length > 0}
		<div class="mb-3 space-y-1.5">
			{#each tasks as task}
				<div class="group flex items-center gap-2 rounded bg-zinc-800/50 px-3 py-2">
					<div class="min-w-0 flex-1">
						<div class="text-xs font-medium text-zinc-200">{task.label}</div>
						<div class="truncate font-mono text-[10px] text-zinc-500">{task.command}</div>
					</div>
					<button
						class="shrink-0 rounded bg-emerald-600/80 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
						disabled={runningTaskId !== null}
						onclick={() => executeTask(task)}
					>
						{runningTaskId === task.id ? 'Running...' : 'Run'}
					</button>
					<button
						class="shrink-0 rounded p-1 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400"
						onclick={() => removeTask(task.id)}
						title="Remove task"
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add new task -->
	<div class="flex gap-2">
		<input
			type="text"
			class="w-28 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
			placeholder="Label"
			bind:value={newLabel}
		/>
		<input
			type="text"
			class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
			placeholder="Command (e.g. ls -la)"
			bind:value={newCommand}
			onkeydown={(e) => { if (e.key === 'Enter') addTask(); }}
		/>
		<button
			class="shrink-0 rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-40"
			disabled={!newLabel.trim() || !newCommand.trim()}
			onclick={addTask}
		>
			Add
		</button>
	</div>

	<!-- Last task output -->
	{#if lastResult}
		<div class="mt-3 rounded border border-zinc-700 bg-zinc-950 p-2">
			<div class="mb-1 flex items-center gap-2">
				<span class="text-[10px] font-medium {lastResult.result.success ? 'text-emerald-400' : 'text-red-400'}">
					Exit {lastResult.result.exit_code}
				</span>
			</div>
			{#if lastResult.result.stdout}
				<pre class="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-400">{lastResult.result.stdout}</pre>
			{/if}
			{#if lastResult.result.stderr}
				<pre class="max-h-20 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-red-400/70">{lastResult.result.stderr}</pre>
			{/if}
		</div>
	{/if}
</div>
