import { createEmptyFlowProject } from '$lib/types/flow';
import { createModuleNode } from '$lib/flow/module-nodes';
import { syncModuleToggles } from '$lib/flow/auto-link';
import type { ModuleDefinition } from '$lib/types/module';
import type { FlowProject } from '$lib/types/flow';

/**
 * Create a FlowProject pre-populated with module nodes for each
 * selected module, with auto-linked toggles in the menu flow.
 */
export function createFlowProjectFromModules(modules: ModuleDefinition[]): FlowProject {
	const project = createEmptyFlowProject();
	const gameplayFlow = project.flows.find((f) => f.flowType === 'gameplay');
	if (!gameplayFlow) return project;

	const COLS = 3;
	const X_START = 100;
	const Y_START = 100;
	const X_SPACING = 280;
	const Y_SPACING = 160;

	for (let i = 0; i < modules.length; i++) {
		const col = i % COLS;
		const row = Math.floor(i / COLS);
		const position = {
			x: X_START + col * X_SPACING,
			y: Y_START + row * Y_SPACING,
		};
		const moduleNode = createModuleNode(modules[i], position);
		gameplayFlow.nodes.push(moduleNode);
	}

	// Auto-create menu toggles and shared enable variables
	syncModuleToggles(project);

	return project;
}
