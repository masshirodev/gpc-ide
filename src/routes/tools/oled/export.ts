import { OLED_WIDTH, OLED_HEIGHT, type ExportFormat, type OledScene } from './types';
import { getPixel } from './pixels';

function sanitizeName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}

function exportPixelCalls(scene: OledScene): string {
	const name = sanitizeName(scene.name);
	const lines: string[] = [];
	lines.push(`function Draw_${name}() {`);
	lines.push(`    cls_oled(OLED_BLACK);`);

	for (let y = 0; y < OLED_HEIGHT; y++) {
		for (let x = 0; x < OLED_WIDTH; x++) {
			if (getPixel(scene.pixels, x, y)) {
				lines.push(`    pixel_oled(${x}, ${y}, 1);`);
			}
		}
	}

	lines.push(`}`);
	return lines.join('\n');
}

function exportPacked8Bit(scene: OledScene): string {
	const name = sanitizeName(scene.name);
	const lines: string[] = [];

	// Generate packed array
	const bytes: number[] = [];
	for (let i = 0; i < scene.pixels.length; i++) {
		bytes.push(scene.pixels[i]);
	}

	lines.push(`// ${scene.name} (${OLED_WIDTH}x${OLED_HEIGHT}, ${bytes.length} bytes)`);
	lines.push(`const int8 ${name}_data[] = {`);

	// 16 bytes per row (one pixel row = 128/8 = 16 bytes)
	for (let row = 0; row < OLED_HEIGHT; row++) {
		const offset = row * 16;
		const rowBytes = bytes.slice(offset, offset + 16);
		const hex = rowBytes.map((b) => '0x' + b.toString(16).toUpperCase().padStart(2, '0'));
		const comma = row < OLED_HEIGHT - 1 ? ',' : '';
		lines.push(`    ${hex.join(', ')}${comma}`);
	}

	lines.push(`};`);
	lines.push(``);
	lines.push(`function Draw_${name}() {`);
	lines.push(`    int i, x, y, byte_val, bit;`);
	lines.push(`    cls_oled(OLED_BLACK);`);
	lines.push(`    for(i = 0; i < ${bytes.length}; i++) {`);
	lines.push(`        byte_val = ${name}_data[i];`);
	lines.push(`        if(byte_val == 0) continue;`);
	lines.push(`        y = i / 16;`);
	lines.push(`        x = (i % 16) * 8;`);
	lines.push(`        for(bit = 7; bit >= 0; bit--) {`);
	lines.push(`            if(byte_val & (1 << bit)) {`);
	lines.push(`                pixel_oled(x + (7 - bit), y, 1);`);
	lines.push(`            }`);
	lines.push(`        }`);
	lines.push(`    }`);
	lines.push(`}`);

	return lines.join('\n');
}

function exportPacked16Bit(scene: OledScene): string {
	const name = sanitizeName(scene.name);
	const lines: string[] = [];

	// Pack into 16-bit words
	const words: number[] = [];
	for (let i = 0; i < scene.pixels.length; i += 2) {
		words.push((scene.pixels[i] << 8) | (scene.pixels[i + 1] || 0));
	}

	lines.push(`// ${scene.name} (${OLED_WIDTH}x${OLED_HEIGHT}, ${words.length} words)`);
	lines.push(`const int16 ${name}_data[] = {`);

	// 8 words per row (one pixel row = 128/16 = 8 words)
	for (let row = 0; row < OLED_HEIGHT; row++) {
		const offset = row * 8;
		const rowWords = words.slice(offset, offset + 8);
		const hex = rowWords.map((w) => '0x' + w.toString(16).toUpperCase().padStart(4, '0'));
		const comma = row < OLED_HEIGHT - 1 ? ',' : '';
		lines.push(`    ${hex.join(', ')}${comma}`);
	}

	lines.push(`};`);
	lines.push(``);
	lines.push(`function Draw_${name}() {`);
	lines.push(`    int i, x, y, word_val, bit;`);
	lines.push(`    cls_oled(OLED_BLACK);`);
	lines.push(`    for(i = 0; i < ${words.length}; i++) {`);
	lines.push(`        word_val = ${name}_data[i];`);
	lines.push(`        if(word_val == 0) continue;`);
	lines.push(`        y = i / 8;`);
	lines.push(`        x = (i % 8) * 16;`);
	lines.push(`        for(bit = 15; bit >= 0; bit--) {`);
	lines.push(`            if(word_val & (1 << bit)) {`);
	lines.push(`                pixel_oled(x + (15 - bit), y, 1);`);
	lines.push(`            }`);
	lines.push(`        }`);
	lines.push(`    }`);
	lines.push(`}`);

	return lines.join('\n');
}

export function exportScene(scene: OledScene, format: ExportFormat): string {
	switch (format) {
		case 'pixel_calls':
			return exportPixelCalls(scene);
		case 'array_8bit':
			return exportPacked8Bit(scene);
		case 'array_16bit':
			return exportPacked16Bit(scene);
	}
}

export function exportAnimation(
	scenes: OledScene[],
	format: ExportFormat,
	frameDelayMs: number
): string {
	const lines: string[] = [];

	lines.push(`// OLED Animation: ${scenes.length} scenes, ${frameDelayMs}ms delay`);
	lines.push(``);

	// Export each scene
	for (const scene of scenes) {
		lines.push(exportScene(scene, format));
		lines.push(``);
	}

	// Animation controller
	lines.push(`int oled_current_frame = 0;`);
	lines.push(`int oled_frame_timer = 0;`);
	lines.push(``);
	lines.push(`function OledAnimation() {`);
	lines.push(`    if(oled_frame_timer < ${frameDelayMs}) {`);
	lines.push(`        oled_frame_timer = oled_frame_timer + elapsed_time();`);
	lines.push(`        return;`);
	lines.push(`    }`);
	lines.push(`    oled_frame_timer = 0;`);

	for (let i = 0; i < scenes.length; i++) {
		const name = sanitizeName(scenes[i].name);
		const cond = i === 0 ? 'if' : 'else if';
		lines.push(`    ${cond}(oled_current_frame == ${i}) Draw_${name}();`);
	}

	lines.push(`    oled_current_frame = (oled_current_frame + 1) % ${scenes.length};`);
	lines.push(`}`);

	return lines.join('\n');
}
