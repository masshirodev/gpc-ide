<script lang="ts">
	import type { FlowNode, SubNode } from '$lib/types/flow';
	import { renderNodePreview, pixelsToDataUrl } from '$lib/flow/oled-preview';
	import { computeSubNodePixelY, getSortedSubNodes } from '$lib/flow/layout';
	import { getSubNodeDef } from '$lib/flow/subnodes/registry';

	interface Props {
		node: FlowNode;
		selectedSubNodeId: string | null;
		onUpdateSubNode: (nodeId: string, subNodeId: string, updates: Partial<SubNode>) => void;
		onSelectSubNode: (nodeId: string, subNodeId: string | null) => void;
	}

	let { node, selectedSubNodeId, onUpdateSubNode, onSelectSubNode }: Props = $props();

	const SCALE = 3;
	const WIDTH = 128;
	const HEIGHT = 64;

	let containerEl: HTMLDivElement | undefined = $state();
	let dragging = $state<{ subNodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

	let preview = $derived(
		typeof document !== 'undefined' ? pixelsToDataUrl(renderNodePreview(node)) : ''
	);

	// Get absolute sub-nodes with their bounds for interaction
	let absoluteSubNodes = $derived.by(() => {
		const sorted = getSortedSubNodes(node);
		return sorted
			.filter((sub) => sub.position === 'absolute' && sub.type !== 'pixel-art' && sub.type !== 'animation' && !sub.hidden)
			.map((sub) => {
				const def = getSubNodeDef(sub.type);
				const y = computeSubNodePixelY(node, sub);
				const x = sub.x ?? 0;
				const h = def?.stackHeight ?? 8;
				return { sub, x, y, w: 128 - x, h };
			});
	});

	function handleMouseDown(e: MouseEvent, subNode: typeof absoluteSubNodes[number]) {
		e.preventDefault();
		e.stopPropagation();
		onSelectSubNode(node.id, subNode.sub.id);
		dragging = {
			subNodeId: subNode.sub.id,
			startX: e.clientX,
			startY: e.clientY,
			origX: subNode.sub.x ?? 0,
			origY: subNode.sub.y ?? 0
		};

		function handleMouseMove(ev: MouseEvent) {
			if (!dragging) return;
			const dx = Math.round((ev.clientX - dragging.startX) / SCALE);
			const dy = Math.round((ev.clientY - dragging.startY) / SCALE);
			const newX = Math.max(0, Math.min(127, dragging.origX + dx));
			const newY = Math.max(0, Math.min(63, dragging.origY + dy));
			onUpdateSubNode(node.id, dragging.subNodeId, { x: newX, y: newY });
		}

		function handleMouseUp() {
			dragging = null;
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		}

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}
</script>

<div class="relative" bind:this={containerEl}>
	{#if preview}
		<img
			src={preview}
			alt="OLED preview"
			class="w-full"
			style="image-rendering: pixelated;"
		/>
		<!-- Draggable overlays for absolute sub-nodes -->
		{#each absoluteSubNodes as subNode}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="absolute cursor-move border transition-colors {selectedSubNodeId === subNode.sub.id ? 'border-emerald-400' : 'border-transparent hover:border-emerald-600/50'}"
				style="
					left: {(subNode.x / WIDTH) * 100}%;
					top: {(subNode.y / HEIGHT) * 100}%;
					width: {(subNode.w / WIDTH) * 100}%;
					height: {(subNode.h / HEIGHT) * 100}%;
				"
				onmousedown={(e) => handleMouseDown(e, subNode)}
				title="{subNode.sub.displayText || subNode.sub.type} ({subNode.sub.x ?? 0}, {subNode.sub.y ?? 0})"
			>
				{#if selectedSubNodeId === subNode.sub.id}
					<div class="absolute -top-3.5 left-0 whitespace-nowrap rounded bg-emerald-900/80 px-1 text-[8px] text-emerald-300">
						{subNode.sub.x ?? 0},{subNode.sub.y ?? 0}
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>
