import type { SubNodeDef } from '$lib/types/flow';
import { widgetSetPixel, widgetDrawRect } from '$lib/oled-widgets/types';

export const scrollBarDef: SubNodeDef = {
	id: 'scroll-bar',
	name: 'Scroll Bar',
	category: 'display',
	description: 'Auto-renders based on item count vs visible items',
	interactive: false,
	defaultConfig: {
		orientation: 'vertical',
		thickness: 3,
		style: 'bar',
		trackVisible: true,
		autoSource: true,
	},
	params: [
		{
			key: 'orientation',
			label: 'Orientation',
			type: 'select',
			default: 'vertical',
			options: [
				{ value: 'vertical', label: 'Vertical' },
				{ value: 'horizontal', label: 'Horizontal' },
			],
		},
		{ key: 'thickness', label: 'Thickness', type: 'number', default: 3, min: 1, max: 8 },
		{
			key: 'style',
			label: 'Style',
			type: 'select',
			default: 'bar',
			options: [
				{ value: 'bar', label: 'Bar' },
				{ value: 'dots', label: 'Dots' },
				{ value: 'blocks', label: 'Blocks' },
			],
		},
		{ key: 'trackVisible', label: 'Show Track', type: 'boolean', default: true },
		{ key: 'autoSource', label: 'Auto-detect Items', type: 'boolean', default: true },
		{ key: 'totalItems', label: 'Total Items', type: 'number', default: 10, min: 1, max: 100, description: 'Manual override when auto-detect is off' },
		{ key: 'visibleItems', label: 'Visible Items', type: 'number', default: 3, min: 1, max: 20, description: 'Manual override when auto-detect is off' },
	],
	width: 3,
	height: 48,
	stackHeight: 48,
	render(config, ctx) {
		const thickness = (config.thickness as number) || 3;
		const trackVisible = config.trackVisible !== false;
		const totalH = ctx.height;

		if (trackVisible) {
			widgetDrawRect(ctx.pixels, ctx.x, ctx.y, ctx.x + thickness - 1, ctx.y + totalH - 1, false);
		}

		// Draw thumb at ~30% position for preview
		const thumbH = Math.max(4, Math.floor(totalH * 0.3));
		const thumbY = ctx.y + Math.floor(totalH * 0.2);
		widgetDrawRect(ctx.pixels, ctx.x, thumbY, ctx.x + thickness - 1, thumbY + thumbH - 1, true);
	},
	generateGpc(config, ctx) {
		const thickness = (config.thickness as number) || 3;
		const trackVisible = config.trackVisible !== false;
		const autoSource = config.autoSource !== false;
		const lines: string[] = [];

		lines.push(`    // Scroll Bar`);

		// The scroll bar uses the container's cursor and scroll variables
		// Total items and visible count come from the container node
		const totalVar = autoSource ? `${ctx.varPrefix}_total_items` : String((config.totalItems as number) || 10);
		const visibleVar = autoSource ? `${ctx.varPrefix}_visible` : String((config.visibleItems as number) || 3);
		const scrollVar = `${ctx.varPrefix}_scroll`;
		const height = 48; // default track height

		if (trackVisible) {
			lines.push(`    rect_oled(${ctx.x}, ${ctx.y}, ${ctx.x + thickness - 1}, ${ctx.y + height - 1}, OLED_WHITE);`);
		}

		lines.push(`    _oled_thumb_h = ${height} * ${visibleVar} / ${totalVar};`);
		lines.push(`    if(_oled_thumb_h < 4) _oled_thumb_h = 4;`);
		lines.push(`    _oled_thumb_y = ${ctx.y} + ${scrollVar} * (${height} - _oled_thumb_h) / (${totalVar} - ${visibleVar});`);
		lines.push(`    rect_oled(${ctx.x}, _oled_thumb_y, ${ctx.x + thickness - 1}, _oled_thumb_y + _oled_thumb_h - 1, OLED_WHITE);`);

		return lines.join('\n');
	},
};
