import type { SubNodeDef } from '$lib/types/flow';
import { widgetDrawRect } from '$lib/oled-widgets/types';
import { drawBitmapText, measureText } from '$lib/oled-widgets/font';

export const toggleItemDef: SubNodeDef = {
	id: 'toggle-item',
	name: 'Toggle Item',
	category: 'interactive',
	description: 'Menu item showing ON/OFF state, bound to a variable',
	interactive: true,
	defaultConfig: {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		onText: 'ON',
		offText: 'OFF',
		valueAlign: 'right',
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
		{ key: 'prefixChar', label: 'Prefix Character', type: 'string', default: '>' },
		{ key: 'prefixSpacing', label: 'Prefix Spacing', type: 'number', default: 1, min: 0, max: 4 },
		{ key: 'onText', label: 'ON Text', type: 'string', default: 'ON' },
		{ key: 'offText', label: 'OFF Text', type: 'string', default: 'OFF' },
		{
			key: 'valueAlign',
			label: 'Value Alignment',
			type: 'select',
			default: 'right',
			options: [
				{ value: 'right', label: 'Right' },
				{ value: 'inline', label: 'Inline' },
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
		const style = (config.cursorStyle as string) || 'prefix';
		const label = (config as Record<string, unknown>).label as string || 'Toggle';
		const onText = (config.onText as string) || 'ON';
		const offText = (config.offText as string) || 'OFF';
		const isOn = ctx.boundValue && ctx.boundValue !== 0;
		const valText = isOn ? onText : offText;
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

		// Value text on the right
		const valX = ctx.x + ctx.width - measureText(valText) - 2;
		drawBitmapText(ctx.pixels, valText, valX, ctx.y, on);
	},
	generateGpc(config, ctx) {
		const style = (config.cursorStyle as string) || 'prefix';
		const prefix = (config.prefixChar as string) || '>';
		const spacing = (config.prefixSpacing as number) ?? 1;
		const onText = (config.onText as string) || 'ON';
		const offText = (config.offText as string) || 'OFF';
		const valueAlign = (config.valueAlign as string) || 'right';
		const font = 'OLED_FONT_SMALL';
		const label = (config as Record<string, unknown>).label as string || 'Toggle';
		const boundVar = ctx.boundVariable || '_toggle_var';
		const lines: string[] = [];

		lines.push(`    // Toggle: ${label} (index ${ctx.cursorIndex})`);

		const prefixOffset = (prefix.length + spacing) * 6;
		const labelX = style === 'prefix' ? ctx.x + prefixOffset : ctx.x + 2;
		const valX = valueAlign === 'right' ? 128 - Math.max(onText.length, offText.length) * 6 : labelX + (label.length + 1) * 6;

		if (style === 'invert') {
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        rect_oled(${ctx.x}, ${ctx.y}, 127, ${ctx.y + 7}, OLED_WHITE);`);
			lines.push(`        print_string(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_BLACK, "${label}");`);
			lines.push(`        if(${boundVar}) print_string(${valX}, ${ctx.y}, ${font}, OLED_BLACK, "${onText}");`);
			lines.push(`        else print_string(${valX}, ${ctx.y}, ${font}, OLED_BLACK, "${offText}");`);
			lines.push(`    } else {`);
			lines.push(`        print_string(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`);
			lines.push(`        if(${boundVar}) print_string(${valX}, ${ctx.y}, ${font}, OLED_WHITE, "${onText}");`);
			lines.push(`        else print_string(${valX}, ${ctx.y}, ${font}, OLED_WHITE, "${offText}");`);
			lines.push(`    }`);
		} else {
			// prefix style
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) print_string(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, "${prefix}");`);
			lines.push(`    print_string(${labelX}, ${ctx.y}, ${font}, OLED_WHITE, "${label}");`);
			lines.push(`    if(${boundVar}) print_string(${valX}, ${ctx.y}, ${font}, OLED_WHITE, "${onText}");`);
			lines.push(`    else print_string(${valX}, ${ctx.y}, ${font}, OLED_WHITE, "${offText}");`);
		}

		return lines.join('\n');
	},
};
