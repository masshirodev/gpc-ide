import type { ScriptTemplate } from './types';
import {
	createEmptyFlowGraph,
	createFlowNode,
	createFlowEdge,
} from '$lib/types/flow';

// ==================== State Machine Template ====================

const stateMachine: ScriptTemplate = {
	id: 'state-machine',
	name: 'State Machine',
	description: 'Basic state machine skeleton with configurable number of states and transitions',
	category: 'state-machine',
	tags: ['state', 'flow', 'basic'],
	params: [
		{ key: 'name', label: 'Flow Name', type: 'text', default: 'My State Machine' },
		{
			key: 'stateCount',
			label: 'Number of States',
			type: 'number',
			default: 3,
			min: 2,
			max: 10,
		},
		{
			key: 'includeIntro',
			label: 'Include Intro State',
			type: 'boolean',
			default: true,
		},
		{
			key: 'transitionType',
			label: 'Default Transition',
			type: 'select',
			default: 'button_press',
			options: [
				{ value: 'button_press', label: 'Button Press' },
				{ value: 'timeout', label: 'Timeout' },
			],
		},
	],
	outputType: 'flow',
	generate(params) {
		const name = (params.name as string) || 'My State Machine';
		const stateCount = (params.stateCount as number) || 3;
		const includeIntro = params.includeIntro !== false;
		const transType = (params.transitionType as string) || 'button_press';

		const graph = createEmptyFlowGraph(name);
		const spacing = 300;

		let startIdx = 0;
		if (includeIntro) {
			const introNode = createFlowNode('intro', 'Intro', { x: 100, y: 200 });
			introNode.isInitialState = true;
			introNode.gpcCode = '// Intro screen logic';
			graph.nodes.push(introNode);
			startIdx = 1;
		}

		for (let i = 0; i < stateCount; i++) {
			const types = ['home', 'menu', 'submenu', 'custom'] as const;
			const type = i === 0 ? 'home' : types[Math.min(i, types.length - 1)];
			const node = createFlowNode(type, `State ${i + 1}`, {
				x: 100 + (startIdx + i) * spacing,
				y: 200,
			});
			if (!includeIntro && i === 0) node.isInitialState = true;
			node.gpcCode = `// State ${i + 1} logic`;
			graph.nodes.push(node);
		}

		// Create transitions
		for (let i = 0; i < graph.nodes.length - 1; i++) {
			const edge = createFlowEdge(
				graph.nodes[i].id,
				graph.nodes[i + 1].id,
				transType === 'timeout' ? '3s' : 'Next',
				{
					type: transType as 'button_press' | 'timeout',
					button: transType === 'button_press' ? 'PS5_CROSS' : undefined,
					timeoutMs: transType === 'timeout' ? 3000 : undefined,
				}
			);
			graph.edges.push(edge);
		}

		return {
			type: 'flow',
			flowGraph: graph,
			description: `${stateCount}-state flow${includeIntro ? ' with intro' : ''}`,
		};
	},
};

// ==================== OLED Menu Template ====================

