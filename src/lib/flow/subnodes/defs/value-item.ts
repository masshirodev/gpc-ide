import type { SubNodeDef } from '$lib/types/flow';
import { addString } from '$lib/types/flow';
import { widgetDrawRect } from '$lib/oled-widgets/types';
import { drawBitmapText, measureText } from '$lib/oled-widgets/font';

export const valueItemDef: SubNodeDef = {
	id: 'value-item',
	name: 'Value Item',
	category: 'interactive',
	description: 'Menu item with adjustable numeric value (e.g. sensitivity 1-10)',
	interactive: true,
	defaultConfig: {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		min: 0,
		max: 100,
		step: 1,
		valueAlign: 'right',
		format: '{value}',
		adjustButtons: ['DPAD_LEFT', 'DPAD_RIGHT'],
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
		{ key: 'min', label: 'Min Value', type: 'number', default: 0, min: -1000, max: 1000 },
		{ key: 'max', label: 'Max Value', type: 'number', default: 100, min: -1000, max: 1000 },
		{ key: 'step', label: 'Step', type: 'number', default: 1, min: 1, max: 100 },
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
		{ key: 'format', label: 'Format', type: 'string', default: '{value}', description: 'Use {value} as placeholder' },
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
		const label = (config as Record<string, unknown>).label as string || 'Value';
		const val = typeof ctx.boundValue === 'number' ? ctx.boundValue : 0;
		const valStr = String(val);
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

		// Value on right
		const valX = ctx.x + ctx.width - measureText(valStr) - 2;
		drawBitmapText(ctx.pixels, valStr, valX, ctx.y, on);
	},
	generateGpc(config, ctx) {
		const style = (config.cursorStyle as string) || 'prefix';
		const prefix = (config.prefixChar as string) || '>';
		const spacing = (config.prefixSpacing as number) ?? 1;
		const min = (config.min as number) ?? 0;
		const max = (config.max as number) ?? 100;
		const step = (config.step as number) || 1;
		const valueAlign = (config.valueAlign as string) || 'right';
		const font = 'OLED_FONT_SMALL';
		const label = (config as Record<string, unknown>).label as string || 'Value';
		const boundVar = ctx.boundVariable || '_value_var';
		const labelIdx = addString(ctx, label);
		const labelRef = `${ctx.stringArrayName}[${labelIdx}]`;
		const lines: string[] = [];

		lines.push(`    // Value: ${label} (index ${ctx.cursorIndex})`);

		const prefixOffset = (prefix.length + spacing) * 6;
		const labelX = style === 'prefix' ? ctx.x + prefixOffset : ctx.x + 2;
		const valX = valueAlign === 'right' ? 104 : labelX + (label.length + 1) * 6;

		// Cursor rendering
		if (style === 'invert') {
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        rect_oled(${ctx.x}, ${ctx.y}, ${128 - ctx.x}, 8, 1, OLED_WHITE);`);
			lines.push(`        print(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_BLACK, ${labelRef});`);
			lines.push(`        PrintNumber(${boundVar}, find_digits(${boundVar}), ${valX}, ${ctx.y}, ${font});`);
			lines.push(`    } else {`);
			lines.push(`        print(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_WHITE, ${labelRef});`);
			lines.push(`        PrintNumber(${boundVar}, find_digits(${boundVar}), ${valX}, ${ctx.y}, ${font});`);
			lines.push(`    }`);
		} else {
			const prefixIdx = addString(ctx, prefix);
			const prefixRef = `${ctx.stringArrayName}[${prefixIdx}]`;
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) print(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, ${prefixRef});`);
			lines.push(`    print(${labelX}, ${ctx.y}, ${font}, OLED_WHITE, ${labelRef});`);
			lines.push(`    PrintNumber(${boundVar}, find_digits(${boundVar}), ${valX}, ${ctx.y}, ${font});`);
		}

		// Value adjustment logic (D-pad left/right when this item is selected)
		lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
		lines.push(`        if(event_press(${ctx.buttons.left}) && ${boundVar} > ${min}) ${boundVar} = ${boundVar} - ${step};`);
		lines.push(`        if(event_press(${ctx.buttons.right}) && ${boundVar} < ${max}) ${boundVar} = ${boundVar} + ${step};`);
		lines.push(`    }`);

		return lines.join('\n');
	},
};
