import type { ModuleDefinition } from '$lib/types/module';
import type { FlowNode, ModuleNodeData, ModuleNodeOption } from '$lib/types/flow';
import { createFlowNode } from '$lib/types/flow';

/**
 * Convert a TOML module definition into a FlowNode with type 'module'.
 *
 * Parses the TOML `combo` field into separate sections:
 *   - combo blocks → comboCode
 *   - function definitions → functionsCode
 *   - define/const declarations → functionsCode (prepended)
 *   - everything else → functionsCode
 *
 * The `trigger` field goes to `mainCode` by default.
 */
export function createModuleNode(
	moduleDef: ModuleDefinition,
	position: { x: number; y: number }
): FlowNode {
	const safeName = moduleDef.id
		.replace(/[^a-zA-Z0-9_]/g, '_')
		.replace(/^[0-9]/, '_$&');
	const enableVar = `${capitalize(safeName)}_Enabled`;

	const options: ModuleNodeOption[] = moduleDef.options.map((opt) => ({
		name: opt.name,
		variable: opt.var,
		type: opt.type === 'toggle' ? 'toggle' : 'value',
		defaultValue: typeof opt.default === 'number' ? opt.default : 0,
		min: opt.min,
		max: opt.max,
	}));

	// Parse the combo field into separate code sections
	const parsed = parseComboField(moduleDef.combo ?? '');

	const moduleData: ModuleNodeData = {
		moduleId: moduleDef.id,
		moduleName: moduleDef.display_name,
		triggerCondition: '',
		enableVariable: enableVar,
		initCode: '',
		mainCode: moduleDef.trigger ?? '',
		functionsCode: parsed.functionsCode,
		comboCode: parsed.comboCode,
		options,
		extraVars: { ...moduleDef.extra_vars },
		conflicts: moduleDef.conflicts ?? [],
		needsWeapondata: moduleDef.needs_weapondata ?? false,
	};

	const node = createFlowNode('module', moduleDef.display_name, position);
	node.moduleData = moduleData;

	// Create enable variable on the node
	node.variables = [
		{
			name: enableVar,
			type: 'int',
			defaultValue: 0,
			persist: false,
		},
		// Add option variables
		...options.map((opt) => ({
			name: opt.variable,
			type: 'int' as const,
			defaultValue: opt.defaultValue,
			persist: false,
			min: opt.min,
			max: opt.max,
		})),
	];

	return node;
}

/**
 * Parse a TOML module's `combo` field into separate code sections.
 *
 * The combo field in TOML modules is a catch-all that can contain:
 *   - `combo Name { ... }` blocks
 *   - `function Name(...) { ... }` definitions
 *   - `define NAME = value;` declarations
 *   - `const type Name[] = { ... };` declarations
 *   - Other top-level code
 *
 * This function splits them into comboCode (combo blocks) and
 * functionsCode (everything else: functions, defines, consts).
 */
export function parseComboField(raw: string): { comboCode: string; functionsCode: string } {
	if (!raw.trim()) return { comboCode: '', functionsCode: '' };

	const lines = raw.split('\n');
	const comboLines: string[] = [];
	const functionLines: string[] = [];

	let i = 0;
	while (i < lines.length) {
		const trimmed = lines[i].trimStart();

		// combo block: "combo Name {"
		if (/^combo\s+[a-zA-Z_]\w*\s*\{/.test(trimmed)) {
			const blockStart = i;
			const blockEnd = findBlockEndFromLines(lines, i);
			comboLines.push(...lines.slice(blockStart, blockEnd + 1));
			comboLines.push('');
			i = blockEnd + 1;
			continue;
		}

		// function block: "function Name(...) {"
		if (/^function\s+[a-zA-Z_]\w*\s*\(/.test(trimmed)) {
			const blockStart = i;
			const blockEnd = findBlockEndFromLines(lines, i);
			functionLines.push(...lines.slice(blockStart, blockEnd + 1));
			functionLines.push('');
			i = blockEnd + 1;
			continue;
		}

		// define/const: single-line or multi-line array
		if (/^(define\s+|const\s+)/.test(trimmed)) {
			// Could be multi-line (e.g. const int8 arr[] = { ... };)
			if (trimmed.includes('{') && !trimmed.includes('}')) {
				// Multi-line const array
				const blockStart = i;
				while (i < lines.length && !lines[i].includes('};')) {
					i++;
				}
				functionLines.push(...lines.slice(blockStart, i + 1));
				functionLines.push('');
				i++;
			} else {
				functionLines.push(lines[i]);
				i++;
			}
			continue;
		}

		// Empty lines or comments — skip
		if (!trimmed || trimmed.startsWith('//')) {
			i++;
			continue;
		}

		// Everything else → functionsCode
		functionLines.push(lines[i]);
		i++;
	}

	return {
		comboCode: comboLines.join('\n').trim(),
		functionsCode: functionLines.join('\n').trim(),
	};
}

/**
 * Find the closing brace index for a block starting at the given line.
 */
function findBlockEndFromLines(lines: string[], startIdx: number): number {
	let depth = 0;
	for (let i = startIdx; i < lines.length; i++) {
		for (const ch of lines[i]) {
			if (ch === '{') depth++;
			if (ch === '}') depth--;
			if (depth === 0 && i > startIdx) return i;
		}
		// Handle opening brace on same line
		if (depth === 0 && i === startIdx) {
			// Single line block like "combo X { ... }"
			if (lines[i].includes('{') && lines[i].includes('}')) return i;
		}
	}
	return lines.length - 1;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