const oledMenu: ScriptTemplate = {
	id: 'oled-menu',
	name: 'OLED Menu Navigation',
	description: 'Multi-level OLED menu with configurable pages and navigation buttons',
	category: 'menu',
	tags: ['oled', 'menu', 'navigation'],
	params: [
		{ key: 'name', label: 'Menu Name', type: 'text', default: 'My Menu' },
		{
			key: 'pages',
			label: 'Number of Pages',
			type: 'number',
			default: 3,
			min: 2,
			max: 8,
		},
		{
			key: 'hasSubmenu',
			label: 'Include Submenu',
			type: 'boolean',
			default: true,
		},
		{
			key: 'navButton',
			label: 'Navigate Button',
			type: 'select',
			default: 'PS5_DOWN',
			options: [
				{ value: 'PS5_DOWN', label: 'Down' },
				{ value: 'PS5_RIGHT', label: 'Right' },
				{ value: 'PS5_L1', label: 'L1' },
				{ value: 'PS5_R1', label: 'R1' },
			],
		},
	],
	outputType: 'flow',
	generate(params) {
		const name = (params.name as string) || 'My Menu';
		const pages = (params.pages as number) || 3;
		const hasSubmenu = params.hasSubmenu !== false;
		const navBtn = (params.navButton as string) || 'PS5_DOWN';

		const graph = createEmptyFlowGraph(name);

		// Home node
		const home = createFlowNode('home', 'Home', { x: 100, y: 200 });
		home.isInitialState = true;
		home.gpcCode = '// Home screen display';
		graph.nodes.push(home);

		// Menu pages
		const menuNodes = [];
		for (let i = 0; i < pages; i++) {
			const node = createFlowNode('menu', `Page ${i + 1}`, {
				x: 400,
				y: 100 + i * 150,
			});
			node.gpcCode = `// Menu page ${i + 1} content`;
			graph.nodes.push(node);
			menuNodes.push(node);
		}

		// Home → first page
		graph.edges.push(
			createFlowEdge(home.id, menuNodes[0].id, 'Open', {
				type: 'button_press',
				button: 'PS5_CROSS',
			})
		);

		// Page cycling
		for (let i = 0; i < menuNodes.length; i++) {
			const next = menuNodes[(i + 1) % menuNodes.length];
			graph.edges.push(
				createFlowEdge(menuNodes[i].id, next.id, 'Next', {
					type: 'button_press',
					button: navBtn,
				})
			);
		}

		// Back to home from last page
		graph.edges.push(
			createFlowEdge(menuNodes[menuNodes.length - 1].id, home.id, 'Back', {
				type: 'button_press',
				button: 'PS5_CIRCLE',
			})
		);

		// Optional submenu
		if (hasSubmenu) {
			const sub = createFlowNode('submenu', 'Settings', {
				x: 700,
				y: 200,
			});
			sub.gpcCode = '// Submenu settings logic';
			graph.nodes.push(sub);

			graph.edges.push(
				createFlowEdge(menuNodes[0].id, sub.id, 'Enter', {
					type: 'button_press',
					button: 'PS5_CROSS',
				})
			);
			graph.edges.push(
				createFlowEdge(sub.id, menuNodes[0].id, 'Back', {
					type: 'button_press',
					button: 'PS5_CIRCLE',
				})
			);
		}

		return {
			type: 'flow',
			flowGraph: graph,
			description: `${pages}-page OLED menu${hasSubmenu ? ' with submenu' : ''}`,
		};
	},
};

// ==================== Persistence Template ====================

const persistence: ScriptTemplate = {
	id: 'persistence',
	name: 'Save/Load via SPVAR',
	description: 'SPVAR persistence boilerplate for saving and loading user settings',
	category: 'persistence',
	tags: ['spvar', 'save', 'load', 'persistence'],
	params: [
		{
			key: 'varCount',
			label: 'Number of Variables',
			type: 'number',
			default: 4,
			min: 1,
			max: 16,
		},
		{
			key: 'autoSave',
			label: 'Auto-save on Change',
			type: 'boolean',
			default: true,
		},
	],
	outputType: 'code',
	generate(params) {
		const varCount = (params.varCount as number) || 4;
		const autoSave = params.autoSave !== false;

		const lines: string[] = [
			'// ========== SPVAR Persistence ==========',
			'',
			'define SPVAR_SLOT_BASE = 0;',
			'',
		];

		for (let i = 0; i < varCount; i++) {
			lines.push(`int setting_${i} = 0;`);
		}

		lines.push('', '// Load all settings from SPVAR');
		lines.push('function LoadSettings() {');
		for (let i = 0; i < varCount; i++) {
			lines.push(`    setting_${i} = get_spvar(SPVAR_SLOT_BASE + ${i});`);
		}
		lines.push('}', '');

		lines.push('// Save all settings to SPVAR');
		lines.push('function SaveSettings() {');
		for (let i = 0; i < varCount; i++) {
			lines.push(`    set_spvar(SPVAR_SLOT_BASE + ${i}, setting_${i});`);
		}
		lines.push('}', '');

		if (autoSave) {
			lines.push('// Auto-save helper — call after modifying any setting');
			lines.push('function UpdateSetting(index, value) {');
			lines.push('    set_spvar(SPVAR_SLOT_BASE + index, value);');
			lines.push('}', '');
		}

		lines.push('// Call LoadSettings() in init { } block');
		lines.push('// init {');
		lines.push('//     LoadSettings();');
		lines.push('// }');

		return {
			type: 'code',
			code: lines.join('\n'),
			description: `SPVAR persistence for ${varCount} variables${autoSave ? ' with auto-save' : ''}`,
		};
	},
};

