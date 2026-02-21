<script lang="ts">
	import type { FlowNode, FlowEdge, FlowConditionType, FlowNodeType, FlowVariable, FlowVariableType } from '$lib/types/flow';
	import type { WidgetPlacement } from '$lib/oled-widgets/types';
	import { NODE_LABELS, NODE_COLORS } from '$lib/types/flow';
	import { listWidgets, getWidget, CATEGORY_LABELS } from '$lib/oled-widgets/registry';
	import MiniMonaco from '$lib/components/editor/MiniMonaco.svelte';
	import ButtonSelect from '$lib/components/inputs/ButtonSelect.svelte';

	interface Props {
		selectedNode: FlowNode | null;
		selectedEdge: FlowEdge | null;
		onUpdateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
		onUpdateEdge: (edgeId: string, updates: Partial<FlowEdge>) => void;
		onSetInitial: (nodeId: string) => void;
		onDuplicate: (nodeId: string) => void;
		onDelete: () => void;
		onEditOled: (nodeId: string) => void;
		onSaveAsChunk?: () => void;
	}

	let {
		selectedNode,
		selectedEdge,
		onUpdateNode,
		onUpdateEdge,
		onSetInitial,
		onDuplicate,
		onDelete,
		onEditOled,
		onSaveAsChunk,
	}: Props = $props();

	const nodeTypes: FlowNodeType[] = ['intro', 'home', 'menu', 'submenu', 'custom', 'screensaver'];
	const conditionTypes: { value: FlowConditionType; label: string }[] = [
		{ value: 'button_press', label: 'Button Press' },
		{ value: 'button_hold', label: 'Button Hold' },
		{ value: 'timeout', label: 'Timeout' },
		{ value: 'variable', label: 'Variable' },
		{ value: 'custom', label: 'Custom Code' },
	];

	let codeTab = $state<'gpc' | 'enter' | 'exit' | 'combo'>('gpc');

	// Local editing state for node
	let editLabel = $state('');
	let editGpcCode = $state('');
	let editOnEnter = $state('');
	let editOnExit = $state('');
	let editComboCode = $state('');

	// Sync node → local state only when a different node is selected
	let lastSyncedNodeId = '';
	$effect(() => {
		if (selectedNode && selectedNode.id !== lastSyncedNodeId) {
			lastSyncedNodeId = selectedNode.id;
			editLabel = selectedNode.label;
			editGpcCode = selectedNode.gpcCode;
			editOnEnter = selectedNode.onEnter;
			editOnExit = selectedNode.onExit;
			editComboCode = selectedNode.comboCode;
		} else if (!selectedNode) {
			lastSyncedNodeId = '';
		}
	});

	// Local editing state for edge
	let editEdgeLabel = $state('');
	let editEdgeButton = $state('');
	let editEdgeTimeoutMs = $state(0);
	let editEdgeCustomCode = $state('');
	let editEdgeVariable = $state('');
	let editEdgeComparison = $state('==');
	let editEdgeValue = $state(0);

	// Sync edge → local state only when a different edge is selected or condition type changes
	let lastSyncedEdgeKey = '';
	$effect(() => {
		if (selectedEdge) {
			const key = `${selectedEdge.id}:${selectedEdge.condition.type}`;
			if (key !== lastSyncedEdgeKey) {
				lastSyncedEdgeKey = key;
				editEdgeLabel = selectedEdge.label;
				editEdgeButton = selectedEdge.condition.button || '';
				editEdgeTimeoutMs = selectedEdge.condition.timeoutMs ?? 3000;
				editEdgeCustomCode = selectedEdge.condition.customCode || '';
				editEdgeVariable = selectedEdge.condition.variable || '';
				editEdgeComparison = selectedEdge.condition.comparison || '==';
				editEdgeValue = selectedEdge.condition.value ?? 0;
			}
		} else {
			lastSyncedEdgeKey = '';
		}
	});

	function commitNodeLabel() {
		if (selectedNode && editLabel !== selectedNode.label) {
			onUpdateNode(selectedNode.id, { label: editLabel });
		}
	}

	function commitNodeCode() {
		if (!selectedNode) return;
		const updates: Partial<FlowNode> = {};
		if (editGpcCode !== selectedNode.gpcCode) updates.gpcCode = editGpcCode;
		if (editOnEnter !== selectedNode.onEnter) updates.onEnter = editOnEnter;
		if (editOnExit !== selectedNode.onExit) updates.onExit = editOnExit;
		if (editComboCode !== selectedNode.comboCode) updates.comboCode = editComboCode;
		if (Object.keys(updates).length > 0) {
			onUpdateNode(selectedNode.id, updates);
		}
	}

	function commitEdge() {
		if (!selectedEdge) return;
		const ctype = selectedEdge.condition.type;
		onUpdateEdge(selectedEdge.id, {
			label: editEdgeLabel,
			condition: {
				...selectedEdge.condition,
				button: editEdgeButton || undefined,
				timeoutMs: ctype === 'button_hold' || ctype === 'timeout' ? editEdgeTimeoutMs : undefined,
				customCode: editEdgeCustomCode || undefined,
				variable: editEdgeVariable || undefined,
				comparison: (editEdgeComparison as FlowEdge['condition']['comparison']) || undefined,
				value: editEdgeValue,
			},
		});
	}

	function addVariable() {
		if (!selectedNode) return;
		const newVar: FlowVariable = {
			name: `var_${selectedNode.variables.length}`,
			type: 'int',
			defaultValue: 0,
			persist: false,
		};
		onUpdateNode(selectedNode.id, {
			variables: [...selectedNode.variables, newVar],
		});
	}

	function removeVariable(index: number) {
		if (!selectedNode) return;
		const vars = [...selectedNode.variables];
		vars.splice(index, 1);
		onUpdateNode(selectedNode.id, { variables: vars });
	}

	function updateVariable(index: number, updates: Partial<FlowVariable>) {
		if (!selectedNode) return;
		const vars = [...selectedNode.variables];
		const current = vars[index];
		// Reset default value when switching between string and numeric types
		if (updates.type && updates.type !== current.type) {
			if (updates.type === 'string' && typeof current.defaultValue !== 'string') {
				updates.defaultValue = '';
				updates.arraySize = 32;
			} else if (updates.type !== 'string' && typeof current.defaultValue === 'string') {
				updates.defaultValue = 0;
				updates.arraySize = undefined;
			}
		}
		vars[index] = { ...current, ...updates };
		onUpdateNode(selectedNode.id, { variables: vars });
	}

	let showWidgetPicker = $state(false);
	let allWidgets = listWidgets();

	function addWidget(widgetId: string) {
		if (!selectedNode) return;
		const w = getWidget(widgetId);
		if (!w) return;
		const defaultConfig: Record<string, unknown> = {};
		for (const p of w.params) {
			defaultConfig[p.key] = p.default;
		}
		const placement: WidgetPlacement = {
			widgetId,
			x: 0,
			y: 0,
			config: defaultConfig,
		};
		onUpdateNode(selectedNode.id, {
			oledWidgets: [...(selectedNode.oledWidgets || []), placement],
		});
		showWidgetPicker = false;
	}

	function removeWidget(index: number) {
		if (!selectedNode) return;
		const widgets = [...(selectedNode.oledWidgets || [])];
		widgets.splice(index, 1);
		onUpdateNode(selectedNode.id, { oledWidgets: widgets });
	}
