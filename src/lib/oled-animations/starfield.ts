import type { AnimationPreset } from './types';
import type { OledScene } from '../../routes/tools/oled/types';
import { setPixel, createEmptyPixels } from '../../routes/tools/oled/pixels';

interface Star {
	x: number;
	y: number;
	speed: number;
}

export const starfieldPreset: AnimationPreset = {
	id: 'starfield',
	name: 'Starfield',
	description: 'Scrolling star field with parallax speed layers',
	params: [
		{ key: 'frames', label: 'Frame Count', type: 'number', default: 8, min: 2, max: 32 },
		{ key: 'stars', label: 'Star Count', type: 'number', default: 40, min: 10, max: 100 },
		{ key: 'layers', label: 'Speed Layers', type: 'number', default: 3, min: 1, max: 5 },
	],
	generate(params) {
		const frameCount = (params.frames as number) || 8;
		const starCount = (params.stars as number) || 40;
		const layers = (params.layers as number) || 3;

		// Seed star positions
		const rng = seedRng(42);
		const stars: Star[] = [];
		for (let i = 0; i < starCount; i++) {
			const layer = Math.floor(rng() * layers);
			stars.push({
				x: Math.floor(rng() * 128),
				y: Math.floor(rng() * 64),
				speed: layer + 1,
			});
		}

		const scenes: OledScene[] = [];
		for (let f = 0; f < frameCount; f++) {
			const pixels = createEmptyPixels();
			for (const star of stars) {
				const x = ((star.x - f * star.speed) % 128 + 128) % 128;
				setPixel(pixels, Math.floor(x), star.y, true);
			}
			scenes.push({
				id: crypto.randomUUID(),
				name: `Starfield ${f + 1}`,
				pixels,
			});
		}

		return scenes;
	},
};

// Simple seeded PRNG for reproducible results
function seedRng(seed: number): () => number {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}
