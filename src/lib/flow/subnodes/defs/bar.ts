import type { SubNodeDef } from '$lib/types/flow';
import { widgetDrawRect } from '$lib/oled-widgets/types';

export const barDef: SubNodeDef = {
	id: 'bar',
	name: 'Bar Widget',
	category: 'display',
	description: 'Progress/value bar (recessed, gradient, chunky, notched, equalizer)',
	interactive: false,
	defaultConfig: {
		style: 'recessed',
		width: 60,
		height: 8,
		min: 0,
		max: 100,
		showLabel: false,
	},
	params: [
		{
			key: 'style',
			label: 'Style',
			type: 'select',
			default: 'recessed',
			options: [
				{ value: 'recessed', label: 'Recessed' },
				{ value: 'gradient', label: 'Gradient' },
				{ value: 'chunky', label: 'Chunky Retro' },
				{ value: 'notched', label: 'Notched' },
				{ value: 'equalizer', label: 'Equalizer' },
			],
		},
		{ key: 'width', label: 'Width', type: 'number', default: 60, min: 20, max: 120 },
		{ key: 'height', label: 'Height', type: 'number', default: 8, min: 4, max: 32 },
		{ key: 'min', label: 'Min', type: 'number', default: 0 },
		{ key: 'max', label: 'Max', type: 'number', default: 100 },
		{ key: 'showLabel', label: 'Show Value', type: 'boolean', default: false },
		{ key: 'segments', label: 'Segments', type: 'number', default: 10, min: 2, max: 20, description: 'For chunky/notched styles' },
	],
	stackHeight: 10,
	render(config, ctx) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		const val = typeof ctx.boundValue === 'number' ? ctx.boundValue : 50;
		const fillPct = Math.max(0, Math.min(100, val));

		// Simple recessed bar preview
		widgetDrawRect(ctx.pixels, ctx.x, ctx.y, ctx.x + w - 1, ctx.y + h - 1, false);
		const fw = Math.round((fillPct / 100) * (w - 4));
		if (fw > 0) {
			widgetDrawRect(ctx.pixels, ctx.x + 2, ctx.y + 2, ctx.x + 2 + fw - 1, ctx.y + h - 3, true);
		}
	},
	generateGpc(config, ctx) {
		const style = (config.style as string) || 'recessed';
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		const boundVar = ctx.boundVariable || '_bar_var';
		const lines: string[] = [];

		lines.push(`    // Bar (${style}) for ${boundVar}`);

		if (style === 'recessed') {
			// Outline: rect_oled(x, y, w, h, fill, color)
			lines.push(`    rect_oled(${ctx.x}, ${ctx.y}, ${w}, ${h}, 0, OLED_WHITE);`);
			lines.push(`    if(${boundVar} > 0) {`);
			lines.push(`        rect_oled(${ctx.x + 2}, ${ctx.y + 2}, ${boundVar} * ${w - 4} / 100, ${h - 4}, 1, OLED_WHITE);`);
			lines.push(`    }`);
		} else if (style === 'gradient') {
			lines.push(`    rect_oled(${ctx.x}, ${ctx.y}, ${w}, ${h}, 0, OLED_WHITE);`);
			lines.push(`    _oled_fw = ${boundVar} * ${w - 2} / 100;`);
			lines.push(`    for(_oled_py = ${ctx.y + 1}; _oled_py < ${ctx.y + h - 1}; _oled_py++) {`);
			lines.push(`        for(_oled_px = ${ctx.x + 1}; _oled_px < ${ctx.x + 1} + _oled_fw; _oled_px++) {`);
			lines.push(`            if((_oled_px + _oled_py) % 2 == 0 || _oled_px - ${ctx.x} < _oled_fw / 2) pixel_oled(_oled_px, _oled_py, 1);`);
			lines.push(`        }`);
			lines.push(`    }`);
		} else if (style === 'chunky') {
			const segs = (config.segments as number) || 10;
			const segW = Math.floor((w - 2) / segs);
			lines.push(`    rect_oled(${ctx.x}, ${ctx.y}, ${w}, ${h}, 0, OLED_WHITE);`);
			lines.push(`    _oled_segs = ${boundVar} * ${segs} / 100;`);
			lines.push(`    for(_oled_i = 0; _oled_i < _oled_segs; _oled_i++) {`);
			lines.push(`        rect_oled(${ctx.x + 2} + _oled_i * ${segW}, ${ctx.y + 2}, ${segW - 2}, ${h - 4}, 1, OLED_WHITE);`);
			lines.push(`    }`);
		} else if (style === 'notched') {
			const steps = (config.segments as number) || 5;
			const stepW = Math.floor(w / steps);
			lines.push(`    _oled_filled = ${boundVar} * ${steps} / 100;`);
			lines.push(`    for(_oled_i = 0; _oled_i < ${steps}; _oled_i++) {`);
			lines.push(`        _oled_sx = ${ctx.x} + _oled_i * ${stepW};`);
			lines.push(`        if(_oled_i < _oled_filled) {`);
			lines.push(`            rect_oled(_oled_sx, ${ctx.y}, ${stepW - 1}, ${h}, 1, OLED_WHITE);`);
			lines.push(`        } else {`);
			lines.push(`            line_oled(_oled_sx, ${ctx.y}, _oled_sx + ${stepW - 2}, ${ctx.y}, 1, OLED_WHITE);`);
			lines.push(`            line_oled(_oled_sx, ${ctx.y + h - 1}, _oled_sx + ${stepW - 2}, ${ctx.y + h - 1}, 1, OLED_WHITE);`);
			lines.push(`            line_oled(_oled_sx, ${ctx.y}, _oled_sx, ${ctx.y + h - 1}, 1, OLED_WHITE);`);
			lines.push(`            line_oled(_oled_sx + ${stepW - 2}, ${ctx.y}, _oled_sx + ${stepW - 2}, ${ctx.y + h - 1}, 1, OLED_WHITE);`);
			lines.push(`        }`);
			lines.push(`    }`);
		} else if (style === 'equalizer') {
			const bars = (config.segments as number) || 5;
			const barW = 3;
			const gap = 2;
			lines.push(`    for(_oled_i = 0; _oled_i < ${bars}; _oled_i++) {`);
			lines.push(`        _oled_bx = ${ctx.x} + _oled_i * ${barW + gap};`);
			lines.push(`        _oled_bh = ${boundVar} * ${h} / 100;`);
			lines.push(`        if(_oled_bh > 0) rect_oled(_oled_bx, ${ctx.y + h} - _oled_bh, ${barW}, _oled_bh, 1, OLED_WHITE);`);
			lines.push(`    }`);
		}

		return lines.join('\n');
	},
};