// ==================== Screensaver Template ====================

const screensaver: ScriptTemplate = {
	id: 'screensaver',
	name: 'Screensaver Flow',
	description: 'Idle timeout → animation → wake flow with configurable timeout',
	category: 'display',
	tags: ['screensaver', 'idle', 'animation', 'oled'],
	params: [
		{ key: 'name', label: 'Flow Name', type: 'text', default: 'Screensaver' },
		{
			key: 'idleTimeoutMs',
			label: 'Idle Timeout (ms)',
			type: 'number',
			default: 30000,
			min: 5000,
			max: 300000,
		},
		{
			key: 'wakeButton',
			label: 'Wake Button',
			type: 'select',
			default: 'any',
			options: [
				{ value: 'any', label: 'Any Button' },
				{ value: 'PS5_CROSS', label: 'Cross' },
				{ value: 'PS5_CROSS', label: 'Confirm' },
			],
		},
	],
	outputType: 'flow',
	generate(params) {
		const name = (params.name as string) || 'Screensaver';
		const idleMs = (params.idleTimeoutMs as number) || 30000;
		const wakeBtn = (params.wakeButton as string) || 'any';

		const graph = createEmptyFlowGraph(name);

		const active = createFlowNode('home', 'Active', { x: 100, y: 200 });
		active.isInitialState = true;
		active.gpcCode = '// Normal active state';
		graph.nodes.push(active);

		const idle = createFlowNode('screensaver', 'Screensaver', { x: 450, y: 200 });
		idle.gpcCode = [
			'// Screensaver animation',
			'cls_oled(OLED_BLACK);',
			'// Add your animation here',
		].join('\n');
		graph.nodes.push(idle);

		// Active → Screensaver (timeout)
		graph.edges.push(
			createFlowEdge(active.id, idle.id, `${idleMs / 1000}s idle`, {
				type: 'timeout',
				timeoutMs: idleMs,
			})
		);

		// Screensaver → Active (wake)
		if (wakeBtn === 'any') {
			graph.edges.push(
				createFlowEdge(idle.id, active.id, 'Any input', {
					type: 'custom',
					customCode: '// Any button press detected',
				})
			);
		} else {
			graph.edges.push(
				createFlowEdge(idle.id, active.id, 'Wake', {
					type: 'button_press',
					button: wakeBtn,
				})
			);
		}

		return {
			type: 'flow',
			flowGraph: graph,
			description: `Screensaver with ${idleMs / 1000}s timeout`,
		};
	},
};

// ==================== Quick Toggle Template ====================

