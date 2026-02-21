import type {
	FlowGraph,
	FlowNode,
	FlowEdge,
	FlowCondition,
	FlowVariable,
	FlowNodeType,
} from '$lib/types/flow';
import { createEmptyFlowGraph, createFlowNode, createFlowEdge } from '$lib/types/flow';

// ==================== Canvas State ====================

interface CanvasState {
	panX: number;
	panY: number;
	zoom: number;
}

// ==================== Editor State ====================

interface FlowEditorState {
	graph: FlowGraph | null;
	gamePath: string | null;
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
	canvas: CanvasState;
	dirty: boolean;
	connecting: ConnectingState | null;
}

interface ConnectingState {
	sourceNodeId: string;
	sourcePort: string;
	mouseX: number;
	mouseY: number;
}

// ==================== Undo/Redo ====================

interface UndoEntry {
	graph: string; // JSON serialized FlowGraph
	description: string;
}

let undoStack = $state<UndoEntry[]>([]);
let redoStack = $state<UndoEntry[]>([]);

const MAX_UNDO = 50;

function pushUndo(description: string) {
	if (!state.graph) return;
	undoStack = [
		...undoStack.slice(-(MAX_UNDO - 1)),
		{ graph: JSON.stringify(state.graph), description },
	];
	redoStack = [];
}

// ==================== State ====================

let state = $state<FlowEditorState>({
	graph: null,
	gamePath: null,
	selectedNodeId: null,
	selectedEdgeId: null,
	canvas: { panX: 0, panY: 0, zoom: 1 },
	dirty: false,
	connecting: null,
});

// ==================== Getters ====================

export function getFlowStore() {
	return state;
}

export function getSelectedNode(): FlowNode | null {
	if (!state.graph || !state.selectedNodeId) return null;
	return state.graph.nodes.find((n) => n.id === state.selectedNodeId) ?? null;
}

export function getSelectedEdge(): FlowEdge | null {
	if (!state.graph || !state.selectedEdgeId) return null;
	return state.graph.edges.find((e) => e.id === state.selectedEdgeId) ?? null;
}

export function canUndo(): boolean {
	return undoStack.length > 0;
}

export function canRedo(): boolean {
	return redoStack.length > 0;
}

// ==================== Graph Lifecycle ====================

export function newGraph(name: string, gamePath?: string) {
	state.graph = createEmptyFlowGraph(name);
	state.gamePath = gamePath ?? null;
	state.selectedNodeId = null;
	state.selectedEdgeId = null;
	state.canvas = { panX: 0, panY: 0, zoom: 1 };
	state.dirty = true;
	undoStack = [];
	redoStack = [];
}

export function loadGraph(graph: FlowGraph, gamePath: string) {
	state.graph = graph;
	state.gamePath = gamePath;
	state.selectedNodeId = null;
	state.selectedEdgeId = null;
	state.canvas = { panX: 0, panY: 0, zoom: 1 };
	state.dirty = false;
	undoStack = [];
	redoStack = [];
}

export function closeGraph() {
	state.graph = null;
	state.gamePath = null;
	state.selectedNodeId = null;
	state.selectedEdgeId = null;
	state.dirty = false;
	undoStack = [];
	redoStack = [];
}

export function markClean() {
	state.dirty = false;
}

// ==================== Node Operations ====================

export function addNode(type: FlowNodeType, position: { x: number; y: number }): FlowNode | null {
	if (!state.graph) return null;
	pushUndo('Add node');
	const node = createFlowNode(type, type.charAt(0).toUpperCase() + type.slice(1), position);
	if (state.graph.nodes.length === 0) {
		node.isInitialState = true;
	}
	state.graph.nodes = [...state.graph.nodes, node];
	state.graph.updatedAt = Date.now();
	state.dirty = true;
	return node;
}

