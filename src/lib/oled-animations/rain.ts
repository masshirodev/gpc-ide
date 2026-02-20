import type { AnimationPreset } from './types';
import type { OledScene } from '../../routes/tools/oled/types';
import { setPixel, createEmptyPixels } from '../../routes/tools/oled/pixels';

interface Raindrop {
	x: number;
	y: number;
	speed: number;
	length: number;
}

export const rainPreset: AnimationPreset = {
	id: 'rain',
	name: 'Rain',
	description: 'Falling rain drops with optional lightning flashes',
	params: [
		{ key: 'frames', label: 'Frame Count', type: 'number', default: 8, min: 2, max: 32 },
		{ key: 'drops', label: 'Drop Count', type: 'number', default: 30, min: 5, max: 80 },
		{
			key: 'lightning',
			label: 'Lightning Flash',
			type: 'boolean',
			default: true,
		},
		{
			key: 'lightningFrame',
			label: 'Lightning Frame',
			type: 'number',
			default: 4,
			min: 0,
			max: 31,
		},
	],
	generate(params) {
		const frameCount = (params.frames as number) || 8;
		const dropCount = (params.drops as number) || 30;
		const lightning = params.lightning !== false;
		const lightningFrame = (params.lightningFrame as number) || 4;

		const rng = seedRng(123);
		const drops: Raindrop[] = [];
		for (let i = 0; i < dropCount; i++) {
			drops.push({
				x: Math.floor(rng() * 128),
				y: Math.floor(rng() * 64),
				speed: 2 + Math.floor(rng() * 3),
				length: 2 + Math.floor(rng() * 3),
			});
		}

		const scenes: OledScene[] = [];
		for (let f = 0; f < frameCount; f++) {
			const pixels = createEmptyPixels();

			// Lightning flash — invert screen for one frame
			if (lightning && f === lightningFrame) {
				for (let i = 0; i < pixels.length; i++) {
					pixels[i] = 0xff;
				}
				// Draw lightning bolt
				const boltX = 50 + Math.floor(rng() * 28);
				drawLightning(pixels, boltX, 0, 40, rng);
			}

			for (const drop of drops) {
				const dy = (f * drop.speed) % 64;
				for (let l = 0; l < drop.length; l++) {
					const py = (drop.y + dy + l) % 64;
					if (!(lightning && f === lightningFrame)) {
						setPixel(pixels, drop.x, py, true);
					}
				}
			}

			scenes.push({
				id: crypto.randomUUID(),
				name: `Rain ${f + 1}`,
				pixels,
			});
		}

		return scenes;
	},
};

function drawLightning(
	pixels: Uint8Array,
	startX: number,
	startY: number,
	height: number,
	rng: () => number
): void {
	let cx = startX;
	for (let y = startY; y < startY + height && y < 64; y++) {
		// Erase lightning path (black on white background)
		setPixel(pixels, cx, y, false);
		if (cx > 0) setPixel(pixels, cx - 1, y, false);
		// Random jitter
		cx += Math.floor(rng() * 3) - 1;
		cx = Math.max(0, Math.min(127, cx));
	}
}

function seedRng(seed: number): () => number {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}
