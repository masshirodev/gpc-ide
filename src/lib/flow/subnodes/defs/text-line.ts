import type { SubNodeDef } from '$lib/types/flow';
import { addString } from '$lib/types/flow';
import { drawBitmapText, measureText } from '$lib/oled-widgets/font';

export const textLineDef: SubNodeDef = {
	id: 'text-line',
	name: 'Text Line',
	category: 'text',
	description: 'Static text at a position',
	interactive: false,
	defaultConfig: {
		align: 'left',
		font: 'default',
	},
	params: [
		{
			key: 'align',
			label: 'Alignment',
			type: 'select',
			default: 'left',
			options: [
				{ value: 'left', label: 'Left' },
				{ value: 'center', label: 'Center' },
				{ value: 'right', label: 'Right' },
			],
		},
		{
			key: 'font',
			label: 'Font',
			type: 'select',
			default: 'default',
			options: [
				{ value: 'default', label: 'Default (5x7)' },
				{ value: 'small', label: 'Small (3x5)' },
			],
		},
	],
	stackHeight: 8,
	render(config, ctx) {
		const label = (config as Record<string, unknown>).label as string || 'Text';
		const align = (config.align as string) || 'left';
		const textW = measureText(label);

		let startX = ctx.x;
		if (align === 'center') startX = ctx.x + Math.floor((ctx.width - textW) / 2);
		else if (align === 'right') startX = ctx.x + ctx.width - textW;

		drawBitmapText(ctx.pixels, label, startX, ctx.y);
	},
	generateGpc(config, ctx) {
		const label = (config as Record<string, unknown>).label as string || 'Text';
		const align = (config.align as string) || 'left';
		const font = (config.font as string) === 'small' ? 'OLED_FONT_SMALL' : 'OLED_FONT_SMALL';
		const idx = addString(ctx, label);

		let x = ctx.x;
		if (align === 'center') x = Math.floor(64 - (label.length * 3));
		else if (align === 'right') x = 128 - label.length * 6;

		return `    print(${x}, ${ctx.y}, ${font}, OLED_WHITE, ${ctx.stringArrayName}[${idx}]);`;
	},
};
