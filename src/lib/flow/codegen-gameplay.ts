import type { FlowGraph, FlowNode, FlowVariable } from '$lib/types/flow';
import {
	collectPersistVars,
	flowVarsToPersistVars,
	generateBitpackPersistence,
	type PersistVar,
} from './codegen';

/**
 * Result of gameplay code generation — kept separate for merging.
 */
export interface GameplayCodegenResult {
	defines: string[];
	variables: string[];
	combos: string[];
	initCode: string[];
	mainLoopCode: string[];
	functions: string[];
	/** Separate file contents that should be written alongside main.gpc */
	extraFiles: Record<string, string>;
}

/**
 * Helper to read mainCode from a module node, falling back to triggerCode for migration.
 */
function getMainCode(md: { mainCode?: string; triggerCode?: string }): string {
	return md.mainCode || md.triggerCode || '';
}

/**
 * Generate GPC code fragments from a gameplay flow graph.
 *
 * Each module node produces code in up to 4 sections:
 *   - initCode → runs once in init {}
 *   - mainCode → runs every frame in main {}, guarded by enable variable
 *   - functionsCode → function definitions, constants, defines
 *   - comboCode → combo blocks
 */
export function generateGameplayGpc(graph: FlowGraph): GameplayCodegenResult {
	const result: GameplayCodegenResult = {
		defines: [],
		variables: [],
		combos: [],
		initCode: [],
		mainLoopCode: [],
		functions: [],
		extraFiles: {},
	};

	const moduleNodes = graph.nodes.filter((n) => n.type === 'module' && n.moduleData);
	if (moduleNodes.length === 0 && graph.nodes.filter((n) => n.type === 'custom').length === 0)
		return result;

	const declaredVars = new Set<string>();

	for (const node of moduleNodes) {
		const md = node.moduleData!;
		const safeName = sanitizeName(md.moduleId);

		// Weapon data defines + array (weapondata module only)
		if (md.moduleId === 'weapondata') {
			const names = md.weaponNames ?? [];
			const count = names.length;
			result.defines.push(`define WEAPON_COUNT = ${count};`);
			result.defines.push(`define WEAPON_MAX_INDEX = ${Math.max(count - 1, 0)};`);
			if (count > 0) {
				const quoted = names.map((w) => `"${w}"`).join(', ');
				result.functions.push(`// Weapon names`);
				result.functions.push(`const string Weapons[] = { ${quoted} };`);
				result.functions.push('');

				// Generate recoiltable.gpc as a separate file if any module needs it
				const needsRecoilTable = moduleNodes.some(
					(n) => n.moduleData?.moduleId === 'antirecoil_timeline'
				);
				if (needsRecoilTable) {
					result.functions.push(`// Weapon recoil table — loaded from recoiltable.gpc`);
					result.functions.push(`#include "recoiltable.gpc"`);
					result.functions.push('');

					// Generate separate recoiltable.gpc file content
					const rtLines: string[] = [];
					rtLines.push(`// Weapon recoil table (10 phases x 2 axes per weapon)`);
					rtLines.push(`// Edit values in the Recoil tab or Spray Pattern tool`);
					const zeros = Array(20).fill(' 0').join(',');
					const rows = names.map(
						(w, i) => `    {${zeros}} ${i < count - 1 ? ',' : ' '} /* ${String(i).padStart(4)} ${w} */`
					);
					rtLines.push(`const int8 WeaponRecoilTable[][] = {`);
					rtLines.push(`//  V0  H0  V1  H1  V2  H2  V3  H3  V4  H4  V5  H5  V6  H6  V7  H7  V8  H8  V9  H9`);
					rtLines.push(...rows);
					rtLines.push(`};`);
					result.extraFiles['recoiltable.gpc'] = rtLines.join('\n');
				}
			}
		}

		// Variables: enable + options + extras
		for (const v of node.variables) {
			if (!declaredVars.has(v.name)) {
				result.variables.push(generateVarDecl(v));
				declaredVars.add(v.name);
			}
		}

		// Extra vars from module definition
		for (const [name, type] of Object.entries(md.extraVars)) {
			if (!declaredVars.has(name)) {
				result.variables.push(formatExtraVar(name, type));
				declaredVars.add(name);
			}
		}

		// Button param defines
		if (md.params) {
			for (const [key, value] of Object.entries(md.params)) {
				const defineName = `${md.moduleId.toUpperCase()}_${key.toUpperCase()}`;
				result.defines.push(`define ${defineName} = ${value};`);
			}
		}

		// Init code
		const initCode = (md.initCode ?? '').trim();
		if (initCode) {
			result.initCode.push(`    // Init: ${md.moduleName}`);
			for (const line of initCode.split('\n')) {
				result.initCode.push(`    ${line}`);
			}
		}

		// Functions code (includes function defs, const arrays, defines)
		const functionsCode = (md.functionsCode ?? '').trim();
		if (functionsCode) {
			result.functions.push(`// Functions: ${md.moduleName}`);
			result.functions.push(functionsCode);
			result.functions.push('');
		}

		// Combo code
		if (md.comboCode.trim()) {
			result.combos.push(`// Combo: ${md.moduleName}`);
			result.combos.push(md.comboCode.trim());
			result.combos.push('');
		}

		// Quick toggle: button combo or keyboard key to toggle enable variable
		const qt = md.quickToggle ?? [];
		if (qt.length > 0 && md.enableVariable) {
			const isKb = qt[0].startsWith('KEY_');
			result.mainLoopCode.push(`    // Quick Toggle: ${md.moduleName}`);
			if (isKb) {
				const delayVar = `_qt_delay_${safeName}`;
				if (!declaredVars.has(delayVar)) {
					result.variables.push(`int ${delayVar};`);
					declaredVars.add(delayVar);
				}
				result.mainLoopCode.push(`    if(GetKeyboardKey(${qt[0]}) && ${delayVar} <= 0) { ${md.enableVariable} = !${md.enableVariable}; ${delayVar} = 30; }`);
				result.mainLoopCode.push(`    if(${delayVar} > 0) { ${delayVar}--; }`);
			} else {
				const toggleExpr =
					qt.length === 1
						? `event_press(${qt[0]})`
						: `get_val(${qt[0]}) && event_press(${qt[1]})`;
				result.mainLoopCode.push(`    if(${toggleExpr}) { ${md.enableVariable} = !${md.enableVariable}; }`);
			}
		}

		// Main loop: trigger code guarded by enable variable
		const enableVar = md.enableVariable;
		const mainCode = getMainCode(md).trim();

		result.mainLoopCode.push(`    // ${md.moduleName}`);
		if (mainCode) {
			// Full code block — already contains if-checks and combo_run
			result.mainLoopCode.push(`    if(${enableVar}) {`);
			for (const line of mainCode.split('\n')) {
				result.mainLoopCode.push(`        ${line.trim()}`);
			}
			result.mainLoopCode.push(`    }`);
		} else {
			// No main code — just guard combo with enable var
			const comboName = extractComboName(md.comboCode);
			if (comboName) {
				result.mainLoopCode.push(`    if(${enableVar}) combo_run(${comboName});`);
			}
		}
	}

	// Also include custom nodes' code
	const customNodes = graph.nodes.filter((n) => n.type === 'custom');
	for (const node of customNodes) {
		for (const v of node.variables) {
			if (!declaredVars.has(v.name)) {
				result.variables.push(generateVarDecl(v));
				declaredVars.add(v.name);
			}
		}
		if (node.gpcCode.trim()) {
			result.mainLoopCode.push(`    // Custom: ${node.label}`);
			for (const line of node.gpcCode.trim().split('\n')) {
				result.mainLoopCode.push(`    ${line}`);
			}
		}
		if (node.comboCode.trim()) {
			result.combos.push(`// Custom combo: ${node.label}`);
			result.combos.push(node.comboCode.trim());
			result.combos.push('');
		}
	}

	return result;
}

