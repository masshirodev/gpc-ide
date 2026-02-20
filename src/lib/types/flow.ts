import type { SerializedScene } from '../../routes/tools/oled/types';

// ==================== Flow Node Types ====================

export type FlowNodeType = 'intro' | 'home' | 'menu' | 'submenu' | 'custom' | 'screensaver';

export interface FlowVariable {
	name: string;
	type: 'int' | 'int8' | 'int16' | 'int32';
	defaultValue: number;
	persist: boolean;
	min?: number;
	max?: number;
}

export interface WidgetPlacement {
	widgetId: string;
	x: number;
	y: number;
	config: Record<string, unknown>;
	boundVariable?: string;
}

export interface FlowNode {
	id: string;
	type: FlowNodeType;
	label: string;
	position: { x: number; y: number };
	gpcCode: string;
	oledScene: SerializedScene | null;
	oledWidgets: WidgetPlacement[];
	comboCode: string;
	isInitialState: boolean;
	variables: FlowVariable[];
	onEnter: string;
	onExit: string;
	chunkRef: string | null;
}

// ==================== Flow Edge Types ====================

export type FlowConditionType =
	| 'button_press'
	| 'button_hold'
	| 'timeout'
	| 'variable'
	| 'custom';

export interface FlowCondition {
	type: FlowConditionType;
	button?: string;
	timeoutMs?: number;
	variable?: string;
	comparison?: '==' | '!=' | '>' | '<' | '>=' | '<=';
	value?: number;
	customCode?: string;
}

export interface FlowEdge {
	id: string;
	sourceNodeId: string;
	targetNodeId: string;
	sourcePort: string;
	targetPort: string;
	label: string;
	condition: FlowCondition;
}

// ==================== Flow Graph ====================

export interface FlowSettings {
	screenTimeoutMs: number;
	defaultFont: string;
	includeCommonUtils: boolean;
	persistenceEnabled: boolean;
	buttonMapping: {
		confirm: string;
		cancel: string;
		up: string;
		down: string;
		left: string;
		right: string;
	};
}

export interface FlowGraph {
	id: string;
	name: string;
	version: number;
	nodes: FlowNode[];
	edges: FlowEdge[];
	globalVariables: FlowVariable[];
	globalCode: string;
	settings: FlowSettings;
	createdAt: number;
	updatedAt: number;
}

// ==================== Chunks ====================

export interface ChunkEdgeTemplate {
	label: string;
	condition: FlowCondition;
	direction: 'outgoing' | 'incoming';
}

export interface ChunkParameter {
	key: string;
	label: string;
	type: 'string' | 'number' | 'boolean' | 'button' | 'code';
	defaultValue: string;
	description: string;
}

export interface FlowChunk {
	id: string;
	name: string;
	description: string;
	category: string;
	tags: string[];
	nodeTemplate: Partial<FlowNode>;
	edgeTemplates: ChunkEdgeTemplate[];
	parameters: ChunkParameter[];
	createdAt: number;
	updatedAt: number;
}

// ==================== OLED Widget Types ====================

export interface WidgetParam {
	key: string;
	label: string;
	type: 'number' | 'boolean' | 'select';
	default: unknown;
	min?: number;
	max?: number;
	options?: { value: unknown; label: string }[];
}

export interface OledWidgetDef {
	id: string;
	name: string;
	category: 'bar' | 'indicator' | 'diagnostic' | 'decorative';
	description: string;
	width: number;
	height: number;
	params: WidgetParam[];
	render: (config: Record<string, unknown>, value: number, pixels: Uint8Array, x: number, y: number) => void;
	generateGpc: (config: Record<string, unknown>, varName: string, x: number, y: number) => string;
}

// ==================== Template Types ====================

export interface TemplateParam {
	key: string;
	label: string;
	type: 'string' | 'number' | 'boolean' | 'select';
	default: unknown;
	options?: { value: unknown; label: string }[];
	description: string;
}

export interface ScriptTemplate {
	id: string;
	name: string;
	description: string;
	category: 'state-machine' | 'oled-menu' | 'persistence' | 'screensaver' | 'utility';
	tags: string[];
	generatesCode: boolean;
	generatesFlowGraph: boolean;
	params: TemplateParam[];
	generateCode?: (params: Record<string, unknown>) => string;
	generateFlowGraph?: (params: Record<string, unknown>) => FlowGraph;
}

// ==================== Defaults / Helpers ====================

export const DEFAULT_FLOW_SETTINGS: FlowSettings = {
	screenTimeoutMs: 5000,
	defaultFont: 'OLED_FONT_SMALL',
	includeCommonUtils: true,
	persistenceEnabled: true,
	buttonMapping: {
		confirm: 'CONFIRM_BTN',
		cancel: 'CANCEL_BTN',
		up: 'UP_BTN',
		down: 'DOWN_BTN',
		left: 'LEFT_BTN',
		right: 'RIGHT_BTN',
	},
};

export function createEmptyFlowGraph(name: string): FlowGraph {
	return {
		id: crypto.randomUUID(),
		name,
		version: 1,
		nodes: [],
		edges: [],
		globalVariables: [],
		globalCode: '',
		settings: { ...DEFAULT_FLOW_SETTINGS },
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}

export function createFlowNode(
	type: FlowNodeType,
	label: string,
	position: { x: number; y: number }
): FlowNode {
	return {
		id: crypto.randomUUID(),
		type,
		label,
		position,
		gpcCode: '',
		oledScene: null,
		oledWidgets: [],
		comboCode: '',
		isInitialState: false,
		variables: [],
		onEnter: '',
		onExit: '',
		chunkRef: null,
	};
}

export function createFlowEdge(
	sourceNodeId: string,
	targetNodeId: string,
	label: string,
	condition: FlowCondition
): FlowEdge {
	return {
		id: crypto.randomUUID(),
		sourceNodeId,
		targetNodeId,
		sourcePort: 'right',
		targetPort: 'left',
		label,
		condition,
	};
}

export const NODE_COLORS: Record<FlowNodeType, string> = {
	intro: '#3b82f6',
	home: '#22c55e',
	menu: '#a855f7',
	submenu: '#f97316',
	custom: '#6b7280',
	screensaver: '#06b6d4',
};

export const NODE_LABELS: Record<FlowNodeType, string> = {
	intro: 'Intro',
	home: 'Home',
	menu: 'Menu',
	submenu: 'Submenu',
	custom: 'Custom',
	screensaver: 'Screensaver',
};
