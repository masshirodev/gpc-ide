import type { SubNodeDef } from '$lib/types/flow';
import { widgetSetPixel } from '$lib/oled-widgets/types';

export const pixelArtDef: SubNodeDef = {
	id: 'pixel-art',
	name: 'Pixel Art',
	category: 'display',
	description: 'Raw pixel scene (opens OLED pixel editor)',
	interactive: false,
	defaultConfig: {
		scene: null,
		width: 128,
		height: 64,
	},
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 128, min: 1, max: 128 },
		{ key: 'height', label: 'Height', type: 'number', default: 64, min: 1, max: 64 },
	],
	stackHeight: 64,
	render(config, ctx) {
		const scene = config.scene as { pixels?: string } | null;
		if (!scene?.pixels) return;

		try {
			const raw = atob(scene.pixels);
			const bytes = new Uint8Array(raw.length);
			for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

			const cropW = (config.width as number) || 128;
			const cropH = (config.height as number) || 64;

			for (let py = 0; py < cropH && py < 64; py++) {
				for (let px = 0; px < cropW && px < 128; px++) {
					const byteIdx = py * 16 + Math.floor(px / 8);
					const bitIdx = 7 - (px % 8);
					if (byteIdx < bytes.length && bytes[byteIdx] & (1 << bitIdx)) {
						widgetSetPixel(ctx.pixels, ctx.x + px, ctx.y + py);
					}
				}
			}
		} catch {
			// Invalid base64 — skip
		}
	},
	generateGpc(config, ctx) {
		const scene = config.scene as { pixels?: string } | null;
		if (!scene?.pixels) return '    // Pixel Art: no scene data';

		const lines: string[] = [];
		lines.push(`    // Pixel Art scene`);

		try {
			const raw = atob(scene.pixels);
			const bytes = new Uint8Array(raw.length);
			for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

			const cropW = (config.width as number) || 128;
			const cropH = (config.height as number) || 64;

			for (let py = 0; py < cropH && py < 64; py++) {
				for (let px = 0; px < cropW && px < 128; px++) {
					const byteIdx = py * 16 + Math.floor(px / 8);
					const bitIdx = 7 - (px % 8);
					if (byteIdx < bytes.length && bytes[byteIdx] & (1 << bitIdx)) {
						lines.push(`    pixel_oled(${ctx.x + px}, ${ctx.y + py}, 1);`);
					}
				}
			}
		} catch {
			lines.push('    // Error decoding pixel data');
		}

		return lines.join('\n');
	},
};