/**
 * Generate a standalone GPC script from gameplay flow only.
 * Includes bitpack persistence for module options with persist: true.
 */
export function generateGameplayGpcStandalone(graph: FlowGraph): string {
	const result = generateGameplayGpc(graph);
	const lines: string[] = [];

	// Collect persist vars from gameplay modules
	const persistVars = collectGameplayPersistVars(graph);

	lines.push(`// ====================================================`);
	lines.push(`// Gameplay Flow: ${graph.name}`);
	lines.push(`// Generated by ZenForge Flow Editor`);
	lines.push(`// ====================================================`);
	lines.push('');

	// Imports for common helpers
	lines.push(`import common/helper;`);
	lines.push(`import common/oled;`);
	if (persistVars.length > 0) {
		lines.push(`import common/bitpack;`);
	}
	lines.push('');

	if (result.defines.length > 0) {
		lines.push(`// ===== DEFINES =====`);
		lines.push(...result.defines);
		lines.push('');
	}

	if (result.variables.length > 0) {
		lines.push(`// ===== VARIABLES =====`);
		lines.push(...result.variables);
		lines.push('');
	}

	if (result.functions.length > 0) {
		lines.push(`// ===== FUNCTIONS =====`);
		lines.push(...result.functions);
		lines.push('');
	}

	if (result.combos.length > 0) {
		lines.push(`// ===== COMBOS =====`);
		lines.push(...result.combos);
	}

	// Persistence (bitpack-based, SPVAR_5+)
	if (persistVars.length > 0) {
		lines.push(`// ===== PERSISTENCE =====`);
		lines.push(generateBitpackPersistence(persistVars));
		lines.push('');
	}

	lines.push(`// ===== INIT =====`);
	lines.push(`init {`);
	if (result.initCode.length > 0) {
		lines.push(...result.initCode);
	}
	if (persistVars.length > 0) {
		lines.push(`    Flow_Load();`);
	}
	lines.push(`}`);
	lines.push('');

	lines.push(`// ===== MAIN =====`);
	lines.push(`main {`);
	if (result.mainLoopCode.length > 0) {
		lines.push(...result.mainLoopCode);
	}
	lines.push(`}`);

	return lines.join('\n');
}

