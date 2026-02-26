import type { SubNodeDef } from '$lib/types/flow';

export const customDef: SubNodeDef = {
	id: 'custom',
	name: 'Custom',
	category: 'advanced',
	description: 'Raw GPC code for rendering + optional interaction',
	interactive: false,
	defaultConfig: {
		width: 128,
		height: 8,
		interactive: false,
	},
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 128, min: 1, max: 128 },
		{ key: 'height', label: 'Height', type: 'number', default: 8, min: 1, max: 64 },
		{
			key: 'interactive',
			label: 'Interactive',
			type: 'boolean',
			default: false,
			description: 'Does this sub-node accept input?',
		},
	],
	stackHeight: 8,
	render(_config, _ctx) {
		// Cannot preview custom GPC code — rendering is a no-op
		// Could draw a placeholder pattern or "Custom" text
	},
	generateGpc(_config, ctx) {
		// The custom sub-node uses renderCode/interactCode from the SubNode itself
		// Those are passed in at the codegen orchestration level, not here
		// This function is a fallback that returns empty if called directly
		return `    // Custom sub-node (code injected from sub-node renderCode)`;
	},
};
