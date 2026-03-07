import { describe, it, expect } from 'vitest';
import {
	bytesPerRow,
	totalBytes,
	createEmptySprite,
	getPixel,
	setPixel,
	cloneSprite,
	invertSprite,
	spriteToBase64,
	base64ToSprite,
	floodFill
} from './sprite-pixels';

describe('sprite-pixels', () => {
	describe('bytesPerRow', () => {
		it('returns 1 for widths 1-8', () => {
			expect(bytesPerRow(1)).toBe(1);
			expect(bytesPerRow(8)).toBe(1);
		});

		it('returns 2 for widths 9-16', () => {
			expect(bytesPerRow(9)).toBe(2);
			expect(bytesPerRow(16)).toBe(2);
		});

		it('returns correct value for wider sprites', () => {
			expect(bytesPerRow(32)).toBe(4);
			expect(bytesPerRow(128)).toBe(16);
		});
	});

	describe('totalBytes', () => {
		it('computes bytes for a 16x16 sprite', () => {
			expect(totalBytes(16, 16)).toBe(32);
		});

		it('computes bytes for an 8x8 sprite', () => {
			expect(totalBytes(8, 8)).toBe(8);
		});
	});

	describe('createEmptySprite', () => {
		it('creates a zero-filled buffer of correct size', () => {
			const sprite = createEmptySprite(16, 16);
			expect(sprite.length).toBe(32);
			expect(sprite.every((b) => b === 0)).toBe(true);
		});
	});

	describe('getPixel / setPixel', () => {
		it('defaults to false for empty sprite', () => {
			const sprite = createEmptySprite(8, 8);
			expect(getPixel(sprite, 0, 0, 8, 8)).toBe(false);
			expect(getPixel(sprite, 7, 7, 8, 8)).toBe(false);
		});

		it('sets and gets a pixel', () => {
			const sprite = createEmptySprite(8, 8);
			setPixel(sprite, 3, 4, 8, 8, true);
			expect(getPixel(sprite, 3, 4, 8, 8)).toBe(true);
			expect(getPixel(sprite, 2, 4, 8, 8)).toBe(false);
		});

		it('clears a pixel', () => {
			const sprite = createEmptySprite(8, 8);
			setPixel(sprite, 0, 0, 8, 8, true);
			expect(getPixel(sprite, 0, 0, 8, 8)).toBe(true);
			setPixel(sprite, 0, 0, 8, 8, false);
			expect(getPixel(sprite, 0, 0, 8, 8)).toBe(false);
		});

		it('returns false for out-of-bounds coordinates', () => {
			const sprite = createEmptySprite(8, 8);
			expect(getPixel(sprite, -1, 0, 8, 8)).toBe(false);
			expect(getPixel(sprite, 0, -1, 8, 8)).toBe(false);
			expect(getPixel(sprite, 8, 0, 8, 8)).toBe(false);
			expect(getPixel(sprite, 0, 8, 8, 8)).toBe(false);
		});

		it('ignores out-of-bounds setPixel', () => {
			const sprite = createEmptySprite(8, 8);
			setPixel(sprite, -1, 0, 8, 8, true);
			setPixel(sprite, 8, 0, 8, 8, true);
			expect(sprite.every((b) => b === 0)).toBe(true);
		});
	});

	describe('cloneSprite', () => {
		it('creates an independent copy', () => {
			const sprite = createEmptySprite(8, 8);
			setPixel(sprite, 0, 0, 8, 8, true);
			const clone = cloneSprite(sprite);
			expect(getPixel(clone, 0, 0, 8, 8)).toBe(true);

			setPixel(sprite, 1, 0, 8, 8, true);
			expect(getPixel(clone, 1, 0, 8, 8)).toBe(false);
		});
	});

	describe('invertSprite', () => {
		it('inverts all bits', () => {
			const sprite = createEmptySprite(8, 1);
			setPixel(sprite, 0, 0, 8, 1, true);
			const inverted = invertSprite(sprite);
			expect(getPixel(inverted, 0, 0, 8, 1)).toBe(false);
			expect(getPixel(inverted, 1, 0, 8, 1)).toBe(true);
			expect(getPixel(inverted, 7, 0, 8, 1)).toBe(true);
		});
	});

	describe('base64 roundtrip', () => {
		it('encodes and decodes correctly', () => {
			const sprite = createEmptySprite(16, 16);
			setPixel(sprite, 5, 10, 16, 16, true);
			setPixel(sprite, 15, 0, 16, 16, true);

			const encoded = spriteToBase64(sprite);
			const decoded = base64ToSprite(encoded);

			expect(decoded.length).toBe(sprite.length);
			expect(getPixel(decoded, 5, 10, 16, 16)).toBe(true);
			expect(getPixel(decoded, 15, 0, 16, 16)).toBe(true);
			expect(getPixel(decoded, 0, 0, 16, 16)).toBe(false);
		});
	});

	describe('floodFill', () => {
		it('fills a connected region', () => {
			const sprite = createEmptySprite(8, 8);
			floodFill(sprite, 0, 0, true, 8, 8);
			// All pixels should be set
			for (let y = 0; y < 8; y++) {
				for (let x = 0; x < 8; x++) {
					expect(getPixel(sprite, x, y, 8, 8)).toBe(true);
				}
			}
		});

		it('stops at boundaries', () => {
			const sprite = createEmptySprite(8, 8);
			// Draw a vertical wall at x=4
			for (let y = 0; y < 8; y++) {
				setPixel(sprite, 4, y, 8, 8, true);
			}
			// Fill left side
			floodFill(sprite, 0, 0, true, 8, 8);
			// Left side should be filled
			expect(getPixel(sprite, 0, 0, 8, 8)).toBe(true);
			expect(getPixel(sprite, 3, 3, 8, 8)).toBe(true);
			// Right side should still be empty
			expect(getPixel(sprite, 5, 0, 8, 8)).toBe(false);
			expect(getPixel(sprite, 7, 7, 8, 8)).toBe(false);
		});

		it('does nothing if target matches fill value', () => {
			const sprite = createEmptySprite(8, 8);
			setPixel(sprite, 0, 0, 8, 8, true);
			floodFill(sprite, 0, 0, true, 8, 8);
			// Should not fill anything else
			expect(getPixel(sprite, 1, 0, 8, 8)).toBe(false);
		});

		it('handles out-of-bounds start', () => {
			const sprite = createEmptySprite(8, 8);
			floodFill(sprite, -1, 0, true, 8, 8);
			expect(sprite.every((b) => b === 0)).toBe(true);
		});
	});
});
