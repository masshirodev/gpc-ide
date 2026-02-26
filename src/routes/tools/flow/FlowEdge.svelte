<script lang="ts">
	import type { FlowEdge, FlowNode } from '$lib/types/flow';
	import { getPortPosition } from '$lib/flow/layout';

	interface Props {
		edge: FlowEdge;
		sourceNode: FlowNode;
		targetNode: FlowNode;
		selected: boolean;
		sourceExpanded: boolean;
		targetExpanded: boolean;
		onSelect: (edgeId: string) => void;
	}

	let { edge, sourceNode, targetNode, selected, sourceExpanded, targetExpanded, onSelect }: Props = $props();

	// Source: right side (output port), possibly on a sub-node row
	let sourcePos = $derived(
		getPortPosition(sourceNode, 'output', edge.sourceSubNodeId, sourceExpanded)
	);
	// Target: left side (input port)
	let targetPos = $derived(
		getPortPosition(targetNode, 'input', null, targetExpanded)
	);

	let sx = $derived(sourcePos.x);
	let sy = $derived(sourcePos.y);
	let tx = $derived(targetPos.x);
	let ty = $derived(targetPos.y);

	// Control points for cubic bezier
	let dx = $derived(Math.abs(tx - sx));
	let cpOffset = $derived(Math.max(60, dx * 0.4));

	let path = $derived(
		`M ${sx} ${sy} C ${sx + cpOffset} ${sy}, ${tx - cpOffset} ${ty}, ${tx} ${ty}`
	);

	// Midpoint for label
	let midX = $derived((sx + tx) / 2);
	let midY = $derived((sy + ty) / 2);

	// Whether this edge originates from a sub-node
	let isSubNodeEdge = $derived(!!edge.sourceSubNodeId);

	let conditionLabel = $derived.by(() => {
		if (edge.label) return edge.label;
		switch (edge.condition.type) {
			case 'button_press':
				return edge.condition.button || 'Press';
			case 'button_hold':
				return `Hold ${edge.condition.button || '?'} ${edge.condition.timeoutMs ?? 3000}ms`;
			case 'timeout':
				return `${(edge.condition.timeoutMs ?? 0) / 1000}s`;
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
		stroke={selected ? '#f59e0b' : isSubNodeEdge ? '#6366f1' : '#52525b'}
		stroke-width={selected ? 2.5 : 1.5}
		stroke-dasharray={isSubNodeEdge ? '4,2' : 'none'}
		class="cursor-pointer"
		onclick={(e) => {
			e.stopPropagation();
			onSelect(edge.id);
		}}
	/>

	<!-- Arrowhead -->
	<polygon
		points="{tx - 8},{ty - 4} {tx},{ty} {tx - 8},{ty + 4}"
		fill={selected ? '#f59e0b' : isSubNodeEdge ? '#6366f1' : '#52525b'}
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
