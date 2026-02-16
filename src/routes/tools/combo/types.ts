import type { ConsoleType } from '$lib/utils/console-buttons';

export interface ButtonAction {
	button: string;
	value: number;
}

export interface StickAction {
	axis: 'left' | 'right';
	x: number;
	y: number;
}

export interface ComboStep {
	id: string;
	buttons: ButtonAction[];
	sticks: StickAction[];
	waitMs: number;
	label?: string;
}

export interface ComboProject {
	version: 1;
	name: string;
	consoleType: ConsoleType;
	steps: ComboStep[];
}

export interface ModuleExportConfig {
	displayName: string;
	id: string;
	description: string;
	gameType: 'fps' | 'tps' | 'fgs' | 'all';
	triggerButton: string;
	triggerMode: 'press' | 'hold';
}

export function createEmptyStep(): ComboStep {
	return {
		id: crypto.randomUUID(),
		buttons: [],
		sticks: [],
		waitMs: 50
	};
}

export function cloneStep(step: ComboStep): ComboStep {
	return {
		id: crypto.randomUUID(),
		buttons: step.buttons.map((b) => ({ ...b })),
		sticks: step.sticks.map((s) => ({ ...s })),
		waitMs: step.waitMs,
		label: step.label
	};
}