const quickToggle: ScriptTemplate = {
	id: 'quick-toggle',
	name: 'Quick Toggle',
	description: 'Keyboard quick-toggle pattern for enabling/disabling features with button combos',
	category: 'utility',
	tags: ['toggle', 'keyboard', 'quick'],
	params: [
		{
			key: 'featureCount',
			label: 'Number of Features',
			type: 'number',
			default: 3,
			min: 1,
			max: 8,
		},
		{
			key: 'holdButton',
			label: 'Modifier Button',
			type: 'select',
			default: 'PS5_L3',
			options: [
				{ value: 'PS5_L3', label: 'L3' },
				{ value: 'PS5_R3', label: 'R3' },
				{ value: 'PS5_SHARE', label: 'Share' },
				{ value: 'PS5_OPTIONS', label: 'Options' },
			],
		},
	],
	outputType: 'code',
	generate(params) {
		const count = (params.featureCount as number) || 3;
		const holdBtn = (params.holdButton as string) || 'PS5_L3';

		const btns = ['PS5_UP', 'PS5_DOWN', 'PS5_LEFT', 'PS5_RIGHT', 'PS5_CROSS', 'PS5_CIRCLE', 'PS5_TRIANGLE', 'PS5_SQUARE'];
		const lines: string[] = [
			'// ========== Quick Toggle System ==========',
			'',
		];

		for (let i = 0; i < count; i++) {
			lines.push(`int feature_${i}_enabled = FALSE;`);
		}

		lines.push('', `// Hold ${holdBtn} + press button to toggle features`);
		lines.push('function CheckToggles() {');
		lines.push(`    if(get_val(${holdBtn})) {`);

		for (let i = 0; i < count && i < btns.length; i++) {
			lines.push(`        if(event_press(${btns[i]})) {`);
			lines.push(`            feature_${i}_enabled = !feature_${i}_enabled;`);
			lines.push(`            // Optional: rumble feedback`);
			lines.push(`            if(feature_${i}_enabled) combo_run(RumbleOn);`);
			lines.push(`            else combo_run(RumbleOff);`);
			lines.push(`        }`);
		}

		lines.push('    }');
		lines.push('}', '');

		lines.push('combo RumbleOn {');
		lines.push('    set_rumble(RUMBLE_A, 80);');
		lines.push('    wait(150);');
		lines.push('    set_rumble(RUMBLE_A, 0);');
		lines.push('}', '');

		lines.push('combo RumbleOff {');
		lines.push('    set_rumble(RUMBLE_B, 40);');
		lines.push('    wait(80);');
		lines.push('    set_rumble(RUMBLE_B, 0);');
		lines.push('}');

		return {
			type: 'code',
			code: lines.join('\n'),
			description: `Quick toggle for ${count} features via ${holdBtn}`,
		};
	},
};

// ==================== Digital Clock Template ====================

