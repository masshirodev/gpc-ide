import type { OledScene } from '../../routes/tools/oled/types';

export interface AnimationPreset {
	id: string;
	name: string;
	description: string;
	params: AnimationPresetParam[];
	generate: (params: Record<string, unknown>) => OledScene[];
}

export interface AnimationPresetParam {
	key: string;
	label: string;
	type: 'number' | 'boolean';
	default: unknown;
	min?: number;
	max?: number;
}
