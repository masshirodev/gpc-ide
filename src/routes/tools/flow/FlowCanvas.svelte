<script lang="ts">
	import type { FlowGraph, FlowNode as FlowNodeType } from '$lib/types/flow';
	import FlowNode from './FlowNode.svelte';
	import FlowEdge from './FlowEdge.svelte';

	interface Props {
		graph: FlowGraph;
		selectedNodeId: string | null;
		selectedEdgeId: string | null;
		connecting: { sourceNodeId: string; sourcePort: string; mouseX: number; mouseY: number } | null;
		panX: number;
		panY: number;
		zoom: number;
		onSelectNode: (nodeId: string | null) => void;
		onSelectEdge: (edgeId: string | null) => void;
		onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
		onMoveNodeDone: (nodeId: string) => void;
		onStartConnect: (nodeId: string, port: string, e: MouseEvent) => void;
		onFinishConnect: (targetNodeId: string | null) => void;
		onUpdateConnect: (mx: number, my: number) => void;
		onPan: (x: number, y: number) => void;
		onZoom: (zoom: number) => void;
	}

	let {
		graph,
		selectedNodeId,
		selectedEdgeId,
		connecting,
		panX,
		panY,
		zoom,
		onSelectNode,
		onSelectEdge,
		onMoveNode,
		onMoveNodeDone,
		onStartConnect,
		onFinishConnect,
		onUpdateConnect,
		onPan,
		onZoom,
	}: Props = $props();

	let svgEl: SVGSVGElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();
	let containerWidth = $state(800);
	let containerHeight = $state(600);

	// Dragging state
	let dragging = $state<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
	let panning = $state<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

	// ResizeObserver for container size
	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
				containerHeight = entry.contentRect.height;
			}
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	// Convert screen coordinates to SVG coordinates
	function screenToSvg(clientX: number, clientY: number): { x: number; y: number } {
		if (!svgEl) return { x: 0, y: 0 };
		const rect = svgEl.getBoundingClientRect();
		return {
			x: (clientX - rect.left) / zoom - panX,
			y: (clientY - rect.top) / zoom - panY,
		};
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		onZoom(zoom * delta);
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			// Middle click or Alt+Left click for panning
			e.preventDefault();
			panning = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
		} else if (e.button === 0) {
			// Left click on background — clear selection
			onSelectNode(null);
			onSelectEdge(null);
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (panning) {
			const dx = (e.clientX - panning.startX) / zoom;
			const dy = (e.clientY - panning.startY) / zoom;
			onPan(panning.startPanX + dx, panning.startPanY + dy);
		} else if (dragging) {
			const pos = screenToSvg(e.clientX, e.clientY);
			onMoveNode(dragging.nodeId, {
				x: pos.x - dragging.offsetX,
				y: pos.y - dragging.offsetY,
			});
		} else if (connecting) {
			const pos = screenToSvg(e.clientX, e.clientY);
			onUpdateConnect(pos.x, pos.y);
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (panning) {
			panning = null;
		}
		if (dragging) {
			onMoveNodeDone(dragging.nodeId);
			dragging = null;
		}
		if (connecting) {
			onFinishConnect(null);
		}
	}

	function handleNodeSelect(nodeId: string) {
		onSelectNode(nodeId);
	}

	function handleNodeMouseDown(nodeId: string, e: MouseEvent) {
		const node = graph.nodes.find((n) => n.id === nodeId);
		if (!node) return;
		const pos = screenToSvg(e.clientX, e.clientY);
		dragging = {
			nodeId,
			offsetX: pos.x - node.position.x,
			offsetY: pos.y - node.position.y,
		};
		onSelectNode(nodeId);
	}

	function handleStartConnect(nodeId: string, port: string, e: MouseEvent) {
		onStartConnect(nodeId, port, e);
	}

	function handlePortDrop(nodeId: string) {
		if (connecting) {
			onFinishConnect(nodeId);
		}
	}

	// Connecting line from source to mouse
	let connectLineSource = $derived.by(() => {
		if (!connecting) return null;
		const sourceNode = graph.nodes.find((n) => n.id === connecting.sourceNodeId);
		if (!sourceNode) return null;
		return {
			x: sourceNode.position.x + 220,
			y: sourceNode.position.y + 50,
		};
	});

	// Grid pattern
	let gridSize = $derived(40 * zoom);

	// viewBox
	let vb = $derived(
		`${-panX} ${-panY} ${containerWidth / zoom} ${containerHeight / zoom}`
	);
</script>

<div
	bind:this={containerEl}
	class="relative flex-1 overflow-hidden bg-zinc-950"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		bind:this={svgEl}
		width="100%"
		height="100%"
		viewBox={vb}
		onwheel={handleWheel}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		class="select-none"
		style="cursor: {panning ? 'grabbing' : dragging ? 'grabbing' : 'default'}"
	>
		<defs>
			<!-- Grid pattern -->
			<pattern id="flow-grid" width="40" height="40" patternUnits="userSpaceOnUse">
				<circle cx="0.5" cy="0.5" r="0.5" fill="#27272a" />
			</pattern>
			<!-- Arrow marker -->
			<marker
				id="flow-arrow"
				viewBox="0 0 10 10"
				refX="10"
				refY="5"
				markerWidth="8"
				markerHeight="8"
				orient="auto-start-reverse"
			>
				<path d="M 0 0 L 10 5 L 0 10 z" fill="#52525b" />
			</marker>
		</defs>

		<!-- Background grid -->
		<rect
			x={-panX - 1000}
			y={-panY - 1000}
			width={containerWidth / zoom + 2000}
			height={containerHeight / zoom + 2000}
			fill="url(#flow-grid)"
		/>

		<!-- Edges (render below nodes) -->
		{#each graph.edges as edge (edge.id)}
			{@const sourceNode = graph.nodes.find((n) => n.id === edge.sourceNodeId)}
			{@const targetNode = graph.nodes.find((n) => n.id === edge.targetNodeId)}
			{#if sourceNode && targetNode}
				<FlowEdge
					{edge}
					{sourceNode}
					{targetNode}
					selected={selectedEdgeId === edge.id}
					onSelect={(id) => onSelectEdge(id)}
				/>
			{/if}
		{/each}

		<!-- Connecting line (while dragging to create edge) -->
		{#if connecting && connectLineSource}
			<path
				d="M {connectLineSource.x} {connectLineSource.y} C {connectLineSource.x + 60} {connectLineSource.y}, {connecting.mouseX - 60} {connecting.mouseY}, {connecting.mouseX} {connecting.mouseY}"
				fill="none"
				stroke="#f59e0b"
				stroke-width="2"
				stroke-dasharray="6,3"
				opacity="0.7"
			/>
		{/if}

		<!-- Nodes -->
		{#each graph.nodes as node (node.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				onmousedown={(e) => {
					if (e.button === 0 && !e.altKey) {
						e.stopPropagation();
						handleNodeMouseDown(node.id, e);
					}
				}}
			>
				<FlowNode
					{node}
					selected={selectedNodeId === node.id}
					onSelect={handleNodeSelect}
					onStartConnect={handleStartConnect}
					onPortDrop={handlePortDrop}
				/>
			</g>
		{/each}
	</svg>

	<!-- Zoom indicator -->
	<div class="absolute bottom-3 right-3 rounded bg-zinc-800/80 px-2 py-1 text-xs text-zinc-400">
		{Math.round(zoom * 100)}%
	</div>
</div>
