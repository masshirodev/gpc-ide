import type { SerializedScene } from '../../routes/tools/oled/types';

export interface FlowOledTransfer {
	nodeId: string;
	subNodeId?: string;
	scene: SerializedScene;
	returnTo: string | null; // game path
	returnPath?: string; // route to navigate back to (e.g. '/' for flow tab, '/tools/flow' for standalone)
	/** Base64-encoded pixel buffers from other pixel-art subnodes in the same node (for overlay preview) */
	overlayPixels?: string[];
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
