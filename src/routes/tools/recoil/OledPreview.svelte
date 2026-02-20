<script lang="ts">
	interface Props {
		points: { x: number; y: number }[];
		canvasCenter: { x: number; y: number };
	}

	let { points, canvasCenter }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		// Clear — black OLED background
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, 128, 64);

		if (points.length === 0) {
			// Draw placeholder text
			ctx.fillStyle = '#333';
			ctx.font = '8px monospace';
			ctx.textAlign = 'center';
			ctx.fillText('No spray data', 64, 34);
			return;
		}

		// Find bounds of all points relative to center
		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;

		for (const p of points) {
			const rx = p.x - canvasCenter.x;
			const ry = p.y - canvasCenter.y;
			minX = Math.min(minX, rx);
			maxX = Math.max(maxX, rx);
			minY = Math.min(minY, ry);
			maxY = Math.max(maxY, ry);
		}

		const rangeX = Math.max(maxX - minX, 20);
		const rangeY = Math.max(maxY - minY, 20);
		const padding = 4;
		const scaleX = (128 - padding * 2) / rangeX;
		const scaleY = (64 - padding * 2) / rangeY;
		const s = Math.min(scaleX, scaleY);

		// Center crosshair
		const cx = 64;
		const cy = 32;
		ctx.strokeStyle = '#222';
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(cx - 3, cy);
		ctx.lineTo(cx + 3, cy);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(cx, cy - 3);
		ctx.lineTo(cx, cy + 3);
		ctx.stroke();

		// Draw spray points
		for (let i = 0; i < points.length; i++) {
			const rx = points[i].x - canvasCenter.x;
			const ry = points[i].y - canvasCenter.y;
			const px = Math.round(cx + rx * s);
			const py = Math.round(cy + ry * s);

			if (px >= 0 && px < 128 && py >= 0 && py < 64) {
				// Brighter for later points
				const brightness = 128 + Math.round((i / points.length) * 127);
				ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
				ctx.fillRect(px, py, 1, 1);
			}
		}

		// Draw connecting lines (dim)
		if (points.length > 1) {
			ctx.strokeStyle = '#333';
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			for (let i = 0; i < points.length; i++) {
				const rx = points[i].x - canvasCenter.x;
				const ry = points[i].y - canvasCenter.y;
				const px = cx + rx * s;
				const py = cy + ry * s;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.stroke();
		}
	});
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
	<div class="mb-2 text-xs font-medium text-zinc-500">OLED Preview (128x64)</div>
	<canvas
		bind:this={canvasEl}
		width="128"
		height="64"
		class="w-full rounded border border-zinc-700"
		style="image-rendering: pixelated;"
	></canvas>
</div>
