/**
 * Pixel manipulation utilities for arbitrary-sized sprites.
 * Same bit layout as OLED (row-major, MSB-first, 8 pixels per byte)
 * but parameterized by width/height instead of fixed 128x64.
 */

export function bytesPerRow(width: number): number {
	return Math.ceil(width / 8);
}

export function totalBytes(width: number, height: number): number {
	return bytesPerRow(width) * height;
}

export function createEmptySprite(width: number, height: number): Uint8Array {
	return new Uint8Array(totalBytes(width, height));
}

export function getPixel(pixels: Uint8Array, x: number, y: number, width: number, height: number): boolean {
	if (x < 0 || x >= width || y < 0 || y >= height) return false;
	const bpr = bytesPerRow(width);
	const byteIdx = y * bpr + Math.floor(x / 8);
	const bitIdx = 7 - (x % 8);
	return (pixels[byteIdx] & (1 << bitIdx)) !== 0;
}

export function setPixel(
	pixels: Uint8Array,
	x: number,
	y: number,
	width: number,
	height: number,
	value: boolean
): void {
	if (x < 0 || x >= width || y < 0 || y >= height) return;
	const bpr = bytesPerRow(width);
	const byteIdx = y * bpr + Math.floor(x / 8);
	const bitIdx = 7 - (x % 8);
	if (value) {
		pixels[byteIdx] |= 1 << bitIdx;
	} else {
		pixels[byteIdx] &= ~(1 << bitIdx);
	}
}

export function cloneSprite(pixels: Uint8Array): Uint8Array {
	return new Uint8Array(pixels);
}

export function invertSprite(pixels: Uint8Array): Uint8Array {
	const result = new Uint8Array(pixels.length);
	for (let i = 0; i < pixels.length; i++) {
		result[i] = ~pixels[i] & 0xff;
	}
	return result;
}

export function spriteToBase64(pixels: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < pixels.length; i++) {
		binary += String.fromCharCode(pixels[i]);
	}
	return btoa(binary);
}

export function base64ToSprite(base64: string): Uint8Array {
	const binary = atob(base64);
	const pixels = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		pixels[i] = binary.charCodeAt(i);
	}
	return pixels;
}

export function applyBrush(
	pixels: Uint8Array,
	cx: number,
	cy: number,
	brushWidth: number,
	brushHeight: number,
	brushType: 'square' | 'circle',
	value: boolean,
	spriteWidth: number,
	spriteHeight: number
): void {
	const hw = Math.floor(brushWidth / 2);
	const hh = Math.floor(brushHeight / 2);

	for (let dy = -hh; dy <= hh; dy++) {
		for (let dx = -hw; dx <= hw; dx++) {
			const x = cx + dx;
			const y = cy + dy;
			if (x < 0 || x >= spriteWidth || y < 0 || y >= spriteHeight) continue;

			if (brushType === 'circle') {
				const nx = hw > 0 ? dx / hw : 0;
				const ny = hh > 0 ? dy / hh : 0;
				if (nx * nx + ny * ny > 1) continue;
			}

			setPixel(pixels, x, y, spriteWidth, spriteHeight, value);
		}
	}
}

export function drawLine(
	pixels: Uint8Array,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	value: boolean,
	brushWidth: number,
	brushHeight: number,
	brushType: 'square' | 'circle',
	spriteWidth: number,
	spriteHeight: number
): void {
	let dx = Math.abs(x1 - x0);
	let dy = -Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	let cx = x0;
	let cy = y0;

	while (true) {
		applyBrush(pixels, cx, cy, brushWidth, brushHeight, brushType, value, spriteWidth, spriteHeight);
		if (cx === x1 && cy === y1) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			cx += sx;
		}
		if (e2 <= dx) {
			err += dx;
			cy += sy;
		}
	}
}

export function floodFill(
	pixels: Uint8Array,
	startX: number,
	startY: number,
	value: boolean,
	width: number,
	height: number
): void {
	if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

	const targetValue = getPixel(pixels, startX, startY, width, height);
	if (targetValue === value) return;

	const queue: [number, number][] = [[startX, startY]];
	const visited = new Set<number>();
	visited.add(startY * width + startX);

	while (queue.length > 0) {
		const [x, y] = queue.shift()!;
		setPixel(pixels, x, y, width, height, value);

		const neighbors: [number, number][] = [
			[x - 1, y],
			[x + 1, y],
			[x, y - 1],
			[x, y + 1]
		];

		for (const [nx, ny] of neighbors) {
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
			const key = ny * width + nx;
			if (visited.has(key)) continue;
			if (getPixel(pixels, nx, ny, width, height) !== targetValue) continue;
			visited.add(key);
			queue.push([nx, ny]);
		}
	}
}