</script>

<div class="flex h-full w-72 flex-col border-l border-zinc-800 bg-zinc-900">
	{#if selectedNode}
		<!-- Node Properties -->
		<div class="border-b border-zinc-800 px-3 py-2">
			<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Node Properties</h3>
		</div>
		<div class="flex-1 overflow-y-auto px-3 py-2">
			<!-- Label -->
			<div class="mb-3">
				<label class="mb-1 block text-xs text-zinc-400" for="node-label">Label</label>
				<input
					id="node-label"
					type="text"
					class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
					bind:value={editLabel}
					onblur={commitNodeLabel}
					onkeydown={(e) => { if (e.key === 'Enter') commitNodeLabel(); }}
				/>
			</div>

			<!-- Type -->
			<div class="mb-3">
				<label class="mb-1 block text-xs text-zinc-400" for="node-type">Type</label>
				<select
					id="node-type"
					class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
					value={selectedNode.type}
					onchange={(e) => onUpdateNode(selectedNode!.id, { type: (e.target as HTMLSelectElement).value as FlowNodeType })}
				>
					{#each nodeTypes as type}
						<option value={type}>{NODE_LABELS[type]}</option>
					{/each}
				</select>
			</div>

			<!-- Initial state -->
			{#if !selectedNode.isInitialState}
				<button
					class="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
					onclick={() => onSetInitial(selectedNode!.id)}
				>
					Set as Initial State
				</button>
			{:else}
				<div class="mb-3 rounded border border-emerald-800 bg-emerald-950 px-2 py-1.5 text-center text-xs text-emerald-400">
					Initial State
				</div>
			{/if}

			<!-- OLED Scene -->
			<div class="mb-3">
				<label class="mb-1 block text-xs text-zinc-400">OLED Scene</label>
				<button
					class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
					onclick={() => onEditOled(selectedNode!.id)}
				>
					{selectedNode.oledScene ? 'Edit in OLED Tool' : 'Create OLED Scene'}
				</button>
			</div>

			<!-- OLED Widgets -->
			<div class="mb-3">
				<div class="mb-1 flex items-center justify-between">
					<label class="text-xs text-zinc-400">OLED Widgets</label>
					<button
						class="rounded px-1.5 py-0.5 text-xs text-emerald-400 hover:bg-zinc-800"
						onclick={() => (showWidgetPicker = !showWidgetPicker)}
					>
						+ Add
					</button>
				</div>
				{#if showWidgetPicker}
					<div class="mb-2 max-h-32 overflow-y-auto rounded border border-zinc-700 bg-zinc-800 p-1">
						{#each allWidgets as w}
							<button
								class="w-full rounded px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-700"
								onclick={() => addWidget(w.id)}
							>
								{w.name}
							</button>
						{/each}
					</div>
				{/if}
				{#if selectedNode.oledWidgets && selectedNode.oledWidgets.length > 0}
					{#each selectedNode.oledWidgets as wp, i}
						{@const wDef = getWidget(wp.widgetId)}
						<div class="mb-1 flex items-center gap-1 text-xs text-zinc-300">
							<span class="flex-1 truncate">{wDef?.name || wp.widgetId}</span>
							<button
								class="text-zinc-500 hover:text-red-400"
								onclick={() => removeWidget(i)}
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Code Tabs -->
			<div class="mb-2">
				<label class="mb-1 block text-xs text-zinc-400">Code</label>
				<div class="flex gap-0.5 rounded bg-zinc-800 p-0.5">
					{#each [
						{ key: 'gpc', label: 'Main' },
						{ key: 'enter', label: 'Enter' },
						{ key: 'exit', label: 'Exit' },
						{ key: 'combo', label: 'Combo' },
					] as tab}
						<button
							class="flex-1 rounded px-1 py-1 text-xs {codeTab === tab.key ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}"
							onclick={() => {
								commitNodeCode();
								codeTab = tab.key as typeof codeTab;
							}}
						>
							{tab.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="mb-3 h-32 overflow-hidden rounded border border-zinc-700">
				{#if codeTab === 'gpc'}
					<MiniMonaco
						value={editGpcCode}
						language="gpc"
						label="Main Code"
						onchange={(v) => { editGpcCode = v; commitNodeCode(); }}
					/>
				{:else if codeTab === 'enter'}
					<MiniMonaco
						value={editOnEnter}
						language="gpc"
						label="On Enter"
						onchange={(v) => { editOnEnter = v; commitNodeCode(); }}
					/>
				{:else if codeTab === 'exit'}
					<MiniMonaco
						value={editOnExit}
						language="gpc"
						label="On Exit"
						onchange={(v) => { editOnExit = v; commitNodeCode(); }}
					/>
				{:else if codeTab === 'combo'}
					<MiniMonaco
						value={editComboCode}
						language="gpc"
						label="Combo Code"
						onchange={(v) => { editComboCode = v; commitNodeCode(); }}
					/>
				{/if}
			</div>

			<!-- Variables -->
			<div class="mb-3">
				<div class="mb-1 flex items-center justify-between">
					<label class="text-xs text-zinc-400">Variables</label>
					<button
						class="rounded px-1.5 py-0.5 text-xs text-emerald-400 hover:bg-zinc-800"
						onclick={addVariable}
					>
						+ Add
					</button>
				</div>
				{#each selectedNode.variables as variable, i}
					<div class="mb-1 flex items-center gap-1">
						<input
							type="text"
							class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
							value={variable.name}
							onchange={(e) => updateVariable(i, { name: (e.target as HTMLInputElement).value })}
						/>
						<select
							class="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
							value={variable.type}
							onchange={(e) => updateVariable(i, { type: (e.target as HTMLSelectElement).value as FlowVariableType })}
						>
							<option value="int">int</option>
							<option value="int8">int8</option>
							<option value="int16">int16</option>
							<option value="int32">int32</option>
							<option value="string">string</option>
						</select>
						<button
							class="text-zinc-500 hover:text-red-400"
							onclick={() => removeVariable(i)}
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					{#if variable.type === 'string'}
						<div class="mb-1 ml-1 flex items-center gap-1">
							<input
								type="text"
								class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
								value={typeof variable.defaultValue === 'string' ? variable.defaultValue : ''}
								placeholder="Default value"
								onchange={(e) => updateVariable(i, { defaultValue: (e.target as HTMLInputElement).value })}
							/>
							<input
								type="number"
								class="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
								value={variable.arraySize ?? 32}
								title="Array size"
								min="1"
								max="256"
								onchange={(e) => updateVariable(i, { arraySize: parseInt((e.target as HTMLInputElement).value) || 32 })}
							/>
						</div>
					{/if}
				{/each}
			</div>

			<!-- Actions -->
			<div class="mt-4 space-y-2">
				{#if onSaveAsChunk}
					<button
						class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
						onclick={onSaveAsChunk}
					>
						Save as Chunk
					</button>
				{/if}
				<div class="flex gap-2">
					<button
						class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
						onclick={() => onDuplicate(selectedNode!.id)}
					>
						Duplicate
					</button>
					<button
						class="flex-1 rounded border border-red-800 bg-red-950 px-2 py-1.5 text-xs text-red-300 hover:bg-red-900"
						onclick={onDelete}
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	{:else if selectedEdge}
		<!-- Edge Properties -->
		<div class="border-b border-zinc-800 px-3 py-2">
			<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Edge Properties</h3>
		</div>
		<div class="flex-1 overflow-y-auto px-3 py-2">
			<!-- Label -->
			<div class="mb-3">
				<label class="mb-1 block text-xs text-zinc-400" for="edge-label">Label</label>
				<input
					id="edge-label"
					type="text"
					class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
					bind:value={editEdgeLabel}
					onblur={commitEdge}
				/>
			</div>

			<!-- Condition type -->
			<div class="mb-3">
				<label class="mb-1 block text-xs text-zinc-400" for="edge-condition-type">Condition</label>
				<select
					id="edge-condition-type"
					class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
					value={selectedEdge.condition.type}
					onchange={(e) => {
						const newType = (e.target as HTMLSelectElement).value as FlowConditionType;
						const cond = { ...selectedEdge!.condition, type: newType };
						if ((newType === 'button_hold' || newType === 'timeout') && !cond.timeoutMs) {
							cond.timeoutMs = 3000;
						}
						onUpdateEdge(selectedEdge!.id, { condition: cond });
					}}
				>
					{#each conditionTypes as ct}
						<option value={ct.value}>{ct.label}</option>
					{/each}
				</select>
			</div>

			<!-- Condition-specific fields -->
			{#if selectedEdge.condition.type === 'button_press' || selectedEdge.condition.type === 'button_hold'}
				<div class="mb-3">
					<label class="mb-1 block text-xs text-zinc-400">Button</label>
					<ButtonSelect
						value={editEdgeButton}
						onchange={(v) => { editEdgeButton = v; commitEdge(); }}
						placeholder="Search buttons..."
					/>
				</div>
				{#if selectedEdge.condition.type === 'button_hold'}
					<div class="mb-3">
						<label class="mb-1 block text-xs text-zinc-400" for="edge-hold">Hold Duration (ms)</label>
						<input
							id="edge-hold"
							type="number"
							class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
							bind:value={editEdgeTimeoutMs}
							onblur={commitEdge}
						/>
					</div>
				{/if}
			{:else if selectedEdge.condition.type === 'timeout'}
				<div class="mb-3">
					<label class="mb-1 block text-xs text-zinc-400" for="edge-timeout">Timeout (ms)</label>
					<input
						id="edge-timeout"
						type="number"
						class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
						bind:value={editEdgeTimeoutMs}
						onblur={commitEdge}
					/>
				</div>
			{:else if selectedEdge.condition.type === 'variable'}
				<div class="mb-3">
					<label class="mb-1 block text-xs text-zinc-400" for="edge-var">Variable</label>
					<input
						id="edge-var"
						type="text"
						class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
						bind:value={editEdgeVariable}
						onblur={commitEdge}
					/>
				</div>
				<div class="mb-3 flex gap-2">
					<select
						class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
						bind:value={editEdgeComparison}
						onchange={commitEdge}
					>
						<option value="==">==</option>
						<option value="!=">!=</option>
						<option value=">">&gt;</option>
						<option value="<">&lt;</option>
						<option value=">=">&gt;=</option>
						<option value="<=">&lt;=</option>
					</select>
					<input
						type="number"
						class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
						bind:value={editEdgeValue}
						onblur={commitEdge}
					/>
				</div>
			{:else if selectedEdge.condition.type === 'custom'}
				<div class="mb-3">
					<label class="mb-1 block text-xs text-zinc-400">Custom Condition</label>
					<div class="h-20 overflow-hidden rounded border border-zinc-700">
						<MiniMonaco
							value={editEdgeCustomCode}
							language="gpc"
							label="Custom Condition"
							onchange={(v) => { editEdgeCustomCode = v; commitEdge(); }}
						/>
					</div>
				</div>
			{/if}

			<!-- Delete -->
			<button
				class="mt-4 w-full rounded border border-red-800 bg-red-950 px-2 py-1.5 text-xs text-red-300 hover:bg-red-900"
				onclick={onDelete}
			>
				Delete Edge
			</button>
		</div>
	{:else}
		<!-- No selection -->
		<div class="border-b border-zinc-800 px-3 py-2">
			<h3 class="text-xs font-medium uppercase tracking-wider text-zinc-500">Properties</h3>
		</div>
		<div class="flex-1 px-3 py-4">
			<p class="text-xs text-zinc-500">
				Select a node or edge to edit its properties.
			</p>
			<div class="mt-4 space-y-2 text-xs text-zinc-600">
				<p>Drag from an output port (right) to an input port (left) to create edges.</p>
				<p>Middle-click or Alt+drag to pan. Scroll to zoom.</p>
				<p>Press Delete to remove selected items.</p>
			</div>
		</div>
	{/if}
</div>
