import type { SerializedScene } from '../../routes/tools/oled/types';

export interface FlowOledTransfer {
	nodeId: string;
	scene: SerializedScene;
	returnTo: string | null; // game path
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
