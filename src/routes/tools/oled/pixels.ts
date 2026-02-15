import { OLED_WIDTH, OLED_HEIGHT, OLED_BYTES } from './types';

export function createEmptyPixels(): Uint8Array {
	return new Uint8Array(OLED_BYTES);
}

export function getPixel(pixels: Uint8Array, x: number, y: number): boolean {
	if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return false;
	const bitIndex = y * OLED_WIDTH + x;
	const byteIndex = bitIndex >> 3;
	const bitOffset = 7 - (bitIndex & 7); // MSB first
	return (pixels[byteIndex] & (1 << bitOffset)) !== 0;
}

export function setPixel(
	pixels: Uint8Array,
	x: number,
	y: number,
	value: boolean
): void {
	if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT) return;
	const bitIndex = y * OLED_WIDTH + x;
	const byteIndex = bitIndex >> 3;
	const bitOffset = 7 - (bitIndex & 7);
	if (value) {
		pixels[byteIndex] |= 1 << bitOffset;
	} else {
		pixels[byteIndex] &= ~(1 << bitOffset);
	}
}

export function clonePixels(pixels: Uint8Array): Uint8Array {
	return new Uint8Array(pixels);
}

export function invertPixels(pixels: Uint8Array): Uint8Array {
	const result = new Uint8Array(pixels.length);
	for (let i = 0; i < pixels.length; i++) {
		result[i] = ~pixels[i] & 0xff;
	}
	return result;
}

export function clearPixels(): Uint8Array {
	return new Uint8Array(OLED_BYTES);
}

export function pixelsToBase64(pixels: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < pixels.length; i++) {
		binary += String.fromCharCode(pixels[i]);
	}
	return btoa(binary);
}

export function base64ToPixels(base64: string): Uint8Array {
	const binary = atob(base64);
	const pixels = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		pixels[i] = binary.charCodeAt(i);
	}
	return pixels;
}
