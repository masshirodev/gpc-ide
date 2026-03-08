import { describe, it, expect } from 'vitest';
import { generateFlowGpc } from './codegen';
import {
	createEmptyFlowGraph,
	createFlowNode,
	createFlowEdge,
	createSubNode,
} from '$lib/types/flow';
import type { FlowGraph, FlowNode, SubNode } from '$lib/types/flow';

// Helper: build a minimal graph with one node
function oneNodeGraph(nodeSetup?: (node: FlowNode) => void): FlowGraph {
	const g = createEmptyFlowGraph('Test');
	const node = createFlowNode('menu', 'Main', { x: 0, y: 0 });
	node.isInitialState = true;
	if (nodeSetup) nodeSetup(node);
	g.nodes = [node];
	return g;
}

// Helper: build a graph with two nodes + a transition edge
function twoNodeGraph(opts?: {
	nodeA?: (n: FlowNode) => void;
	nodeB?: (n: FlowNode) => void;
}): FlowGraph {
	const g = createEmptyFlowGraph('Test');
	const a = createFlowNode('menu', 'NodeA', { x: 0, y: 0 });
	a.isInitialState = true;
	const b = createFlowNode('menu', 'NodeB', { x: 300, y: 0 });
	if (opts?.nodeA) opts.nodeA(a);
	if (opts?.nodeB) opts.nodeB(b);
	const edge = createFlowEdge(a.id, b.id, 'go', {
		type: 'button_press',
		button: 'PS5_CROSS',
	});
	g.nodes = [a, b];
	g.edges = [edge];
	return g;
}

// Helper: add a toggle-item sub-node to a node
function addToggle(node: FlowNode, label: string, varName: string): SubNode {
	const sn = createSubNode('toggle-item', label, node.subNodes.length, true);
	sn.config = {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		onText: 'ON',
		offText: 'OFF',
		valueAlign: 'right',
		valueMargin: 0,
		font: 'default',
	};
	sn.boundVariable = varName;
	node.subNodes = [...node.subNodes, sn];
	node.variables = [
		...node.variables,
		{ name: varName, type: 'int', defaultValue: 0, persist: false },
	];
	return sn;
}

// Helper: add a value-item sub-node to a node
function addValueItem(
	node: FlowNode,
	label: string,
	varName: string,
	min = 0,
	max = 100
): SubNode {
	const sn = createSubNode('value-item', label, node.subNodes.length, true);
	sn.config = {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		min,
		max,
		step: 1,
		valueAlign: 'right',
		valueMargin: 0,
		format: '{value}',
		adjustButtons: ['DPAD_LEFT', 'DPAD_RIGHT'],
		font: 'default',
	};
	sn.boundVariable = varName;
	node.subNodes = [...node.subNodes, sn];
	node.variables = [
		...node.variables,
		{ name: varName, type: 'int', defaultValue: 0, persist: false, min, max },
	];
	return sn;
}

// Helper: add an array-item sub-node to a node
function addArrayItem(
	node: FlowNode,
	label: string,
	varName: string,
	arrayName: string,
	arraySize: number
): SubNode {
	const sn = createSubNode('array-item', label, node.subNodes.length, true);
	sn.config = {
		cursorStyle: 'prefix',
		prefixChar: '>',
		prefixSpacing: 1,
		arrayName,
		arraySize,
		useCountVar: false,
		countVar: '',
		font: 'default',
	};
	sn.boundVariable = varName;
	node.subNodes = [...node.subNodes, sn];
	node.variables = [
		...node.variables,
		{ name: varName, type: 'int', defaultValue: 0, persist: false },
	];
	return sn;
}

// Helper: add a header sub-node (static, non-interactive)
function addHeader(node: FlowNode, label: string): SubNode {
	const sn = createSubNode('header', label, node.subNodes.length, false);
	sn.config = { align: 'center', font: 'default', separator: true };
	node.subNodes = [...node.subNodes, sn];
	return sn;
}

