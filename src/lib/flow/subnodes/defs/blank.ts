import type { SubNodeDef } from '$lib/types/flow';

export const blankDef: SubNodeDef = {
	id: 'blank',
	name: 'Blank',
	category: 'text',
	description: 'Empty row for spacing in OLED menus',
	interactive: false,
	defaultConfig: {
		height: 8,
	},
	params: [
		{ key: 'height', label: 'Height (px)', type: 'number', default: 8, min: 1, max: 32 },
	],
	stackHeight: 8,
	render() {
		// Intentionally empty — blank row renders nothing
	},
	generateGpc(config, ctx) {
		const height = (config.height as number) || 8;
		// Blank rows just advance the Y cursor via stack height
		return `    // Blank row (${height}px) at y=${ctx.y}`;
	},
};
