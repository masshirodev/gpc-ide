import type { SubNodeDef } from '$lib/types/flow';
import { widgetDrawRect } from '$lib/oled-widgets/types';
import { drawBitmapText } from '$lib/oled-widgets/font';

export const menuItemDef: SubNodeDef = {
	id: 'menu-item',
	name: 'Menu Item',
	category: 'interactive',
	description: 'Selectable item, auto-tracks cursor, highlights when selected',
	interactive: true,
	defaultConfig: {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		font: 'default',
	},
	params: [
		{
			key: 'cursorStyle',
			label: 'Cursor Style',
			type: 'select',
			default: 'prefix',
			options: [
				{ value: 'prefix', label: 'Prefix Character' },
				{ value: 'invert', label: 'Invert Row' },
				{ value: 'bracket', label: 'Brackets' },
			],
		},
		{
			key: 'prefixChar',
			label: 'Prefix Character',
			type: 'string',
			default: '>',
			description: 'Character shown before selected item (prefix style only)',
		},
		{
			key: 'prefixSpacing',
			label: 'Prefix Spacing',
			type: 'number',
			default: 1,
			min: 0,
			max: 4,
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
		const style = (config.cursorStyle as string) || 'prefix';
		const label = (config as Record<string, unknown>).label as string || 'Item';
		const on = style !== 'invert' || !ctx.isSelected;

		if (ctx.isSelected && style === 'invert') {
			widgetDrawRect(ctx.pixels, ctx.x, ctx.y, ctx.x + ctx.width - 1, ctx.y + 7, true);
		}

		if (ctx.isSelected && style === 'prefix') {
			const prefix = (config.prefixChar as string) || '>';
			drawBitmapText(ctx.pixels, prefix, ctx.x, ctx.y);
		}

		if (ctx.isSelected && style === 'bracket') {
			drawBitmapText(ctx.pixels, `[${label}]`, ctx.x, ctx.y, on);
		} else {
			const textX = ctx.isSelected && style === 'prefix' ? ctx.x + 8 : ctx.x + 2;
			drawBitmapText(ctx.pixels, label, textX, ctx.y, on);
		}
	},
	generateGpc(config, ctx) {
		const style = (config.cursorStyle as string) || 'prefix';
		const prefix = (config.prefixChar as string) || '>';
		const spacing = (config.prefixSpacing as number) ?? 1;
		const font = (config.font as string) === 'small' ? 'OLED_FONT_SMALL' : 'OLED_FONT_SMALL';
		const label = (config as Record<string, unknown>).label as string || 'Item';
		const lines: string[] = [];

		if (ctx.cursorIndex < 0) {
			// Non-interactive fallback (shouldn't happen for menu-item)
			lines.push(`    print_string(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`);
			return lines.join('\n');
		}

		lines.push(`    // Menu Item: ${label} (index ${ctx.cursorIndex})`);

		if (style === 'invert') {
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        rect_oled(${ctx.x}, ${ctx.y}, ${ctx.x + 127}, ${ctx.y + 7}, OLED_WHITE);`);
			lines.push(`        print_string(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_BLACK, "${label}");`);
			lines.push(`    } else {`);
			lines.push(`        print_string(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`);
			lines.push(`    }`);
		} else if (style === 'bracket') {
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        print_string(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, "[${label}]");`);
			lines.push(`    } else {`);
			lines.push(`        print_string(${ctx.x + 6}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`);
			lines.push(`    }`);
		} else {
			// prefix
			const offset = (prefix.length + spacing) * 6;
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        print_string(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, "${prefix}");`);
			lines.push(`    }`);
			lines.push(`    print_string(${ctx.x + offset}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`);
		}

		return lines.join('\n');
	},
};
