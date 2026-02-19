export interface ComboTransfer {
	comboName: string;
	gpcCode: string;
	returnTo: string | null; // game path to write combo file into
}

let transfer = $state<ComboTransfer | null>(null);

export function getComboTransfer(): ComboTransfer | null {
	return transfer;
}

export function setComboTransfer(data: ComboTransfer): void {
	transfer = data;
}

export function clearComboTransfer(): void {
	transfer = null;
}
