import type { FlowGraph } from '$lib/types/flow';

export interface TemplateParam {
	key: string;
	label: string;
	type: 'text' | 'number' | 'select' | 'boolean';
	default: unknown;
	description?: string;
	options?: { value: string; label: string }[];
	min?: number;
	max?: number;
}

export type TemplateOutputType = 'flow' | 'code';

export interface ScriptTemplate {
	id: string;
	name: string;
	description: string;
	category: 'state-machine' | 'menu' | 'persistence' | 'utility' | 'display';
	tags: string[];
	creator?: string;
	params: TemplateParam[];
	outputType: TemplateOutputType;
	generate: (params: Record<string, unknown>) => TemplateOutput;
}

export interface TemplateOutput {
	type: TemplateOutputType;
	flowGraph?: FlowGraph;
	code?: string;
	description: string;
}
