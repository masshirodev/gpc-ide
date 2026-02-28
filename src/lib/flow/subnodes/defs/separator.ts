import type { SubNodeDef } from '$lib/types/flow';
import { widgetSetPixel, widgetDrawLine } from '$lib/oled-widgets/types';

export const separatorDef: SubNodeDef = {
	id: 'separator',
	name: 'Separator',
	category: 'text',
	description: 'Horizontal line / spacing element',
	interactive: false,
	defaultConfig: {
		style: 'line',
		thickness: 1,
		margin: 2,
	},
	params: [
		{
			key: 'style',
			label: 'Style',
			type: 'select',
			default: 'line',
			options: [
				{ value: 'line', label: 'Solid Line' },
				{ value: 'dashed', label: 'Dashed Line' },
				{ value: 'space', label: 'Empty Space' },
			],
		},
		{ key: 'thickness', label: 'Thickness', type: 'number', default: 1, min: 1, max: 3 },
		{ key: 'margin', label: 'Margin', type: 'number', default: 2, min: 0, max: 8 },
	],
	stackHeight: 5,
	render(config, ctx) {
		const style = (config.style as string) || 'line';
		const thickness = (config.thickness as number) || 1;
		const margin = (config.margin as number) ?? 2;
		const lineY = ctx.y + margin;

		if (style === 'space') return;

		for (let t = 0; t < thickness; t++) {
			if (style === 'dashed') {
				for (let px = ctx.x; px < ctx.x + ctx.width; px += 4) {
					widgetSetPixel(ctx.pixels, px, lineY + t);
					widgetSetPixel(ctx.pixels, px + 1, lineY + t);
				}
			} else {
				widgetDrawLine(ctx.pixels, ctx.x, lineY + t, ctx.x + ctx.width - 1, lineY + t);
			}
		}
	},
	generateGpc(config, ctx) {
		const style = (config.style as string) || 'line';
		const thickness = (config.thickness as number) || 1;
		const margin = (config.margin as number) ?? 2;
		const lineY = ctx.y + margin;

		if (style === 'space') return `    // Separator (space)`;

		const lines: string[] = [];
		lines.push(`    // Separator`);
		for (let t = 0; t < thickness; t++) {
			lines.push(`    line_oled(${ctx.x}, ${lineY + t}, 127, ${lineY + t}, 1, OLED_WHITE);`);
		}
		return lines.join('\n');
	},
};
