/**
 * Custom font system using line segments for each glyph.
 * Each character is defined as a set of line segments that can be rendered
 * using line_oled() calls in GPC code, resulting in scalable vector text.
 */

export interface LineSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface CustomGlyph {
	char: string;
	segments: LineSegment[];
	width: number;
}

export interface CustomFont {
	id: string;
	name: string;
	height: number; // Grid height for glyph editor
	gridWidth: number; // Max grid width for glyph editor
	spacing: number;
	glyphs: Map<string, CustomGlyph>;
}

export function createEmptyFont(name: string): CustomFont {
	return {
		id: crypto.randomUUID(),
		name,
		height: 8,
		gridWidth: 8,
		spacing: 1,
		glyphs: new Map(),
	};
}

export function createGlyph(char: string, gridWidth: number): CustomGlyph {
	return { char, segments: [], width: gridWidth };
}

/**
 * Render a custom font glyph to a pixel buffer using Bresenham line drawing.
 */
export function renderGlyphToPixels(
	glyph: CustomGlyph,
	pixels: Uint8Array,
	originX: number,
	originY: number,
	value: boolean = true
): void {
	for (const seg of glyph.segments) {
		drawBresenhamLine(
			pixels,
			originX + seg.x1,
			originY + seg.y1,
			originX + seg.x2,
			originY + seg.y2,
			value
		);
	}
}

function drawBresenhamLine(
	pixels: Uint8Array,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	value: boolean
): void {
	const dx = Math.abs(x1 - x0);
	const dy = Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx - dy;
	let cx = x0;
	let cy = y0;

	while (true) {
		if (cx >= 0 && cx < 128 && cy >= 0 && cy < 64) {
			const byteIdx = cy * 16 + Math.floor(cx / 8);
			const bitIdx = 7 - (cx % 8);
			if (value) {
				pixels[byteIdx] |= 1 << bitIdx;
			} else {
				pixels[byteIdx] &= ~(1 << bitIdx);
			}
		}
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

/**
 * Render custom font text string to pixel buffer.
 */
export function renderCustomText(
	font: CustomFont,
	text: string,
	pixels: Uint8Array,
	originX: number,
	originY: number
): void {
	let curX = originX;
	for (const ch of text) {
		const glyph = font.glyphs.get(ch);
		if (glyph) {
			renderGlyphToPixels(glyph, pixels, curX, originY);
			curX += glyph.width + font.spacing;
		} else if (ch === ' ') {
			curX += font.gridWidth + font.spacing;
		}
	}
}

/**
 * Generate GPC code for rendering custom font text using line_oled().
 */
export function generateCustomTextGpc(
	font: CustomFont,
	text: string,
	originX: number,
	originY: number
): string {
	const lines: string[] = [];
	lines.push(`    // Custom font "${font.name}": "${text}"`);

	let curX = originX;
	for (const ch of text) {
		const glyph = font.glyphs.get(ch);
		if (glyph) {
			for (const seg of glyph.segments) {
				lines.push(
					`    line_oled(${curX + seg.x1}, ${originY + seg.y1}, ${curX + seg.x2}, ${originY + seg.y2}, OLED_WHITE);`
				);
			}
			curX += glyph.width + font.spacing;
		} else if (ch === ' ') {
			curX += font.gridWidth + font.spacing;
		}
	}

	return lines.join('\n');
}

export interface SerializedCustomFont {
	id: string;
	name: string;
	height: number;
	gridWidth: number;
	spacing: number;
	glyphs: { char: string; segments: LineSegment[]; width: number }[];
}

export function serializeFont(font: CustomFont): SerializedCustomFont {
	return {
		id: font.id,
		name: font.name,
		height: font.height,
		gridWidth: font.gridWidth,
		spacing: font.spacing,
		glyphs: [...font.glyphs.values()].map((g) => ({
			char: g.char,
			segments: g.segments,
			width: g.width,
		})),
	};
}

export function deserializeFont(data: SerializedCustomFont): CustomFont {
	const glyphs = new Map<string, CustomGlyph>();
	for (const g of data.glyphs) {
		glyphs.set(g.char, { char: g.char, segments: g.segments, width: g.width });
	}
	return {
		id: data.id,
		name: data.name,
		height: data.height,
		gridWidth: data.gridWidth,
		spacing: data.spacing,
		glyphs,
	};
}
