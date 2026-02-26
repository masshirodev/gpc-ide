import type { SubNodeDef } from '$lib/types/flow';
import { widgetSetPixel, widgetDrawRect } from '$lib/oled-widgets/types';

export const indicatorDef: SubNodeDef = {
	id: 'indicator',
	name: 'Indicator',
	category: 'display',
	description: 'Status indicator (cell-signal, led-strip)',
	interactive: false,
	defaultConfig: {
		style: 'cell-signal',
		segments: 5,
	},
	params: [
		{
			key: 'style',
			label: 'Style',
			type: 'select',
			default: 'cell-signal',
			options: [
				{ value: 'cell-signal', label: 'Cell Signal' },
				{ value: 'led-strip', label: 'LED Strip' },
			],
		},
		{ key: 'segments', label: 'Segments', type: 'number', default: 5, min: 3, max: 20 },
	],
	width: 20,
	height: 12,
	stackHeight: 14,
	render(config, ctx) {
		const style = (config.style as string) || 'cell-signal';
		const segs = (config.segments as number) || 5;
		const val = typeof ctx.boundValue === 'number' ? ctx.boundValue : 50;
		const filled = Math.round((val / 100) * segs);

		if (style === 'cell-signal') {
			const barW = 3;
			const gap = 1;
			const maxH = 12;
			for (let b = 0; b < segs; b++) {
				const bh = Math.round(((b + 1) / segs) * maxH);
				const bx = ctx.x + b * (barW + gap);
				const by = ctx.y + maxH - bh;
				if (b < filled) {
					widgetDrawRect(ctx.pixels, bx, by, bx + barW - 1, ctx.y + maxH - 1, true);
				} else {
					widgetDrawRect(ctx.pixels, bx, by, bx + barW - 1, ctx.y + maxH - 1, false);
				}
			}
		} else {
			// led-strip
			const r = 2;
			const spacing = r * 2 + 2;
			for (let i = 0; i < segs; i++) {
				const cx = ctx.x + r + i * spacing;
				const cy = ctx.y + r;
				if (i < filled) {
					for (let dy = -r; dy <= r; dy++) {
						for (let dx = -r; dx <= r; dx++) {
							if (dx * dx + dy * dy <= r * r) {
								widgetSetPixel(ctx.pixels, cx + dx, cy + dy);
							}
						}
					}
				} else {
					for (let a = 0; a < 360; a += 15) {
						const dx = Math.round(r * Math.cos((a * Math.PI) / 180));
						const dy = Math.round(r * Math.sin((a * Math.PI) / 180));
						widgetSetPixel(ctx.pixels, cx + dx, cy + dy);
					}
				}
			}
		}
	},
	generateGpc(config, ctx) {
		const style = (config.style as string) || 'cell-signal';
		const segs = (config.segments as number) || 5;
		const boundVar = ctx.boundVariable || '_indicator_var';
		const lines: string[] = [];

		lines.push(`    // Indicator (${style}) for ${boundVar}`);

		if (style === 'cell-signal') {
			const barW = 3;
			const gap = 1;
			const maxH = 12;
			lines.push(`    _oled_filled = ${boundVar} * ${segs} / 100;`);
			for (let b = 0; b < segs; b++) {
				const bh = Math.round(((b + 1) / segs) * maxH);
				const bx = ctx.x + b * (barW + gap);
				const by = ctx.y + maxH - bh;
				lines.push(`    if(_oled_filled > ${b}) rect_oled(${bx}, ${by}, ${bx + barW - 1}, ${ctx.y + maxH - 1}, OLED_WHITE);`);
				lines.push(`    else { line_oled(${bx}, ${by}, ${bx + barW - 1}, ${by}, OLED_WHITE); line_oled(${bx}, ${by}, ${bx}, ${ctx.y + maxH - 1}, OLED_WHITE); line_oled(${bx + barW - 1}, ${by}, ${bx + barW - 1}, ${ctx.y + maxH - 1}, OLED_WHITE); line_oled(${bx}, ${ctx.y + maxH - 1}, ${bx + barW - 1}, ${ctx.y + maxH - 1}, OLED_WHITE); }`);
			}
		} else {
			// led-strip
			const r = 2;
			const spacing = r * 2 + 2;
			lines.push(`    _oled_filled = ${boundVar} * ${segs} / 100;`);
			lines.push(`    for(_oled_i = 0; _oled_i < ${segs}; _oled_i++) {`);
			lines.push(`        _oled_cx = ${ctx.x + r} + _oled_i * ${spacing};`);
			lines.push(`        if(_oled_i < _oled_filled) {`);
			lines.push(`            rect_oled(_oled_cx - ${r}, ${ctx.y}, _oled_cx + ${r}, ${ctx.y + r * 2}, OLED_WHITE);`);
			lines.push(`        } else {`);
			lines.push(`            pixel_oled(_oled_cx, ${ctx.y}, 1);`);
			lines.push(`            pixel_oled(_oled_cx, ${ctx.y + r * 2}, 1);`);
			lines.push(`            pixel_oled(_oled_cx - ${r}, ${ctx.y + r}, 1);`);
			lines.push(`            pixel_oled(_oled_cx + ${r}, ${ctx.y + r}, 1);`);
			lines.push(`        }`);
			lines.push(`    }`);
		}

		return lines.join('\n');
	},
};
