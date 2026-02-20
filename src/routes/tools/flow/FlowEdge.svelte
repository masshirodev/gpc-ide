<script lang="ts">
	import type { FlowEdge, FlowNode } from '$lib/types/flow';

	interface Props {
		edge: FlowEdge;
		sourceNode: FlowNode;
		targetNode: FlowNode;
		selected: boolean;
		onSelect: (edgeId: string) => void;
	}

	let { edge, sourceNode, targetNode, selected, onSelect }: Props = $props();

	const NODE_WIDTH = 220;
	const NODE_HEIGHT = 100;

	// Source: right side of source node
	let sx = $derived(sourceNode.position.x + NODE_WIDTH);
	let sy = $derived(sourceNode.position.y + NODE_HEIGHT / 2);

	// Target: left side of target node
	let tx = $derived(targetNode.position.x);
	let ty = $derived(targetNode.position.y + NODE_HEIGHT / 2);

	// Control points for cubic bezier
	let dx = $derived(Math.abs(tx - sx));
	let cpOffset = $derived(Math.max(60, dx * 0.4));

	let path = $derived(
		`M ${sx} ${sy} C ${sx + cpOffset} ${sy}, ${tx - cpOffset} ${ty}, ${tx} ${ty}`
	);

	// Midpoint for label
	let midX = $derived((sx + tx) / 2);
	let midY = $derived((sy + ty) / 2);

	let conditionLabel = $derived.by(() => {
		if (edge.label) return edge.label;
		switch (edge.condition.type) {
			case 'button_press':
				return edge.condition.button || 'Press';
			case 'button_hold':
				return `Hold ${edge.condition.button || '?'} ${edge.condition.timeoutMs || 0}ms`;
			case 'timeout':
				return `${(edge.condition.timeoutMs || 0) / 1000}s`;
			case 'variable':
				return `${edge.condition.variable || '?'} ${edge.condition.comparison || '=='} ${edge.condition.value ?? 0}`;
			case 'custom':
				return 'Custom';
			default:
				return '';
		}
	});
</script>

<g class="flow-edge">
	<!-- Invisible wider path for easier clicking -->
	<path
		d={path}
		fill="none"
		stroke="transparent"
		stroke-width="12"
		class="cursor-pointer"
		onclick={(e) => {
			e.stopPropagation();
			onSelect(edge.id);
		}}
	/>

	<!-- Visible path -->
	<path
		d={path}
		fill="none"
		stroke={selected ? '#f59e0b' : '#52525b'}
		stroke-width={selected ? 2.5 : 1.5}
		class="cursor-pointer"
		onclick={(e) => {
			e.stopPropagation();
			onSelect(edge.id);
		}}
	/>

	<!-- Arrowhead -->
	<polygon
		points="{tx - 8},{ty - 4} {tx},{ty} {tx - 8},{ty + 4}"
		fill={selected ? '#f59e0b' : '#52525b'}
	/>

	<!-- Label -->
	{#if conditionLabel}
		<g transform="translate({midX}, {midY})">
			<rect
				x={-conditionLabel.length * 3 - 4}
				y="-10"
				width={conditionLabel.length * 6 + 8}
				height="16"
				rx="3"
				fill="#27272a"
				stroke={selected ? '#f59e0b' : '#3f3f46'}
				stroke-width="0.5"
			/>
			<text
				text-anchor="middle"
				y="2"
				fill={selected ? '#fbbf24' : '#a1a1aa'}
				font-size="9"
				style="pointer-events: none; user-select: none;"
			>
				{conditionLabel}
			</text>
		</g>
	{/if}
</g>
