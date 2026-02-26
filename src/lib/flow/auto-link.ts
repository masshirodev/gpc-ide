import type { FlowProject, FlowGraph, FlowNode, SubNode } from '$lib/types/flow';

/**
 * Auto-link tag placed on auto-created sub-nodes so we can track them.
 */
const AUTO_LINK_TAG = '__auto_module_toggle';

/**
 * Synchronises module toggles between gameplay and menu flows.
 *
 * For every module node in the gameplay flow:
 *   - Ensures a toggle-item sub-node exists in a "Module Settings" page
 *     in the menu flow, bound to the module's enableVariable.
 *
 * If a module node is removed from gameplay, its auto-created toggle
 * is also removed from the menu flow.
 *
 * This function is idempotent — safe to call repeatedly.
 */
export function syncModuleToggles(project: FlowProject): boolean {
	const gameplayFlow = project.flows.find((f) => f.flowType === 'gameplay');
	const menuFlow = project.flows.find((f) => f.flowType === 'menu');
	if (!gameplayFlow || !menuFlow) return false;

	// Collect all module nodes and their enable variables
	const moduleNodes = gameplayFlow.nodes.filter((n) => n.type === 'module' && n.moduleData);
	const enableVars = new Set(moduleNodes.map((n) => n.moduleData!.enableVariable));

	// Find or create the "Module Settings" page node in menu flow
	let settingsNode = menuFlow.nodes.find(
		(n) => n.label === 'Module Settings' && n.subNodes.some((s) => s.config[AUTO_LINK_TAG])
	);

	let changed = false;

	if (!settingsNode && moduleNodes.length > 0) {
		// Create the settings page node
		settingsNode = createSettingsNode(menuFlow);
		menuFlow.nodes.push(settingsNode);
		changed = true;
	}

	if (!settingsNode) return changed;

	// Get existing auto-linked toggles
	const existingToggles = settingsNode.subNodes.filter((s) => s.config[AUTO_LINK_TAG]);
	const existingVarSet = new Set(existingToggles.map((s) => s.boundVariable));

	// Add missing toggles
	for (const modNode of moduleNodes) {
		const enableVar = modNode.moduleData!.enableVariable;
		if (!existingVarSet.has(enableVar)) {
			const toggle = createToggleSubNode(
				modNode.label,
				enableVar,
				settingsNode.subNodes.length
			);
			settingsNode.subNodes.push(toggle);

			// Ensure the enable variable exists on the settings node
			if (!settingsNode.variables.some((v) => v.name === enableVar)) {
				settingsNode.variables.push({
					name: enableVar,
					type: 'int',
					defaultValue: 0,
					persist: true,
				});
			}
			changed = true;
		}
	}

	// Remove toggles for deleted modules
	const toRemove = existingToggles.filter(
		(s) => s.boundVariable && !enableVars.has(s.boundVariable)
	);
	if (toRemove.length > 0) {
		const removeIds = new Set(toRemove.map((s) => s.id));
		settingsNode.subNodes = settingsNode.subNodes.filter((s) => !removeIds.has(s.id));

		// Also remove orphaned variables
		const removedVars = new Set(toRemove.map((s) => s.boundVariable).filter(Boolean));
		settingsNode.variables = settingsNode.variables.filter(
			(v) => !removedVars.has(v.name)
		);

		// Re-index order
		settingsNode.subNodes.forEach((s, i) => (s.order = i));
		changed = true;
	}

	// Remove empty settings node if no more module toggles
	if (settingsNode.subNodes.filter((s) => s.config[AUTO_LINK_TAG]).length === 0 && changed) {
		menuFlow.nodes = menuFlow.nodes.filter((n) => n !== settingsNode);
	}

	// Ensure shared variables include all enable vars
	for (const enableVar of enableVars) {
		if (!project.sharedVariables.some((v) => v.name === enableVar)) {
			project.sharedVariables.push({
				name: enableVar,
				type: 'int',
				defaultValue: 0,
				persist: true,
			});
			changed = true;
		}
	}
	// Remove shared variables for deleted modules
	const prevLen = project.sharedVariables.length;
	project.sharedVariables = project.sharedVariables.filter(
		(v) => !v.name.endsWith('_Enabled') || enableVars.has(v.name)
	);
	if (project.sharedVariables.length !== prevLen) changed = true;

	return changed;
}

function createSettingsNode(menuFlow: FlowGraph): FlowNode {
	// Place it offset from existing nodes
	const maxX = menuFlow.nodes.reduce((max, n) => Math.max(max, n.position.x), 0);
	return {
		id: crypto.randomUUID(),
		type: 'menu',
		label: 'Module Settings',
		position: { x: maxX + 300, y: 100 },
		gpcCode: '',
		comboCode: '',
		onEnter: '',
		onExit: '',
		variables: [],
		isInitialState: false,
		subNodes: [],
		oledScene: null,
		oledWidgets: [],
		stackOffsetX: 0,
		stackOffsetY: 0,
		chunkRef: null,
	};
}

function createToggleSubNode(moduleName: string, enableVariable: string, order: number): SubNode {
	return {
		id: crypto.randomUUID(),
		type: 'toggle-item',
		label: moduleName,
		position: 'stack',
		order,
		interactive: true,
		config: {
			label: moduleName,
			cursorStyle: 'prefix',
			prefixChar: '>',
			prefixSpacing: 1,
			onText: 'ON',
			offText: 'OFF',
			valueAlign: 'right',
			font: 'default',
			[AUTO_LINK_TAG]: true,
		},
		boundVariable: enableVariable,
	};
}
