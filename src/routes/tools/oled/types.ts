export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
export const OLED_BYTES = (OLED_WIDTH * OLED_HEIGHT) / 8; // 1024

export interface OledScene {
	id: string;
	name: string;
	pixels: Uint8Array; // 1024 bytes = 128x64 bits, row-major, MSB first
}

export type DrawTool = 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill';

export interface BrushShape {
	type: 'square' | 'circle';
	width: number; // 1-128
	height: number; // 1-64
}

export interface ToolState {
	tool: DrawTool;
	brush: BrushShape;
}

export interface AnimationConfig {
	frameDelayMs: number;
	loop: boolean;
}

export type ExportFormat = 'pixel_calls' | 'array_8bit' | 'array_16bit';

export interface OledProject {
	version: 1;
	scenes: SerializedScene[];
	activeSceneId: string;
	animation: AnimationConfig;
}

export interface SerializedScene {
	id: string;
	name: string;
	pixels: string; // Base64-encoded Uint8Array
}
