export interface WidgetParam {
	key: string;
	label: string;
	type: 'number' | 'boolean' | 'select';
	default: unknown;
	min?: number;
	max?: number;
	options?: { value: unknown; label: string }[];
}

export interface OledWidgetDef {
	id: string;
	name: string;
	category: 'bar' | 'indicator' | 'diagnostic' | 'decorative';
	description: string;
	width: number;
	height: number;
	params: WidgetParam[];
	render: (
		config: Record<string, unknown>,
		value: number,
		pixels: Uint8Array,
		x: number,
		y: number
	) => void;
	generateGpc: (
		config: Record<string, unknown>,
		varName: string,
		x: number,
		y: number
	) => string;
}

export interface WidgetPlacement {
	widgetId: string;
	x: number;
	y: number;
	config: Record<string, unknown>;
	boundVariable?: string;
}

// Pixel helper — same layout as OLED tool (row-major, MSB first, 128 wide)
export function widgetSetPixel(
	pixels: Uint8Array,
	px: number,
	py: number,
	on: boolean = true
) {
	if (px < 0 || px >= 128 || py < 0 || py >= 64) return;
	const byteIdx = py * 16 + Math.floor(px / 8);
	const bitIdx = 7 - (px % 8);
	if (on) {
		pixels[byteIdx] |= 1 << bitIdx;
	} else {
		pixels[byteIdx] &= ~(1 << bitIdx);
	}
}

export function widgetDrawRect(
	pixels: Uint8Array,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	filled: boolean = false
) {
	if (filled) {
		for (let y = y1; y <= y2; y++) {
			for (let x = x1; x <= x2; x++) {
				widgetSetPixel(pixels, x, y);
			}
		}
	} else {
		for (let x = x1; x <= x2; x++) {
			widgetSetPixel(pixels, x, y1);
			widgetSetPixel(pixels, x, y2);
		}
		for (let y = y1; y <= y2; y++) {
			widgetSetPixel(pixels, x1, y);
			widgetSetPixel(pixels, x2, y);
		}
	}
}

export function widgetDrawLine(
	pixels: Uint8Array,
	x0: number,
	y0: number,
	x1: number,
	y1: number
) {
	const dx = Math.abs(x1 - x0);
	const dy = Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx - dy;
	let cx = x0;
	let cy = y0;

	while (true) {
		widgetSetPixel(pixels, cx, cy);
		if (cx === x1 && cy === y1) break;
		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			cx += sx;
		}
		if (e2 < dx) {
			err += dx;
			cy += sy;
		}
	}
}