const digitalClock: ScriptTemplate = {
	id: 'digital-clock',
	name: 'Digital Clock Display',
	description: 'OLED digital clock with configurable position and colon blink',
	category: 'display',
	tags: ['oled', 'clock', 'display', 'timer'],
	params: [
		{
			key: 'blinkColon',
			label: 'Blink Colon',
			type: 'boolean',
			default: true,
		},
		{
			key: 'x',
			label: 'X Position',
			type: 'number',
			default: 24,
			min: 0,
			max: 100,
		},
		{
			key: 'y',
			label: 'Y Position',
			type: 'number',
			default: 20,
			min: 0,
			max: 56,
		},
		{
			key: 'showDate',
			label: 'Include Date',
			type: 'boolean',
			default: false,
		},
	],
	outputType: 'code',
	generate(params) {
		const blinkColon = params.blinkColon !== false;
		const x = (params.x as number) || 24;
		const y = (params.y as number) || 20;
		const showDate = params.showDate === true;

		const lines: string[] = [
			'// ========== Digital Clock Display ==========',
			'',
			'int clock_hours = 0;',
			'int clock_minutes = 0;',
			'int clock_seconds = 0;',
			'int clock_timer = 0;',
		];

		if (blinkColon) {
			lines.push('int clock_colon_on = TRUE;');
		}

		if (showDate) {
			lines.push('int clock_day = 1;');
			lines.push('int clock_month = 1;');
		}

		lines.push('');
		lines.push('// Call this from main { } every cycle');
		lines.push('function ClockTick() {');
		lines.push('    clock_timer = clock_timer + get_rtime();');
		lines.push('    if(clock_timer >= 1000) {');
		lines.push('        clock_timer = clock_timer - 1000;');
		lines.push('        clock_seconds = clock_seconds + 1;');
		lines.push('        if(clock_seconds >= 60) {');
		lines.push('            clock_seconds = 0;');
		lines.push('            clock_minutes = clock_minutes + 1;');
		lines.push('            if(clock_minutes >= 60) {');
		lines.push('                clock_minutes = 0;');
		lines.push('                clock_hours = clock_hours + 1;');
		lines.push('                if(clock_hours >= 24) clock_hours = 0;');
		lines.push('            }');
		lines.push('        }');

		if (blinkColon) {
			lines.push('        clock_colon_on = !clock_colon_on;');
		}

		lines.push('    }');
		lines.push('}');
		lines.push('');

		lines.push('function DrawClock() {');
		lines.push(`    // Hours`);
		lines.push(`    PrintNumber(clock_hours / 10, 1, ${x}, ${y}, OLED_FONT_MEDIUM);`);
		lines.push(`    PrintNumber(clock_hours % 10, 1, ${x + 12}, ${y}, OLED_FONT_MEDIUM);`);
		lines.push('');

		if (blinkColon) {
			lines.push('    // Blinking colon');
			lines.push('    if(clock_colon_on) {');
			lines.push(`        pixel_oled(${x + 26}, ${y + 3}, 1);`);
			lines.push(`        pixel_oled(${x + 26}, ${y + 7}, 1);`);
			lines.push('    }');
		} else {
			lines.push('    // Colon');
			lines.push(`    pixel_oled(${x + 26}, ${y + 3}, 1);`);
			lines.push(`    pixel_oled(${x + 26}, ${y + 7}, 1);`);
		}

		lines.push('');
		lines.push(`    // Minutes`);
		lines.push(`    PrintNumber(clock_minutes / 10, 1, ${x + 30}, ${y}, OLED_FONT_MEDIUM);`);
		lines.push(`    PrintNumber(clock_minutes % 10, 1, ${x + 42}, ${y}, OLED_FONT_MEDIUM);`);
		lines.push('');
		lines.push(`    // Seconds (smaller)`);
		lines.push(`    PrintNumber(clock_seconds / 10, 1, ${x + 58}, ${y + 4}, OLED_FONT_SMALL);`);
		lines.push(`    PrintNumber(clock_seconds % 10, 1, ${x + 64}, ${y + 4}, OLED_FONT_SMALL);`);

		if (showDate) {
			lines.push('');
			lines.push(`    // Date`);
			lines.push(`    PrintNumber(clock_day / 10, 1, ${x + 10}, ${y + 18}, OLED_FONT_SMALL);`);
			lines.push(`    PrintNumber(clock_day % 10, 1, ${x + 16}, ${y + 18}, OLED_FONT_SMALL);`);
			lines.push(`    pixel_oled(${x + 23}, ${y + 22}, 1); // separator dot`);
			lines.push(`    PrintNumber(clock_month / 10, 1, ${x + 28}, ${y + 18}, OLED_FONT_SMALL);`);
			lines.push(`    PrintNumber(clock_month % 10, 1, ${x + 34}, ${y + 18}, OLED_FONT_SMALL);`);
		}

		lines.push('}');

		return {
			type: 'code',
			code: lines.join('\n'),
			description: `Digital clock at (${x},${y})${blinkColon ? ' with blinking colon' : ''}${showDate ? ' + date' : ''}`,
		};
	},
};

// ==================== Registry ====================

const ALL_TEMPLATES: ScriptTemplate[] = [
	stateMachine,
	oledMenu,
	persistence,
	screensaver,
	quickToggle,
	digitalClock,
];

export function getTemplate(id: string): ScriptTemplate | undefined {
	return ALL_TEMPLATES.find((t) => t.id === id);
}

export function listTemplates(category?: ScriptTemplate['category']): ScriptTemplate[] {
	if (!category) return ALL_TEMPLATES;
	return ALL_TEMPLATES.filter((t) => t.category === category);
}

export function listTemplateCategories(): ScriptTemplate['category'][] {
	return [...new Set(ALL_TEMPLATES.map((t) => t.category))];
}

export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
	'state-machine': 'State Machines',
	menu: 'Menus',
	persistence: 'Persistence',
	utility: 'Utilities',
	display: 'Display',
};
