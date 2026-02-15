import { clonePixels } from './pixels';

export class PixelHistory {
	private undoStack: Uint8Array[] = [];
	private redoStack: Uint8Array[] = [];
	private maxSize = 100;

	push(pixels: Uint8Array): void {
		this.undoStack.push(clonePixels(pixels));
		if (this.undoStack.length > this.maxSize) {
			this.undoStack.shift();
		}
		this.redoStack = [];
	}

	undo(current: Uint8Array): Uint8Array | null {
		if (this.undoStack.length === 0) return null;
		this.redoStack.push(clonePixels(current));
		return this.undoStack.pop()!;
	}

	redo(current: Uint8Array): Uint8Array | null {
		if (this.redoStack.length === 0) return null;
		this.undoStack.push(clonePixels(current));
		return this.redoStack.pop()!;
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
	}
}
