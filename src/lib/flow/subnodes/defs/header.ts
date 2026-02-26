import type { SubNodeDef } from '$lib/types/flow';
import { widgetDrawLine } from '$lib/oled-widgets/types';
import { drawBitmapText, measureText } from '$lib/oled-widgets/font';

export const headerDef: SubNodeDef = {
	id: 'header',
	name: 'Header',
	category: 'text',
	description: 'Draws text at top, optional separator line',
	interactive: false,
	defaultConfig: {
		align: 'left',
		font: 'default',
		separator: true,
		paddingTop: 0,
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
				{ value: 'bold', label: 'Bold (6x8)' },
			],
		},
		{ key: 'separator', label: 'Separator Line', type: 'boolean', default: true },
		{ key: 'paddingTop', label: 'Padding Top', type: 'number', default: 0, min: 0, max: 16 },
	],
	stackHeight: 10,
	render(config, ctx) {
		const align = (config.align as string) || 'left';
		const separator = config.separator !== false;
		const label = (config as Record<string, unknown>).label as string || 'Header';

		const textW = measureText(label);
		let startX = ctx.x;
		if (align === 'center') startX = ctx.x + Math.floor((ctx.width - textW) / 2);
		else if (align === 'right') startX = ctx.x + ctx.width - textW;
		drawBitmapText(ctx.pixels, label, startX, ctx.y);

		if (separator) {
			widgetDrawLine(ctx.pixels, ctx.x, ctx.y + 8, ctx.x + ctx.width - 1, ctx.y + 8);
		}
	},
	generateGpc(config, ctx) {
		const align = (config.align as string) || 'left';
		const separator = config.separator !== false;
		const font =
			(config.font as string) === 'small'
				? 'OLED_FONT_SMALL'
				: (config.font as string) === 'bold'
					? 'OLED_FONT_MED_NUMBERS'
					: 'OLED_FONT_SMALL';
		const label = (config as Record<string, unknown>).label as string || 'Header';

		const lines: string[] = [];
		lines.push(`    // Header: ${label}`);

		if (align === 'center') {
			lines.push(
				`    print_string(${ctx.x + Math.floor(64 - (label.length * 3))}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`
			);
		} else if (align === 'right') {
			lines.push(
				`    print_string(${ctx.x + 128 - label.length * 6}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`
			);
		} else {
			lines.push(
				`    print_string(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`
			);
		}

		if (separator) {
			lines.push(`    line_oled(${ctx.x}, ${ctx.y + 8}, ${ctx.x + 127}, ${ctx.y + 8}, OLED_WHITE);`);
		}

		return lines.join('\n');
	},
};
