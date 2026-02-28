<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getPixel,
		setPixel,
		cloneSprite,
		applyBrush,
		drawLine,
		floodFill
	} from '$lib/utils/sprite-pixels';

	type SpriteTool = 'pen' | 'eraser' | 'fill';

	interface Props {
		pixels: Uint8Array;
		width: number;
		height: number;
		tool: SpriteTool;
		brushSize: number;
		version: number;
		onBeforeDraw: () => void;
		onDraw: (pixels: Uint8Array) => void;
	}

	let { pixels, width, height, tool, brushSize, version, onBeforeDraw, onDraw }: Props = $props();

	let canvas: HTMLCanvasElement;
	let container: HTMLDivElement;
	let ctx: CanvasRenderingContext2D | null = null;

	let cellSize = $state(0);
	let offsetX = $state(0);
	let offsetY = $state(0);

	let isDrawing = $state(false);
	let drawValue = $state(true);
	let lastPixelX = $state(-1);
	let lastPixelY = $state(-1);
	let hoverX = $state(-1);
	let hoverY = $state(-1);

	function resize() {
		if (!container || !canvas) return;
		const rect = container.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;

		const pad = 20;
		cellSize = Math.max(
			4,
			Math.floor(Math.min((rect.width - pad) / width, (rect.height - pad) / height))
		);
		offsetX = Math.floor((rect.width - cellSize * width) / 2);
		offsetY = Math.floor((rect.height - cellSize * height) / 2);

		draw();
	}

	function draw() {
		if (!ctx || !canvas) return;
		const w = canvas.width;
		const h = canvas.height;

		ctx.fillStyle = '#09090b';
		ctx.fillRect(0, 0, w, h);

		if (cellSize <= 0) return;

		// Draw pixels
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (getPixel(pixels, x, y, width, height)) {
					ctx.fillStyle = '#e4e4e7';
					ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
				}
			}
		}

		// Grid lines
		if (cellSize >= 4) {
			ctx.strokeStyle = '#27272a';
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			for (let x = 0; x <= width; x++) {
				ctx.moveTo(offsetX + x * cellSize + 0.5, offsetY);
				ctx.lineTo(offsetX + x * cellSize + 0.5, offsetY + height * cellSize);
			}
			for (let y = 0; y <= height; y++) {
				ctx.moveTo(offsetX, offsetY + y * cellSize + 0.5);
				ctx.lineTo(offsetX + width * cellSize, offsetY + y * cellSize + 0.5);
			}
			ctx.stroke();
		}

		// Border
		ctx.strokeStyle = '#3f3f46';
		ctx.lineWidth = 1;
		ctx.strokeRect(
			offsetX - 0.5,
			offsetY - 0.5,
			width * cellSize + 1,
			height * cellSize + 1
		);

		// Brush preview on hover
		if (hoverX >= 0 && hoverY >= 0 && !isDrawing) {
			drawBrushPreview(hoverX, hoverY);
		}

		// Coordinates
		if (hoverX >= 0 && hoverY >= 0) {
			ctx.fillStyle = '#a1a1aa';
			ctx.font = '11px monospace';
			ctx.textAlign = 'left';
			ctx.fillText(`${hoverX}, ${hoverY}`, offsetX, offsetY - 6);
		}
	}

	function drawBrushPreview(px: number, py: number) {
		if (!ctx) return;
		const hw = Math.floor(brushSize / 2);

		ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
		for (let dy = -hw; dy <= hw; dy++) {
			for (let dx = -hw; dx <= hw; dx++) {
				const x = px + dx;
				const y = py + dy;
				if (x < 0 || x >= width || y < 0 || y >= height) continue;
				ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
			}
		}
	}

	function canvasToPixel(e: MouseEvent): [number, number] {
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left - offsetX;
		const my = e.clientY - rect.top - offsetY;
		return [Math.floor(mx / cellSize), Math.floor(my / cellSize)];
	}

	function isInBounds(x: number, y: number): boolean {
		return x >= 0 && x < width && y >= 0 && y < height;
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0 && e.button !== 2) return;
		const [px, py] = canvasToPixel(e);
		if (!isInBounds(px, py)) return;

		drawValue = e.button === 0;
		isDrawing = true;
		lastPixelX = px;
		lastPixelY = py;

		onBeforeDraw();

		if (tool === 'pen' || tool === 'eraser') {
			const value = tool === 'eraser' ? false : drawValue;
			const updated = cloneSprite(pixels);
			applyBrush(updated, px, py, brushSize, brushSize, 'square', value, width, height);
			onDraw(updated);
		} else if (tool === 'fill') {
			const updated = cloneSprite(pixels);
			floodFill(updated, px, py, drawValue, width, height);
			onDraw(updated);
			isDrawing = false;
		}
	}

	function handleMouseMove(e: MouseEvent) {
		const [px, py] = canvasToPixel(e);
		hoverX = isInBounds(px, py) ? px : -1;
		hoverY = isInBounds(px, py) ? py : -1;

		if (!isDrawing) {
			draw();
			return;
		}

		if (tool === 'pen' || tool === 'eraser') {
			if (px === lastPixelX && py === lastPixelY) return;
			const value = tool === 'eraser' ? false : drawValue;
			const updated = cloneSprite(pixels);
			drawLine(updated, lastPixelX, lastPixelY, px, py, value, brushSize, brushSize, 'square', width, height);
			lastPixelX = px;
			lastPixelY = py;
			onDraw(updated);
		}
	}

	function handleMouseUp() {
		isDrawing = false;
		draw();
	}

	function handleMouseLeave() {
		hoverX = -1;
		hoverY = -1;
		if (isDrawing && (tool === 'pen' || tool === 'eraser')) {
			isDrawing = false;
		}
		draw();
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
	}

	onMount(() => {
		ctx = canvas.getContext('2d');
		resize();
		const observer = new ResizeObserver(() => resize());
		observer.observe(container);
		return () => observer.disconnect();
	});

	$effect(() => {
		void version;
		void pixels;
		draw();
	});
</script>

<div
	bind:this={container}
	class="flex h-full w-full items-center justify-center overflow-hidden"
>
	<canvas
		bind:this={canvas}
		class="block"
		style:cursor={tool === 'fill' ? 'crosshair' : 'default'}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseLeave}
		oncontextmenu={handleContextMenu}
	></canvas>
</div>
