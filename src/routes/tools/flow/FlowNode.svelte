<script lang="ts">
	import type { FlowNode } from '$lib/types/flow';
	import { NODE_COLORS, NODE_LABELS } from '$lib/types/flow';

	interface Props {
		node: FlowNode;
		selected: boolean;
		onSelect: (nodeId: string) => void;
		onStartConnect: (nodeId: string, port: string, e: MouseEvent) => void;
		onPortDrop: (nodeId: string) => void;
	}

	let { node, selected, onSelect, onStartConnect, onPortDrop }: Props = $props();

	const NODE_WIDTH = 220;
	const NODE_HEIGHT = 100;
	const PORT_RADIUS = 6;
	const HEADER_HEIGHT = 24;

	let color = $derived(NODE_COLORS[node.type] || '#6b7280');
	let hasCode = $derived(node.gpcCode.trim().length > 0);
	let hasOled = $derived(node.oledScene !== null);
	let hasCombo = $derived(node.comboCode.trim().length > 0);
</script>

<g
	class="flow-node cursor-grab"
	transform="translate({node.position.x},{node.position.y})"
>
	<!-- Drop shadow -->
	<rect
		x="2"
		y="2"
		width={NODE_WIDTH}
		height={NODE_HEIGHT}
		rx="6"
		fill="rgba(0,0,0,0.3)"
	/>

	<!-- Node body -->
	<rect
		width={NODE_WIDTH}
		height={NODE_HEIGHT}
		rx="6"
		fill="#18181b"
		stroke={selected ? '#f59e0b' : color}
		stroke-width={selected ? 2.5 : 1.5}
	/>

	<!-- Header bar -->
	<rect
		width={NODE_WIDTH}
		height={HEADER_HEIGHT}
		rx="6"
		fill={color}
	/>
	<!-- Cover bottom corners of header -->
	<rect
		y={HEADER_HEIGHT - 6}
		width={NODE_WIDTH}
		height="6"
		fill={color}
	/>

	<!-- Initial state indicator -->
	{#if node.isInitialState}
		<circle cx="12" cy={HEADER_HEIGHT / 2} r="4" fill="#fff" opacity="0.8" />
	{/if}

	<!-- Node label -->
	<text
		x={node.isInitialState ? 22 : 10}
		y={HEADER_HEIGHT / 2 + 1}
		fill="#fff"
		font-size="11"
		font-weight="600"
		dominant-baseline="middle"
		style="pointer-events: none; user-select: none;"
	>
		{node.label}
	</text>

	<!-- Type badge -->
	<text
		x={NODE_WIDTH - 10}
		y={HEADER_HEIGHT / 2 + 1}
		fill="rgba(255,255,255,0.6)"
		font-size="9"
		text-anchor="end"
		dominant-baseline="middle"
		style="pointer-events: none; user-select: none;"
	>
		{NODE_LABELS[node.type]}
	</text>

	<!-- Content indicators -->
	<g transform="translate(10, {HEADER_HEIGHT + 12})">
		{#if hasCode}
			<g>
				<rect width="14" height="14" rx="2" fill="#27272a" stroke="#3f3f46" stroke-width="0.5" />
				<text x="7" y="11" text-anchor="middle" fill="#a78bfa" font-size="8" style="pointer-events: none; user-select: none;">C</text>
			</g>
		{/if}
		{#if hasOled}
			<g transform="translate({hasCode ? 18 : 0}, 0)">
				<rect width="14" height="14" rx="2" fill="#27272a" stroke="#3f3f46" stroke-width="0.5" />
				<text x="7" y="11" text-anchor="middle" fill="#34d399" font-size="8" style="pointer-events: none; user-select: none;">O</text>
			</g>
		{/if}
		{#if hasCombo}
			<g transform="translate({(hasCode ? 18 : 0) + (hasOled ? 18 : 0)}, 0)">
				<rect width="14" height="14" rx="2" fill="#27272a" stroke="#3f3f46" stroke-width="0.5" />
				<text x="7" y="11" text-anchor="middle" fill="#f472b6" font-size="8" style="pointer-events: none; user-select: none;">X</text>
			</g>
		{/if}
	</g>

	<!-- Variables count -->
	{#if node.variables.length > 0}
		<text
			x={NODE_WIDTH - 10}
			y={NODE_HEIGHT - 12}
			fill="#71717a"
			font-size="9"
			text-anchor="end"
			style="pointer-events: none; user-select: none;"
		>
			{node.variables.length} var{node.variables.length !== 1 ? 's' : ''}
		</text>
	{/if}

	<!-- Input port (left) -->
	<circle
		cx={0}
		cy={NODE_HEIGHT / 2}
		r={PORT_RADIUS}
		fill="#27272a"
		stroke="#71717a"
		stroke-width="1.5"
		class="cursor-crosshair"
		onmousedown={(e) => {
			e.stopPropagation();
		}}
		onmouseup={(e) => {
			e.stopPropagation();
			onPortDrop(node.id);
		}}
	/>

	<!-- Output port (right) -->
	<circle
		cx={NODE_WIDTH}
		cy={NODE_HEIGHT / 2}
		r={PORT_RADIUS}
		fill="#27272a"
		stroke={color}
		stroke-width="1.5"
		class="cursor-crosshair"
		onmousedown={(e) => {
			e.stopPropagation();
			e.preventDefault();
			onStartConnect(node.id, 'right', e);
		}}
	/>
</g>
