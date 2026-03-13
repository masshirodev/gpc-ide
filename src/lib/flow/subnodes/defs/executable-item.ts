import type { SubNodeDef } from '$lib/types/flow';
import { addString } from '$lib/types/flow';
import { widgetDrawRect } from '$lib/oled-widgets/types';
import { drawBitmapText } from '$lib/oled-widgets/font';

export const executableItemDef: SubNodeDef = {
	id: 'executable-item',
	name: 'Executable',
	category: 'interactive',
	description: 'Button that executes code on confirm press',
	interactive: true,
	defaultConfig: {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		executeCode: '',
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
			visibleWhen: { key: 'cursorStyle', values: ['prefix'] },
		},
		{
			key: 'prefixSpacing',
			label: 'Prefix Spacing',
			type: 'number',
			default: 1,
			min: 0,
			max: 4,
			visibleWhen: { key: 'cursorStyle', values: ['prefix'] },
		},
		{
			key: 'executeCode',
			label: 'Execute Code',
			type: 'code',
			default: '',
			description: 'GPC code to run when the user presses confirm on this item',
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
		const label = (config as Record<string, unknown>).label as string || 'Execute';
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
		const font = 'OLED_FONT_SMALL';
		const label = (config as Record<string, unknown>).label as string || 'Execute';
		const labelIdx = addString(ctx, label);
		const labelRef = `${ctx.stringArrayName}[${labelIdx}]`;
		const lines: string[] = [];

		if (ctx.cursorIndex < 0) {
			lines.push(`    print(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_WHITE, ${labelRef});`);
			return lines.join('\n');
		}

		lines.push(`    // Executable: ${label} (index ${ctx.cursorIndex})`);

		if (style === 'invert') {
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        rect_oled(${ctx.x}, ${ctx.y}, ${128 - ctx.x}, 8, 1, OLED_WHITE);`);
			lines.push(`        print(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_BLACK, ${labelRef});`);
			lines.push(`    } else {`);
			lines.push(`        print(${ctx.x + 2}, ${ctx.y}, ${font}, OLED_WHITE, ${labelRef});`);
			lines.push(`    }`);
		} else if (style === 'bracket') {
			const bracketIdx = addString(ctx, `[${label}]`);
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        print(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, ${ctx.stringArrayName}[${bracketIdx}]);`);
			lines.push(`    } else {`);
			lines.push(`        print(${ctx.x + 6}, ${ctx.y}, ${font}, OLED_WHITE, ${labelRef});`);
			lines.push(`    }`);
		} else {
			const prefixIdx = addString(ctx, prefix);
			const offset = (prefix.length + spacing) * 6;
			lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex}) {`);
			lines.push(`        print(${ctx.x}, ${ctx.y}, ${font}, OLED_WHITE, ${ctx.stringArrayName}[${prefixIdx}]);`);
			lines.push(`    }`);
			lines.push(`    print(${ctx.x + offset}, ${ctx.y}, ${font}, OLED_WHITE, ${labelRef});`);
		}

		return lines.join('\n');
	},
	generateGpcInput(config, ctx) {
		if (ctx.cursorIndex < 0) return '';
		const executeCode = (config.executeCode as string) || '';
		if (!executeCode) return '';

		const label = (config as Record<string, unknown>).label as string || 'Execute';
		const lines: string[] = [];

		lines.push(`    // Execute: ${label}`);
		lines.push(`    if(${ctx.cursorVar} == ${ctx.cursorIndex} && event_press(${ctx.buttons.confirm})) {`);
		lines.push(`        ${executeCode}`);
		lines.push(`    }`);

		return lines.join('\n');
	},
};
