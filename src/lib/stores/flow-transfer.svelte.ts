import type { SerializedScene } from '../../routes/tools/oled/types';

export interface FlowOledTransfer {
	nodeId: string;
	subNodeId?: string;
	scene: SerializedScene;
	returnTo: string | null; // game path
	returnPath?: string; // route to navigate back to (e.g. '/' for flow tab, '/tools/flow' for standalone)
}

let transfer = $state<FlowOledTransfer | null>(null);

export function getFlowOledTransfer(): FlowOledTransfer | null {
	return transfer;
}

export function setFlowOledTransfer(data: FlowOledTransfer): void {
	transfer = data;
}

export function clearFlowOledTransfer(): void {
	transfer = null;
}
