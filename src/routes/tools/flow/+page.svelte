<script lang="ts">
	import FlowCanvas from './FlowCanvas.svelte';
	import FlowToolbar from './FlowToolbar.svelte';
	import FlowPropertyPanel from './FlowPropertyPanel.svelte';
	import ChunkLibrary from './ChunkLibrary.svelte';
	import ChunkSaveModal from './ChunkSaveModal.svelte';
	import { addToast } from '$lib/stores/toast.svelte';
	import { getSettings } from '$lib/stores/settings.svelte';
	import { getGameStore } from '$lib/stores/game.svelte';
	import {
		getFlowStore,
		getSelectedNode,
		getSelectedEdge,
		canUndo,
		canRedo,
		newGraph,
		loadGraph,
		closeGraph,
		markClean,
		addNode,
		removeNode,
		updateNode,
		moveNode,
		moveNodeDone,
		setInitialState,
		duplicateNode,
		removeEdge,
		updateEdge,
		selectNode,
		selectEdge,
		clearSelection,
		setPan,
		setZoom,
		zoomToFit,
		startConnecting,
		updateConnecting,
		finishConnecting,
		cancelConnecting,
		undo,
		redo,
	} from '$lib/stores/flow.svelte';
	import { saveFlowGraph, loadFlowGraph } from '$lib/tauri/commands';
	import { generateFlowGpc } from '$lib/flow/codegen';
	import { setFlowOledTransfer } from '$lib/stores/flow-transfer.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { FlowNodeType, FlowChunk } from '$lib/types/flow';
	import { createFlowNode } from '$lib/types/flow';

	let settingsStore = getSettings();
	let settings = $derived($settingsStore);
	let gameStore = getGameStore();
	let flowStore = getFlowStore();

	let selectedNode = $derived(getSelectedNode());
	let selectedEdge = $derived(getSelectedEdge());
	let hasSelection = $derived(flowStore.selectedNodeId !== null || flowStore.selectedEdgeId !== null);
	let showChunkSave = $state(false);
	let showChunkLibrary = $state(true);

	// Load flow graph from selected game on mount
	onMount(async () => {
		if (gameStore.selectedGame && !flowStore.graph) {
			try {
				const graph = await loadFlowGraph(gameStore.selectedGame.path);
				if (graph) {
					loadGraph(graph, gameStore.selectedGame.path);
				}
			} catch {
				// No flow graph exists yet
			}
		}
		if (!flowStore.graph) {
			newGraph(gameStore.selectedGame?.name || 'Untitled Flow', gameStore.selectedGame?.path);
		}
	});

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

		if (e.key === 'Delete' || e.key === 'Backspace') {
			deleteSelected();
		} else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
			e.preventDefault();
			undo();
		} else if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
			e.preventDefault();
			redo();
		} else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSave();
		} else if (e.key === 'Escape') {
			clearSelection();
			cancelConnecting();
		}
	}

	function handleAddNode(type: FlowNodeType) {
		// Place at center of visible area, offset to avoid stacking
		const baseX = -flowStore.canvas.panX + 300;
		const baseY = -flowStore.canvas.panY + 200;
		const nodeCount = flowStore.graph?.nodes.length ?? 0;
		const offsetX = (nodeCount % 4) * 260;
		const offsetY = Math.floor(nodeCount / 4) * 140;
		const node = addNode(type, { x: baseX + offsetX, y: baseY + offsetY });
		if (node) {
			selectNode(node.id);
		}
	}

	function deleteSelected() {
		if (flowStore.selectedNodeId) {
			removeNode(flowStore.selectedNodeId);
		} else if (flowStore.selectedEdgeId) {
			removeEdge(flowStore.selectedEdgeId);
		}
	}

	async function handleSave() {
		if (!flowStore.graph) return;
		const gamePath = flowStore.gamePath || gameStore.selectedGame?.path;
		if (!gamePath) {
			addToast('No game selected. Select a game first to save the flow graph.', 'warning');
			return;
		}
		try {
			await saveFlowGraph(gamePath, flowStore.graph);
			markClean();
			addToast('Flow graph saved', 'success');
		} catch (e) {
			addToast(`Failed to save flow graph: ${e}`, 'error');
		}
	}

	async function handleLoad() {
		const gamePath = gameStore.selectedGame?.path;
		if (!gamePath) {
			addToast('Select a game first', 'warning');
			return;
		}
		try {
			const graph = await loadFlowGraph(gamePath);
			if (graph) {
				loadGraph(graph, gamePath);
				addToast('Flow graph loaded', 'success');
			} else {
				addToast('No flow graph found for this game', 'info');
			}
		} catch (e) {
			addToast(`Failed to load: ${e}`, 'error');
		}
	}

	function handleNewGraph() {
		const name = gameStore.selectedGame?.name || 'Untitled Flow';
		newGraph(name, gameStore.selectedGame?.path);
		addToast('New flow graph created', 'success');
	}

	async function handleExport() {
		if (!flowStore.graph) return;
		try {
			const gpcCode = generateFlowGpc(flowStore.graph);
			await navigator.clipboard.writeText(gpcCode);
			addToast('GPC code copied to clipboard', 'success');
		} catch (e) {
			addToast(`Failed to export: ${e}`, 'error');
		}
	}

	function handleEditOled(nodeId: string) {
		const node = flowStore.graph?.nodes.find((n) => n.id === nodeId);
		if (!node) return;

		setFlowOledTransfer({
			nodeId,
			scene: node.oledScene || {
				id: crypto.randomUUID(),
				name: node.label,
				pixels: btoa(String.fromCharCode(...new Uint8Array(1024))),
			},
			returnTo: flowStore.gamePath,
		});
		goto('/tools/oled');
	}

	function handleStartConnect(nodeId: string, port: string, e: MouseEvent) {
		startConnecting(nodeId, port, e.clientX, e.clientY);
	}

	function handleInsertChunk(chunk: FlowChunk) {
		const nodeCount = flowStore.graph?.nodes.length ?? 0;
		const x = -flowStore.canvas.panX + 300 + (nodeCount % 4) * 260;
		const y = -flowStore.canvas.panY + 200 + Math.floor(nodeCount / 4) * 140;
		const template = chunk.nodeTemplate;
		const node = createFlowNode(
			(template.type as FlowNodeType) || 'custom',
			template.label || chunk.name,
			{ x, y }
		);
		// Apply template properties
		if (template.gpcCode !== undefined) node.gpcCode = template.gpcCode;
		if (template.oledScene !== undefined) node.oledScene = template.oledScene ?? null;
		if (template.oledWidgets) node.oledWidgets = template.oledWidgets;
		if (template.comboCode !== undefined) node.comboCode = template.comboCode;
		if (template.variables) node.variables = structuredClone(template.variables);
		if (template.onEnter !== undefined) node.onEnter = template.onEnter;
		if (template.onExit !== undefined) node.onExit = template.onExit;
		node.chunkRef = chunk.id;

		if (!flowStore.graph) return;
		// Use addNode internals - push directly
		const { addNode: _, ...rest } = { addNode };
		// Actually use updateNode-like pattern: manually insert
		updateNode('__new__', {}); // trigger undo push won't work, let's do it differently
		// Just call addNode and then update
		const created = addNode(node.type, { x, y });
		if (created) {
			updateNode(created.id, {
				label: node.label,
				gpcCode: node.gpcCode,
				oledScene: node.oledScene,
				oledWidgets: node.oledWidgets,
				comboCode: node.comboCode,
				variables: node.variables,
				onEnter: node.onEnter,
				onExit: node.onExit,
				chunkRef: node.chunkRef,
			});
			selectNode(created.id);
		}
	}

	function handleSaveAsChunk() {
		showChunkSave = true;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col bg-zinc-950 text-zinc-100">
	<!-- Header -->
	<div class="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
		<a href="/" class="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
			<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Back
		</a>
		<h1 class="text-xl font-bold">Flow Editor</h1>
		{#if gameStore.selectedGame}
			<span class="text-sm text-zinc-500">{gameStore.selectedGame.name}</span>
		{/if}
	</div>

	<!-- Toolbar -->
	{#if flowStore.graph}
		<FlowToolbar
			onAddNode={handleAddNode}
			onDeleteSelected={deleteSelected}
			onZoomIn={() => setZoom(flowStore.canvas.zoom * 1.2)}
			onZoomOut={() => setZoom(flowStore.canvas.zoom * 0.8)}
			onZoomFit={zoomToFit}
			onUndo={undo}
			onRedo={redo}
			onSave={handleSave}
			onExport={handleExport}
			onNewGraph={handleNewGraph}
			onLoadGraph={handleLoad}
			canUndo={canUndo()}
			canRedo={canRedo()}
			{hasSelection}
			dirty={flowStore.dirty}
			graphName={flowStore.graph.name}
		/>
	{/if}

	<!-- Main content -->
	<div class="flex min-h-0 flex-1">
		{#if flowStore.graph}
			<!-- Chunk Library -->
			{#if showChunkLibrary}
				<ChunkLibrary onInsertChunk={handleInsertChunk} />
			{/if}

			<!-- Canvas -->
			<FlowCanvas
				graph={flowStore.graph}
				selectedNodeId={flowStore.selectedNodeId}
				selectedEdgeId={flowStore.selectedEdgeId}
				connecting={flowStore.connecting}
				panX={flowStore.canvas.panX}
				panY={flowStore.canvas.panY}
				zoom={flowStore.canvas.zoom}
				onSelectNode={selectNode}
				onSelectEdge={selectEdge}
				onMoveNode={moveNode}
				onMoveNodeDone={moveNodeDone}
				onStartConnect={handleStartConnect}
				onFinishConnect={finishConnecting}
				onUpdateConnect={(mx, my) => updateConnecting(mx, my)}
				onPan={setPan}
				onZoom={setZoom}
			/>

			<!-- Property panel -->
			<FlowPropertyPanel
				{selectedNode}
				{selectedEdge}
				onUpdateNode={updateNode}
				onUpdateEdge={updateEdge}
				onSetInitial={setInitialState}
				onDuplicate={duplicateNode}
				onDelete={deleteSelected}
				onEditOled={handleEditOled}
				onSaveAsChunk={handleSaveAsChunk}
			/>
		{:else}
			<div class="flex flex-1 items-center justify-center text-sm text-zinc-500">
				<div class="text-center">
					<p class="mb-4">No flow graph loaded.</p>
					<div class="flex gap-3">
						<button
							class="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
							onclick={handleNewGraph}
						>
							Create New
						</button>
						<button
							class="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
							onclick={handleLoad}
						>
							Load Existing
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<ChunkSaveModal open={showChunkSave} node={selectedNode} onclose={() => (showChunkSave = false)} />
