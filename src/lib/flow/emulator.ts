import type { FlowGraph, FlowNode, FlowEdge, SubNode, SubNodeRenderContext } from '$lib/types/flow';
import { getSubNodeDef } from '$lib/flow/subnodes/registry';
import { computeSubNodePixelY, getSortedSubNodes } from '$lib/flow/layout';

// ==================== Types ====================

export interface EmulatorState {
	currentNodeId: string;
	prevNodeId: string | null;
	stateTimer: number;
	variables: Map<string, number | string>;
	cursorPositions: Map<string, number>; // nodeId -> cursor index
	statePath: string[]; // history of node IDs visited
	inputLog: string[];
	frameCount: number;
}

export interface EmulatorInput {
	button: string; // GPC button constant name (e.g. 'CONFIRM_BTN')
	type: 'press' | 'release';
}

// ==================== Keyboard Mapping ====================

export const DEFAULT_KEY_MAP: Record<string, string> = {
	ArrowUp: 'PS5_UP',
	ArrowDown: 'PS5_DOWN',
	ArrowLeft: 'PS5_LEFT',
	ArrowRight: 'PS5_RIGHT',
	Enter: 'PS5_CROSS',
	Backspace: 'PS5_CIRCLE',
	t: 'PS5_TRIANGLE',
	x: 'PS5_SQUARE',
	q: 'PS5_L1',
	e: 'PS5_R1',
	z: 'PS5_L2',
	c: 'PS5_R2',
	Tab: 'PS5_SHARE',
	' ': 'PS5_OPTIONS',
};

// ==================== Emulator Class ====================

export class FlowEmulator {
	graph: FlowGraph;
	state: EmulatorState;
	private heldButtons: Set<string> = new Set();
	private pressedThisFrame: Set<string> = new Set();

	constructor(graph: FlowGraph) {
		this.graph = graph;
		this.state = this.createInitialState();
	}

	private createInitialState(): EmulatorState {
		const initialNode = this.graph.nodes.find((n) => n.isInitialState) || this.graph.nodes[0];
		if (!initialNode) {
			return {
				currentNodeId: '',
				prevNodeId: null,
				stateTimer: 0,
				variables: new Map(),
				cursorPositions: new Map(),
				statePath: [],
				inputLog: [],
				frameCount: 0,
			};
		}

		const variables = new Map<string, number | string>();

		// Initialize global variables
		for (const v of this.graph.globalVariables) {
			variables.set(v.name, v.defaultValue);
		}

		// Initialize per-node variables
		for (const node of this.graph.nodes) {
			for (const v of node.variables) {
				if (!variables.has(v.name)) {
					variables.set(v.name, v.defaultValue);
				}
			}
		}

		return {
			currentNodeId: initialNode.id,
			prevNodeId: null,
			stateTimer: 0,
			variables,
			cursorPositions: new Map(),
			statePath: [initialNode.id],
			inputLog: [],
			frameCount: 0,
		};
	}

	reset(): void {
		this.state = this.createInitialState();
		this.heldButtons.clear();
		this.pressedThisFrame.clear();
	}

	getCurrentNode(): FlowNode | undefined {
		return this.graph.nodes.find((n) => n.id === this.state.currentNodeId);
	}

	getInteractiveSubNodes(node: FlowNode): SubNode[] {
		return getSortedSubNodes(node).filter((sn) => sn.interactive);
	}

	getCursor(nodeId: string): number {
		return this.state.cursorPositions.get(nodeId) ?? 0;
	}

	// ==================== Input ====================

	handleButtonPress(button: string): void {
		this.heldButtons.add(button);
		this.pressedThisFrame.add(button);
		this.state.inputLog.push(button);
		if (this.state.inputLog.length > 50) {
			this.state.inputLog.shift();
		}
	}

	handleButtonRelease(button: string): void {
		this.heldButtons.delete(button);
	}

	private eventPress(button: string): boolean {
		return this.pressedThisFrame.has(button);
	}

	// ==================== Frame ====================

