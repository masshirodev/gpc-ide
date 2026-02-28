import type { ComboProject, ComboStep, ModuleExportConfig } from './types';
import {
	CONSOLE_AXES,
	CONSOLE_BUTTONS,
	translateButton,
	type ConsoleType
} from '$lib/utils/console-buttons';

function translateStepButtons(
	step: ComboStep,
	from: ConsoleType,
	to: ConsoleType
): ComboStep {
	if (from === to) return step;
	return {
		...step,
		buttons: step.buttons.map((b) => ({
			...b,
			button: translateButton(b.button, from, to)
		}))
	};
}

function generateStepCode(step: ComboStep, consoleType: ConsoleType, indent: string): string {
	const lines: string[] = [];
	const axes = CONSOLE_AXES[consoleType];

	// Button set_val calls
	for (const b of step.buttons) {
		lines.push(`${indent}set_val(${b.button}, ${b.value});`);
	}

	// Stick set_val calls
	for (const s of step.sticks) {
		const ax = s.axis === 'left' ? axes.lx : axes.rx;
		const ay = s.axis === 'left' ? axes.ly : axes.ry;
		if (s.x !== 0) lines.push(`${indent}set_val(${ax}, ${s.x});`);
		if (s.y !== 0) lines.push(`${indent}set_val(${ay}, ${s.y});`);
	}

	// Wait
	if (step.waitMs > 0) {
		lines.push(`${indent}wait(${step.waitMs});`);
	}

	return lines.join('\n');
}

export function exportComboGPC(
	project: ComboProject,
	targetConsole?: ConsoleType
): string {
	const target = targetConsole ?? project.consoleType;
	const name = sanitizeName(project.name);
	const indent = '    ';

	const stepBlocks = project.steps.map((step, i) => {
		const translated = translateStepButtons(step, project.consoleType, target);
		const comment = step.label ? `${indent}// ${step.label}\n` : '';
		return comment + generateStepCode(translated, target, indent);
	});

	return `combo ${name} {\n${stepBlocks.join('\n')}\n}`;
}

export function exportModuleTOML(
	project: ComboProject,
	config: ModuleExportConfig
): string {
	const comboName = sanitizeName(project.name);
	const comboCode = exportComboGPC(project);

	// Build trigger
	let trigger: string;
	if (config.triggerMode === 'hold') {
		trigger = `if (${comboName}Status && get_val(${config.triggerButton})) {\\n    combo_run(${comboName});\\n} else {\\n    combo_stop(${comboName});\\n}`;
	} else {
		trigger = `if (${comboName}Status && event_press(${config.triggerButton})) {\\n    combo_run(${comboName});\\n}`;
	}

	// Escape combo code for TOML string
	const escapedCombo = comboCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

	const lines: string[] = [
		`[${config.id}]`,
		`display_name = "${config.displayName}"`,
		`id = "${config.id}"`,
		`type = "${config.gameType}"`,
		`description = "${(config.description || 'Custom combo created with Combo Maker').replace(/"/g, '\\"')}"`,
		`state_display = "${config.id.slice(0, 2).toUpperCase()}"`,
		`status_var = "${comboName}Status"`,
		`trigger = "${trigger}"`,
		`combo = "${escapedCombo}"`,
		'',
		`[[${config.id}.options]]`,
		`name = "Status"`,
		`var = "${comboName}Status"`,
		`type = "toggle"`,
		`default = 0`
	];

	return lines.join('\n');
}

/**
 * Export combo steps as a GPC data() array.
 * Format: each step encodes [button_count, ...buttons(id, value), stick_count, ...sticks(axis, x, y), wait_hi, wait_lo]
 * Terminated with 0xFF sentinel.
 */
export function exportComboData(
	project: ComboProject,
	targetConsole?: ConsoleType
): string {
	const target = targetConsole ?? project.consoleType;
	const name = sanitizeName(project.name);
	const bytes: number[] = [];

	for (const step of project.steps) {
		const translated = translateStepButtons(step, project.consoleType, target);

		// Button count
		bytes.push(translated.buttons.length);
		for (const b of translated.buttons) {
			bytes.push(buttonNameToId(b.button));
			bytes.push(Math.min(Math.max(b.value, 0), 255));
		}

		// Stick count
		bytes.push(translated.sticks.length);
		for (const s of translated.sticks) {
			bytes.push(s.axis === 'left' ? 0 : 1);
			// x, y as signed bytes mapped to 0-255 (offset 128)
			bytes.push(Math.min(Math.max(s.x + 128, 0), 255));
			bytes.push(Math.min(Math.max(s.y + 128, 0), 255));
		}

		// Wait: high byte, low byte (supports up to 65535ms)
		const wait = Math.min(Math.max(step.waitMs, 0), 65535);
		bytes.push((wait >> 8) & 0xff);
		bytes.push(wait & 0xff);
	}

	// Terminator
	bytes.push(0xff);

	const dataLine = bytes.map((b) => b.toString()).join(', ');
	const stepCount = project.steps.length;

	const lines = [
		`// ${name} — ${stepCount} step(s), ${bytes.length} bytes`,
		`// Format: [btn_count, ...(id, val), stick_count, ...(axis, x, y), wait_hi, wait_lo] per step, 0xFF terminator`,
		`const uint8 ${name}Data[] = { ${dataLine} };`
	];

	return lines.join('\n');
}

/** Map button name to its GPC identifier value */
function buttonNameToId(name: string): number {
	for (const buttons of Object.values(CONSOLE_BUTTONS)) {
		const btn = buttons.find((b) => b.name === name);
		if (btn) return btn.value;
	}
	return 0;
}

function sanitizeName(name: string): string {
	// PascalCase, remove non-alphanumeric
	return name
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join('') || 'MyCombo';
}