/**
 * Collect persist vars from a gameplay flow graph.
 * Includes module options + Weapons_RecoilValues when applicable.
 */
function collectGameplayPersistVars(graph: FlowGraph): PersistVar[] {
	const persistFlowVars = collectPersistVars(graph);
	const result = flowVarsToPersistVars(persistFlowVars, 0);
	const seen = new Set(result.map((v) => v.name));

	// Weapons_RecoilValues array persistence when weapondata + recoil module present
	const hasWeapondata = graph.nodes.some((n) => n.moduleData?.moduleId === 'weapondata');
	const hasRecoilModule = graph.nodes.some(
		(n) =>
			n.moduleData?.needsWeapondata &&
			n.moduleData.moduleId !== 'weapondata' &&
			n.moduleData.moduleId !== 'antirecoil_timeline'
	);

	if (hasWeapondata && hasRecoilModule && !seen.has('Weapons_RecoilValues')) {
		result.push({
			name: 'Weapons_RecoilValues',
			min: -100,
			max: 100,
			defaultValue: 0,
			arrayLoop: {
				countExpr: 'WEAPON_COUNT * 2',
				indexVar: '_bp_loop_i',
			},
		});
	}

	return result;
}

// ==================== Helpers ====================

function sanitizeName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9_]/g, '_')
		.replace(/^[0-9]/, '_$&')
		.replace(/_+/g, '_');
}

function generateVarDecl(v: FlowVariable): string {
	if (v.type === 'string') {
		const size = v.arraySize ?? 32;
		return `int8 ${v.name}[${size}];`;
	}
	const profile = v.perProfile ? ' [profile]' : '';
	return `${v.type} ${v.name}${profile} = ${v.defaultValue};`;
}

/**
 * Extract the combo name from a combo code block.
 * Looks for `combo <name> {` pattern.
 */
/**
 * Format an extra_vars entry into a valid GPC declaration.
 * Handles: "int", "int [profile]", "int [216]"
 * Produces: "int Name;", "int Name [profile];", "int Name[216];"
 */
function formatExtraVar(name: string, type: string): string {
	const arrayMatch = type.match(/^(\w+)\s*\[(.+)\]$/);
	if (arrayMatch) {
		const baseType = arrayMatch[1];
		const size = arrayMatch[2].trim();
		if (size === 'profile') {
			return `${baseType} ${name} [profile];`;
		}
		return `${baseType} ${name}[${size}];`;
	}
	return `${type} ${name};`;
}

function extractComboName(comboCode: string): string | null {
	const match = comboCode.match(/combo\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{/);
	return match ? match[1] : null;
}

