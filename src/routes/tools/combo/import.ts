import type { ComboStep, Combo } from './types';
import { createEmptyStep } from './types';

/**
 * Parse GPC combo code like:
 *   combo MyCombo {
 *       set_val(PS5_CROSS, 100);
 *       wait(50);
 *   }
 * Returns an array of Combos (supports multiple combo blocks in input).
 */
export function parseComboGPC(code: string): Combo[] {
	const combos: Combo[] = [];
	const comboRegex = /combo\s+(\w+)\s*\{([\s\S]*?)\}/g;
	let match;

	while ((match = comboRegex.exec(code)) !== null) {
		const name = match[1];
		const body = match[2];
		const steps = parseComboBody(body);
		if (steps.length > 0) {
			combos.push({
				id: crypto.randomUUID(),
				name,
				steps
			});
		}
	}

	return combos;
}

function parseComboBody(body: string): ComboStep[] {
	const steps: ComboStep[] = [];
	let current = createEmptyStep();
	let hasContent = false;

	for (const rawLine of body.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('//')) continue;

		const setValMatch = line.match(/set_val\s*\(\s*(\w+)\s*,\s*(-?\d+)\s*\)/);
		if (setValMatch) {
			const btn = setValMatch[1];
			const val = parseInt(setValMatch[2]);
			// Check if it's a stick axis
			if (/^[LR][XY]$/.test(btn) || /_(LX|LY|RX|RY)$/.test(btn)) {
				const isLeft = btn === 'LX' || btn === 'LY' || btn.endsWith('_LX') || btn.endsWith('_LY');
				const isX = btn === 'LX' || btn === 'RX' || btn.endsWith('_LX') || btn.endsWith('_RX');
				const axis = isLeft ? 'left' : 'right';
				let stick = current.sticks.find((s) => s.axis === axis);
				if (!stick) {
					stick = { axis, x: 0, y: 0 };
					current.sticks.push(stick);
				}
				if (isX) stick.x = val;
				else stick.y = val;
			} else {
				current.buttons.push({ button: btn, value: val });
			}
			hasContent = true;
			continue;
		}

		const waitMatch = line.match(/wait\s*\(\s*(\d+)\s*\)/);
		if (waitMatch) {
			current.waitMs = parseInt(waitMatch[1]);
			if (hasContent) {
				steps.push(current);
				current = createEmptyStep();
				hasContent = false;
			}
			continue;
		}
	}

	// Push any remaining step that has content but no wait
	if (hasContent) {
		steps.push(current);
	}

	return steps;
}

/**
 * Parse GPC data() block like:
 *   data(
 *     MyCombo,
 *     2,PS5_CROSS,PS5_SQUARE,5,
 *     0,10,
 *     EOC,
 *     EOD );
 */
export function parseComboData(code: string): Combo[] {
	const combos: Combo[] = [];
	// Match the data() block
	const dataMatch = code.match(/data\s*\(([\s\S]*?)\)\s*;/);
	if (!dataMatch) return combos;

	// Remove comments and flatten
	const content = dataMatch[1]
		.split('\n')
		.map((l) => l.replace(/\/\/.*$/, '').trim())
		.join(' ')
		.replace(/\s+/g, ' ');

	// Split by comma, trim
	const tokens = content
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	let i = 0;
	while (i < tokens.length) {
		const token = tokens[i];
		if (token === 'EOD') break;

		// First token in a combo is the name
		if (isNaN(Number(token)) && token !== 'EOC') {
			const name = token;
			i++;
			const steps: ComboStep[] = [];

			while (i < tokens.length) {
				const t = tokens[i];
				if (t === 'EOC') {
					i++;
					break;
				}
				if (t === 'EOD') break;

				// button_count
				const count = parseInt(t);
				if (isNaN(count)) {
					i++;
					continue;
				}
				i++;

				const step = createEmptyStep();
				for (let b = 0; b < count && i < tokens.length; b++) {
					const btn = tokens[i];
					i++;
					if (/^[LR][XY]$/.test(btn) || /_(LX|LY|RX|RY)$/.test(btn)) {
						const isLeft = btn === 'LX' || btn === 'LY' || btn.endsWith('_LX') || btn.endsWith('_LY');
						const axis = isLeft ? 'left' : 'right';
						let stick = step.sticks.find((s) => s.axis === axis);
						if (!stick) {
							stick = { axis, x: 0, y: 0 };
							step.sticks.push(stick);
						}
						// data() doesn't store stick values — assume 100
						const isX = btn === 'LX' || btn === 'RX' || btn.endsWith('_LX') || btn.endsWith('_RX');
						if (isX) stick.x = 100;
						else stick.y = 100;
					} else {
						step.buttons.push({ button: btn, value: 100 });
					}
				}

				// Wait in centiseconds
				if (i < tokens.length) {
					const waitCs = parseInt(tokens[i]);
					if (!isNaN(waitCs)) {
						step.waitMs = waitCs * 10;
					}
					i++;
				}

				steps.push(step);
			}

			if (steps.length > 0) {
				combos.push({ id: crypto.randomUUID(), name, steps });
			}
		} else {
			i++;
		}
	}

	return combos;
}

/**
 * Auto-detect format and parse
 */
export function parseComboAuto(input: string): Combo[] {
	const trimmed = input.trim();
	if (trimmed.startsWith('data(') || trimmed.includes('\ndata(')) {
		return parseComboData(trimmed);
	}
	if (trimmed.includes('combo ') && trimmed.includes('{')) {
		return parseComboGPC(trimmed);
	}
	// Try both
	let result = parseComboGPC(trimmed);
	if (result.length === 0) result = parseComboData(trimmed);
	return result;
}
