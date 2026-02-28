import type { CustomFont } from '../../routes/tools/oled/fonts-custom';

let transfer = $state<CustomFont | null>(null);

export function getFontTransfer(): CustomFont | null {
	return transfer;
}

export function setFontTransfer(data: CustomFont): void {
	transfer = data;
}

export function clearFontTransfer(): void {
	transfer = null;
}
