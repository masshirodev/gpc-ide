<script lang="ts">
	interface Props {
		label: string;
		x: number;
		y: number;
		onchange: (x: number, y: number) => void;
	}

	let { label, x, y, onchange }: Props = $props();

	let dragging = $state(false);
	let padEl: HTMLDivElement | undefined = $state();

	const PAD_SIZE = 120;
	const RADIUS = PAD_SIZE / 2;

	function posToValue(clientX: number, clientY: number) {
		if (!padEl) return;
		const rect = padEl.getBoundingClientRect();
		const cx = (clientX - rect.left - RADIUS) / RADIUS;
		const cy = (clientY - rect.top - RADIUS) / RADIUS;
		const nx = Math.round(Math.max(-1, Math.min(1, cx)) * 100);
		const ny = Math.round(Math.max(-1, Math.min(1, cy)) * 100);
		onchange(nx, ny);
	}

	function handlePointerDown(e: PointerEvent) {
		dragging = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		posToValue(e.clientX, e.clientY);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		posToValue(e.clientX, e.clientY);
	}

	function handlePointerUp() {
		dragging = false;
	}

	function reset() {
		onchange(0, 0);
	}

	let dotX = $derived(RADIUS + (x / 100) * RADIUS - 6);
	let dotY = $derived(RADIUS + (y / 100) * RADIUS - 6);
</script>

<div class="flex flex-col items-center gap-1">
	<span class="text-xs font-medium text-zinc-400">{label}</span>
	<div
		bind:this={padEl}
		class="relative cursor-crosshair rounded-full border border-zinc-600 bg-zinc-800"
		style="width: {PAD_SIZE}px; height: {PAD_SIZE}px;"
		role="slider"
		tabindex="0"
		aria-label="{label} stick"
		aria-valuetext="X: {x}, Y: {y}"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
	>
		<!-- Crosshair -->
		<div class="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-700"></div>
		<div class="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-zinc-700"></div>
		<!-- Dot -->
		<div
			class="absolute h-3 w-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30"
			style="left: {dotX}px; top: {dotY}px;"
		></div>
	</div>
	<div class="flex items-center gap-2 text-xs text-zinc-500">
		<span>X: {x}</span>
		<span>Y: {y}</span>
		{#if x !== 0 || y !== 0}
			<button
				class="text-zinc-500 hover:text-zinc-300"
				onclick={reset}
			>
				reset
			</button>
		{/if}
	</div>
</div>