export function removeNode(nodeId: string) {
	if (!state.graph) return;
	pushUndo('Remove node');
	state.graph.edges = state.graph.edges.filter(
		(e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
	);
	const wasInitial = state.graph.nodes.find((n) => n.id === nodeId)?.isInitialState;
	state.graph.nodes = state.graph.nodes.filter((n) => n.id !== nodeId);
	if (wasInitial && state.graph.nodes.length > 0) {
		state.graph.nodes[0].isInitialState = true;
	}
	if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

export function updateNode(nodeId: string, updates: Partial<FlowNode>) {
	if (!state.graph) return;
	pushUndo('Update node');
	state.graph.nodes = state.graph.nodes.map((n) =>
		n.id === nodeId ? { ...n, ...updates } : n
	);
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

export function moveNode(nodeId: string, position: { x: number; y: number }) {
	if (!state.graph) return;
	// No undo for drag moves — too many intermediate states
	state.graph.nodes = state.graph.nodes.map((n) =>
		n.id === nodeId ? { ...n, position } : n
	);
	state.dirty = true;
}

export function moveNodeDone(nodeId: string) {
	// Push undo after drag is complete
	pushUndo('Move node');
}

export function setInitialState(nodeId: string) {
	if (!state.graph) return;
	pushUndo('Set initial state');
	state.graph.nodes = state.graph.nodes.map((n) => ({
		...n,
		isInitialState: n.id === nodeId,
	}));
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

export function duplicateNode(nodeId: string): FlowNode | null {
	if (!state.graph) return null;
	const source = state.graph.nodes.find((n) => n.id === nodeId);
	if (!source) return null;
	pushUndo('Duplicate node');
	const node: FlowNode = {
		...structuredClone(source),
		id: crypto.randomUUID(),
		label: `${source.label} Copy`,
		position: { x: source.position.x + 40, y: source.position.y + 40 },
		isInitialState: false,
	};
	state.graph.nodes = [...state.graph.nodes, node];
	state.graph.updatedAt = Date.now();
	state.dirty = true;
	return node;
}

// ==================== Edge Operations ====================

export function addEdge(
	sourceNodeId: string,
	targetNodeId: string,
	label: string,
	condition: FlowCondition
): FlowEdge | null {
	if (!state.graph) return null;
	if (sourceNodeId === targetNodeId) return null;
	// Don't allow duplicate edges
	const exists = state.graph.edges.some(
		(e) => e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId
	);
	if (exists) return null;
	pushUndo('Add edge');
	const edge = createFlowEdge(sourceNodeId, targetNodeId, label, condition);
	state.graph.edges = [...state.graph.edges, edge];
	state.graph.updatedAt = Date.now();
	state.dirty = true;
	return edge;
}

export function removeEdge(edgeId: string) {
	if (!state.graph) return;
	pushUndo('Remove edge');
	state.graph.edges = state.graph.edges.filter((e) => e.id !== edgeId);
	if (state.selectedEdgeId === edgeId) state.selectedEdgeId = null;
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

export function updateEdge(edgeId: string, updates: Partial<FlowEdge>) {
	if (!state.graph) return;
	pushUndo('Update edge');
	state.graph.edges = state.graph.edges.map((e) =>
		e.id === edgeId ? { ...e, ...updates } : e
	);
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

// ==================== Selection ====================

export function selectNode(nodeId: string | null) {
	state.selectedNodeId = nodeId;
	state.selectedEdgeId = null;
}

export function selectEdge(edgeId: string | null) {
	state.selectedEdgeId = edgeId;
	state.selectedNodeId = null;
}

export function clearSelection() {
	state.selectedNodeId = null;
	state.selectedEdgeId = null;
}

// ==================== Canvas ====================

export function setPan(x: number, y: number) {
	state.canvas.panX = x;
	state.canvas.panY = y;
}

export function setZoom(zoom: number) {
	state.canvas.zoom = Math.max(0.1, Math.min(3, zoom));
}

export function zoomToFit() {
	if (!state.graph || state.graph.nodes.length === 0) return;
	const nodes = state.graph.nodes;
	const padding = 100;
	const minX = Math.min(...nodes.map((n) => n.position.x)) - padding;
	const minY = Math.min(...nodes.map((n) => n.position.y)) - padding;
	const maxX = Math.max(...nodes.map((n) => n.position.x + 220)) + padding;
	const maxY = Math.max(...nodes.map((n) => n.position.y + 120)) + padding;
	const width = maxX - minX;
	const height = maxY - minY;
	// Zoom and pan are set by the canvas component based on its dimensions
	state.canvas.panX = -minX;
	state.canvas.panY = -minY;
	state.canvas.zoom = 1;
}

// ==================== Connecting ====================

export function startConnecting(sourceNodeId: string, sourcePort: string, mx: number, my: number) {
	state.connecting = { sourceNodeId, sourcePort, mouseX: mx, mouseY: my };
}

export function updateConnecting(mx: number, my: number) {
	if (state.connecting) {
		state.connecting = { ...state.connecting, mouseX: mx, mouseY: my };
	}
}

export function finishConnecting(targetNodeId: string | null) {
	if (state.connecting && targetNodeId) {
		addEdge(state.connecting.sourceNodeId, targetNodeId, '', {
			type: 'button_press',
			button: 'CONFIRM_BTN',
		});
	}
	state.connecting = null;
}

export function cancelConnecting() {
	state.connecting = null;
}

// ==================== Undo/Redo ====================

export function undo() {
	if (undoStack.length === 0 || !state.graph) return;
	const entry = undoStack[undoStack.length - 1];
	undoStack = undoStack.slice(0, -1);
	redoStack = [...redoStack, { graph: JSON.stringify(state.graph), description: entry.description }];
	state.graph = JSON.parse(entry.graph);
	state.dirty = true;
}

export function redo() {
	if (redoStack.length === 0 || !state.graph) return;
	const entry = redoStack[redoStack.length - 1];
	redoStack = redoStack.slice(0, -1);
	undoStack = [...undoStack, { graph: JSON.stringify(state.graph), description: entry.description }];
	state.graph = JSON.parse(entry.graph);
	state.dirty = true;
}

// ==================== Global Variables ====================

export function addGlobalVariable(variable: FlowVariable) {
	if (!state.graph) return;
	pushUndo('Add global variable');
	state.graph.globalVariables = [...state.graph.globalVariables, variable];
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

export function removeGlobalVariable(name: string) {
	if (!state.graph) return;
	pushUndo('Remove global variable');
	state.graph.globalVariables = state.graph.globalVariables.filter((v) => v.name !== name);
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}

export function updateGlobalCode(code: string) {
	if (!state.graph) return;
	pushUndo('Update global code');
	state.graph.globalCode = code;
	state.graph.updatedAt = Date.now();
	state.dirty = true;
}
