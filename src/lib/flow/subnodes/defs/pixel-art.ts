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

		try {
			const raw = atob(scene.pixels);
			const bytes = new Uint8Array(raw.length);
			for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

			const cropW = (config.width as number) || 128;
			const cropH = (config.height as number) || 64;

			// Pack pixels into row-major MSB-first bytes (GPC const image format)
			const packed: number[] = [];
			let currentByte = 0;
			let bit = 0;
			for (let py = 0; py < cropH && py < 64; py++) {
				for (let px = 0; px < cropW && px < 128; px++) {
					currentByte <<= 1;
					const byteIdx = py * 16 + Math.floor(px / 8);
					const bitIdx = 7 - (px % 8);
					if (byteIdx < bytes.length && bytes[byteIdx] & (1 << bitIdx)) {
						currentByte |= 1;
					}
					bit++;
					if (bit === 8) {
						packed.push(currentByte);
						currentByte = 0;
						bit = 0;
					}
				}
			}
			if (bit > 0) {
				packed.push(currentByte << (8 - bit));
			}

			// Format hex data in rows of 16 bytes
			const hexRows: string[] = [];
			for (let i = 0; i < packed.length; i += 16) {
				const row = packed
					.slice(i, Math.min(i + 16, packed.length))
					.map((b) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`)
					.join(', ');
				hexRows.push(`    ${row}`);
			}

			const imageIdx = ctx.images.length;
			const imageName = `${ctx.varPrefix}_img${imageIdx}`;
			const decl = `const image ${imageName} = {${cropW}, ${cropH},\n${hexRows.join(',\n')}\n};`;
			ctx.images.push(decl);

			return `    // Pixel Art scene\n    image_oled(${ctx.x}, ${ctx.y}, TRUE, TRUE, ${imageName}[0]);`;
		} catch {
			return '    // Error decoding pixel data';
		}
	},
};