describe('codegen FlowRedraw', () => {
	it('declares FlowRedraw variable', () => {
		const code = generateFlowGpc(oneNodeGraph());
		expect(code).toContain('int FlowRedraw = TRUE;');
	});

	it('declares FlowEntered variable', () => {
		const code = generateFlowGpc(oneNodeGraph());
		expect(code).toContain('int FlowEntered;');
	});

	it('sets FlowRedraw and FlowEntered on state change in main loop', () => {
		const code = generateFlowGpc(oneNodeGraph());
		expect(code).toContain('FlowRedraw = TRUE;');
		expect(code).toContain('FlowEntered = TRUE;');
		// Both should be inside the state change detection block
		const stateChangeBlock = code.slice(
			code.indexOf('// State change detection'),
			code.indexOf('FlowStateTimer = FlowStateTimer')
		);
		expect(stateChangeBlock).toContain('FlowRedraw = TRUE;');
		expect(stateChangeBlock).toContain('FlowEntered = TRUE;');
	});

	it('wraps sub-node rendering in if(FlowRedraw) guard', () => {
		const g = oneNodeGraph((n) => {
			addHeader(n, 'Title');
			addToggle(n, 'Aim Assist', 'aim_assist');
		});
		const code = generateFlowGpc(g);
		// Rendering block should be guarded
		expect(code).toContain('if(FlowRedraw) {');
		expect(code).toContain('FlowRedraw = FALSE;');
		// cls_oled should be inside the guard, not at the top level of the state fn
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		const guardIdx = stateFn.indexOf('if(FlowRedraw) {');
		const clsIdx = stateFn.indexOf('cls_oled(OLED_BLACK)');
		expect(guardIdx).toBeLessThan(clsIdx);
	});

	it('does NOT call cls_oled outside the FlowRedraw guard', () => {
		const g = oneNodeGraph((n) => {
			addHeader(n, 'Title');
		});
		const code = generateFlowGpc(g);
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		// Find all cls_oled calls — they should all be inside the guard
		const lines = stateFn.split('\n');
		for (const line of lines) {
			if (line.includes('cls_oled')) {
				// This line must be after the FlowRedraw guard opens
				const beforeLine = stateFn.slice(0, stateFn.indexOf(line));
				expect(beforeLine).toContain('if(FlowRedraw)');
			}
		}
	});

	it('sets FlowRedraw on cursor up/down navigation', () => {
		const g = oneNodeGraph((n) => {
			addToggle(n, 'Option A', 'opt_a');
			addToggle(n, 'Option B', 'opt_b');
		});
		const code = generateFlowGpc(g);
		// Cursor navigation lines should set FlowRedraw
		const navSection = code.slice(
			code.indexOf('// Cursor navigation'),
			code.indexOf('// Render')
		);
		// UP press sets FlowRedraw
		expect(navSection).toMatch(/event_press\(PS5_UP\).*FlowRedraw = TRUE/);
		// DOWN press sets FlowRedraw
		expect(navSection).toMatch(/event_press\(PS5_DOWN\).*FlowRedraw = TRUE/);
	});

	it('sets FlowRedraw on toggle confirm', () => {
		const g = oneNodeGraph((n) => {
			addToggle(n, 'Aim Assist', 'aim_assist');
		});
		const code = generateFlowGpc(g);
		// Confirm press should toggle variable AND set FlowRedraw
		expect(code).toMatch(/event_press\(PS5_CROSS\).*aim_assist.*FlowRedraw = TRUE/);
	});

	it('generates value-item input handling outside the render guard', () => {
		const g = oneNodeGraph((n) => {
			addValueItem(n, 'Sensitivity', 'sens', 0, 100);
		});
		const code = generateFlowGpc(g);
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		// Value adjustment should be BEFORE the render guard
		const adjustIdx = stateFn.indexOf('Value adjust: Sensitivity');
		const guardIdx = stateFn.indexOf('if(FlowRedraw) {');
		expect(adjustIdx).toBeGreaterThan(-1);
		expect(guardIdx).toBeGreaterThan(-1);
		expect(adjustIdx).toBeLessThan(guardIdx);
		// Value adjust should set FlowRedraw
		expect(stateFn).toMatch(/event_press\(PS5_LEFT\).*FlowRedraw = TRUE/);
		expect(stateFn).toMatch(/event_press\(PS5_RIGHT\).*FlowRedraw = TRUE/);
	});

	it('generates array-item input handling outside the render guard', () => {
		const g = oneNodeGraph((n) => {
			addArrayItem(n, 'Weapon', 'weapon_idx', 'Weapons', 10);
		});
		const code = generateFlowGpc(g);
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		// Array cycling should be BEFORE the render guard
		const cycleIdx = stateFn.indexOf('Array cycle: Weapon');
		const guardIdx = stateFn.indexOf('if(FlowRedraw) {');
		expect(cycleIdx).toBeGreaterThan(-1);
		expect(guardIdx).toBeGreaterThan(-1);
		expect(cycleIdx).toBeLessThan(guardIdx);
		// Array cycle should set FlowRedraw
		expect(stateFn).toMatch(/event_press\(PS5_LEFT\).*FlowRedraw = TRUE/);
		expect(stateFn).toMatch(/event_press\(PS5_RIGHT\).*FlowRedraw = TRUE/);
	});

	it('puts custom gpcCode OUTSIDE the render guard (runs every cycle)', () => {
		const g = oneNodeGraph((n) => {
			addHeader(n, 'Title');
			n.gpcCode = 'some_custom_logic();';
		});
		const code = generateFlowGpc(g);
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		// Custom code should be after the render guard closes
		const guardCloseIdx = stateFn.indexOf('    }', stateFn.indexOf('if(FlowRedraw)'));
		const customIdx = stateFn.indexOf('some_custom_logic()');
		expect(customIdx).toBeGreaterThan(guardCloseIdx);
	});

	it('uses FlowEntered for onEnter code', () => {
		const g = oneNodeGraph((n) => {
			n.onEnter = 'startup_code();';
		});
		const code = generateFlowGpc(g);
		expect(code).toContain('if(FlowEntered)');
		expect(code).toContain('FlowEntered = FALSE;');
		expect(code).toContain('startup_code();');
	});

	it('wraps legacy oledScene rendering in FlowRedraw guard', () => {
		const g = oneNodeGraph((n) => {
			// Legacy node with oledScene but no sub-nodes
			n.oledScene = {
				id: 'test',
				name: 'test',
				pixels: btoa(String.fromCharCode(...new Uint8Array(1024))),
			};
		});
		const code = generateFlowGpc(g);
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		// Draw function call should be inside FlowRedraw guard
		expect(stateFn).toContain('if(FlowRedraw)');
		expect(stateFn).toContain('Draw_Flow_Main');
	});

	it('transitions run every cycle (not inside FlowRedraw guard)', () => {
		const g = twoNodeGraph();
		const code = generateFlowGpc(g);
		const stateFn = code.slice(
			code.indexOf('function FlowState_NodeA'),
			code.indexOf('function FlowState_NodeB')
		);
		// Transition should be outside/after the FlowRedraw guard
		const transitionIdx = stateFn.indexOf('// Transitions');
		const guardIdx = stateFn.indexOf('if(FlowRedraw)');
		// For a node with no sub-nodes and no oledScene, there's no guard
		// but the transition should still be present
		expect(transitionIdx).toBeGreaterThan(-1);
		expect(stateFn).toContain('FLOW_STATE_NodeB');
	});

	it('wrap-mode cursor sets FlowRedraw', () => {
		const g = oneNodeGraph((n) => {
			n.scrollMode = 'wrap';
			addToggle(n, 'A', 'opt_a');
			addToggle(n, 'B', 'opt_b');
		});
		const code = generateFlowGpc(g);
		const navSection = code.slice(
			code.indexOf('// Cursor navigation'),
			code.indexOf('// Render')
		);
		// Both up and down should set FlowRedraw in wrap mode
		const upLine = navSection
			.split('\n')
			.find((l) => l.includes('PS5_UP'));
		const downLine = navSection
			.split('\n')
			.find((l) => l.includes('PS5_DOWN'));
		expect(upLine).toContain('FlowRedraw = TRUE');
		expect(downLine).toContain('FlowRedraw = TRUE');
	});

	it('window-mode cursor sets FlowRedraw', () => {
		const g = oneNodeGraph((n) => {
			n.scrollMode = 'window';
			n.visibleCount = 3;
			addToggle(n, 'A', 'opt_a');
			addToggle(n, 'B', 'opt_b');
			addToggle(n, 'C', 'opt_c');
			addToggle(n, 'D', 'opt_d');
		});
		const code = generateFlowGpc(g);
		const navSection = code.slice(
			code.indexOf('// Cursor navigation'),
			code.indexOf('// Render')
		);
		const upLine = navSection
			.split('\n')
			.find((l) => l.includes('PS5_UP'));
		const downLine = navSection
			.split('\n')
			.find((l) => l.includes('PS5_DOWN'));
		expect(upLine).toContain('FlowRedraw = TRUE');
		expect(downLine).toContain('FlowRedraw = TRUE');
	});

	it('back button still works (state change triggers FlowRedraw via main loop)', () => {
		const g = oneNodeGraph((n) => {
			n.backButton = 'PS5_CIRCLE';
			addHeader(n, 'Title');
		});
		const code = generateFlowGpc(g);
		const stateFn = code.slice(code.indexOf('function FlowState_Main'));
		// Back button changes FlowCurrentState
		expect(stateFn).toContain('// Back button');
		expect(stateFn).toContain('FlowCurrentState = FlowStateStack[FlowStackTop]');
		// Main loop state change detection sets FlowRedraw
		const mainLoop = code.slice(code.indexOf('main {'));
		expect(mainLoop).toContain('FlowRedraw = TRUE;');
	});
});
