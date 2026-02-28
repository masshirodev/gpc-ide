export interface SpriteFrame {
	id: string;
	pixels: string; // Base64-encoded packed bytes (8px/byte, MSB-first, row-major)
	width: number;
	height: number;
}

export interface SpriteCollection {
	version: 1;
	id: string;
	name: string;
	frames: SpriteFrame[];
	createdAt: string;
	updatedAt: string;
}

export interface SpriteCollectionSummary {
	id: string;
	name: string;
	frame_count: number;
	frame_width: number;
	frame_height: number;
	updated_at: string;
}