	/**
	 * Advance one frame. Call this at ~60fps or on-demand.
	 * deltaMs: time since last frame in ms (default 16ms = ~60fps)
	 */
	step(deltaMs: number = 16): void {
		const node = this.getCurrentNode();
		if (!node) return;

		this.state.frameCount++;

		// On-enter logic (first frame in this state)
		if (this.state.prevNodeId !== this.state.currentNodeId) {
			this.state.stateTimer = 0;
			this.state.prevNodeId = this.state.currentNodeId;
		}

		this.state.stateTimer += deltaMs;

		// Cursor navigation for interactive sub-nodes
		const bm = this.graph.settings.buttonMapping;
		if (node.subNodes.length > 0) {
			const interactiveSubs = this.getInteractiveSubNodes(node);
			if (interactiveSubs.length > 0) {
				let cursor = this.getCursor(node.id);
				const maxCursor = interactiveSubs.length - 1;

				if (this.eventPress(bm.up)) {
					if (node.scrollMode === 'wrap') {
						cursor = cursor > 0 ? cursor - 1 : maxCursor;
					} else {
						cursor = Math.max(0, cursor - 1);
					}
				}
				if (this.eventPress(bm.down)) {
					if (node.scrollMode === 'wrap') {
						cursor = cursor < maxCursor ? cursor + 1 : 0;
					} else {
						cursor = Math.min(maxCursor, cursor + 1);
					}
				}
				this.state.cursorPositions.set(node.id, cursor);

				// Handle toggle items with CONFIRM
				if (this.eventPress(bm.confirm) && cursor >= 0 && cursor < interactiveSubs.length) {
					const sub = interactiveSubs[cursor];
					if (sub.type === 'toggle-item' && sub.boundVariable) {
						const val = this.state.variables.get(sub.boundVariable);
						this.state.variables.set(sub.boundVariable, val ? 0 : 1);
					}
				}

				// Handle value items with LEFT/RIGHT
				if (cursor >= 0 && cursor < interactiveSubs.length) {
					const sub = interactiveSubs[cursor];
					if (sub.type === 'value-item' && sub.boundVariable) {
						const min = (sub.config.min as number) ?? 0;
						const max = (sub.config.max as number) ?? 100;
						const step = (sub.config.step as number) || 1;
						let val = (this.state.variables.get(sub.boundVariable) as number) ?? 0;
						if (this.eventPress(bm.left) && val > min) {
							val = Math.max(min, val - step);
							this.state.variables.set(sub.boundVariable, val);
						}
						if (this.eventPress(bm.right) && val < max) {
							val = Math.min(max, val + step);
							this.state.variables.set(sub.boundVariable, val);
						}
					}
				}
			}
		}

		// Back button: pop state stack to return to the caller
		if (node.backButton && this.eventPress(node.backButton) && this.state.statePath.length >= 2) {
			// Pop current state off the path
			this.state.statePath.pop();
			const returnTo = this.state.statePath[this.state.statePath.length - 1];
			if (returnTo) {
				this.state.prevNodeId = this.state.currentNodeId;
				this.state.currentNodeId = returnTo;
				this.state.stateTimer = 0;
				this.pressedThisFrame.clear();
				return;
			}
		}

		// Check transitions
		const outEdges = this.graph.edges.filter((e) => e.sourceNodeId === node.id);
		for (const edge of outEdges) {
			if (this.evaluateCondition(edge, node)) {
				this.transition(edge.targetNodeId);
				break;
			}
		}

		// Clear frame-local input
		this.pressedThisFrame.clear();
	}

	// ==================== Transitions ====================

	private evaluateCondition(edge: FlowEdge, currentNode: FlowNode): boolean {
		const c = edge.condition;

		// Sub-node level edge: also check cursor position
		if (edge.sourceSubNodeId) {
			const interactiveSubs = this.getInteractiveSubNodes(currentNode);
			const subIdx = interactiveSubs.findIndex((s) => s.id === edge.sourceSubNodeId);
			if (subIdx < 0) return false;
			const cursor = this.getCursor(currentNode.id);
			if (cursor !== subIdx) return false;
		}

		switch (c.type) {
			case 'button_press':
				return c.button ? this.eventPress(c.button) : false;
			case 'button_hold':
				return c.button && c.timeoutMs
					? this.heldButtons.has(c.button) && this.state.stateTimer > c.timeoutMs
					: c.button
						? this.heldButtons.has(c.button)
						: false;
			case 'timeout':
				return c.timeoutMs ? this.state.stateTimer > c.timeoutMs : false;
			case 'variable': {
				if (!c.variable || !c.comparison) return false;
				const rawVal = this.state.variables.get(c.variable) ?? 0;
				const val = typeof rawVal === 'number' ? rawVal : 0;
				const target = c.value ?? 0;
				switch (c.comparison) {
					case '==': return val === target;
					case '!=': return val !== target;
					case '>': return val > target;
					case '<': return val < target;
					case '>=': return val >= target;
					case '<=': return val <= target;
					default: return false;
				}
			}
			default:
				return false;
		}
	}

	private transition(targetNodeId: string): void {
		this.state.prevNodeId = this.state.currentNodeId;
		this.state.currentNodeId = targetNodeId;
		this.state.stateTimer = 0;
		this.state.statePath.push(targetNodeId);
		if (this.state.statePath.length > 100) {
			this.state.statePath = this.state.statePath.slice(-50);
		}
	}

	// ==================== Rendering ====================

	/**
	 * Render the current node's OLED display to a 128x64 pixel buffer.
	 * Returns a Uint8Array of 1024 bytes (128*64/8, 1 bit per pixel).
	 */
	render(): Uint8Array {
		const pixels = new Uint8Array(1024); // 128x64 / 8
		const node = this.getCurrentNode();
		if (!node) return pixels;

		if (node.subNodes.length > 0) {
			this.renderSubNodes(node, pixels);
		}

		return pixels;
	}

	private renderSubNodes(node: FlowNode, pixels: Uint8Array): void {
		const sortedSubs = getSortedSubNodes(node);
		const interactiveSubs = this.getInteractiveSubNodes(node);
		const cursor = this.getCursor(node.id);

		let cursorIndex = 0;
		for (const sub of sortedSubs) {
			const def = getSubNodeDef(sub.type);
			if (!def) continue;

			const pixelY = computeSubNodePixelY(node, sub);
			const pixelX = sub.position === 'absolute' ? (sub.x ?? 0) : node.stackOffsetX;

			const isSelected = sub.interactive && cursorIndex === cursor;
			const boundValue = sub.boundVariable
				? this.state.variables.get(sub.boundVariable)
				: undefined;

			const ctx: SubNodeRenderContext = {
				pixels,
				x: pixelX,
				y: pixelY,
				width: 128 - pixelX,
				height: def.stackHeight ?? 8,
				isSelected,
				cursorStyle: (sub.config.cursorStyle as string) || 'prefix',
				boundValue: boundValue as number | string | undefined,
			};

			// Merge label into config for render
			const configWithLabel = { ...sub.config, label: sub.label };
			def.render(configWithLabel, ctx);

			if (sub.interactive) cursorIndex++;
		}
	}
}
