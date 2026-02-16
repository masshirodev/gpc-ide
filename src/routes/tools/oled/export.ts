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

	const bytes: number[] = [];
	for (let i = 0; i < scene.pixels.length; i++) {
		bytes.push(scene.pixels[i]);
	}

	// Global variables for the draw function
	lines.push(`int _oled_i, _oled_x, _oled_y, _oled_bv, _oled_bit;`);
	lines.push(``);
	lines.push(`// ${scene.name} (${OLED_WIDTH}x${OLED_HEIGHT}, ${bytes.length} bytes)`);
	lines.push(`const int8 ${name}_data[] = {`);

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
	lines.push(`    cls_oled(OLED_BLACK);`);
	lines.push(`    for(_oled_i = 0; _oled_i < ${bytes.length}; _oled_i++) {`);
	lines.push(`        _oled_bv = ${name}_data[_oled_i];`);
	lines.push(`        if(_oled_bv == 0) continue;`);
	lines.push(`        _oled_y = _oled_i / 16;`);
	lines.push(`        _oled_x = (_oled_i % 16) * 8;`);
	lines.push(`        for(_oled_bit = 7; _oled_bit >= 0; _oled_bit--) {`);
	lines.push(`            if(_oled_bv & (1 << _oled_bit)) {`);
	lines.push(`                pixel_oled(_oled_x + (7 - _oled_bit), _oled_y, 1);`);
	lines.push(`            }`);
	lines.push(`        }`);
	lines.push(`    }`);
	lines.push(`}`);

	return lines.join('\n');
}

function exportPacked16Bit(scene: OledScene): string {
	const name = sanitizeName(scene.name);
	const lines: string[] = [];

	const words: number[] = [];
	for (let i = 0; i < scene.pixels.length; i += 2) {
		words.push((scene.pixels[i] << 8) | (scene.pixels[i + 1] || 0));
	}

	// Global variables for the draw function
	lines.push(`int _oled_i, _oled_x, _oled_y, _oled_wv, _oled_bit;`);
	lines.push(``);
	lines.push(`// ${scene.name} (${OLED_WIDTH}x${OLED_HEIGHT}, ${words.length} words)`);
	lines.push(`const int16 ${name}_data[] = {`);

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
	lines.push(`    cls_oled(OLED_BLACK);`);
	lines.push(`    for(_oled_i = 0; _oled_i < ${words.length}; _oled_i++) {`);
	lines.push(`        _oled_wv = ${name}_data[_oled_i];`);
	lines.push(`        if(_oled_wv == 0) continue;`);
	lines.push(`        _oled_y = _oled_i / 8;`);
	lines.push(`        _oled_x = (_oled_i % 8) * 16;`);
	lines.push(`        for(_oled_bit = 15; _oled_bit >= 0; _oled_bit--) {`);
	lines.push(`            if(_oled_wv & (1 << _oled_bit)) {`);
	lines.push(`                pixel_oled(_oled_x + (15 - _oled_bit), _oled_y, 1);`);
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

function exportAnimation8Bit(scenes: OledScene[], frameDelayMs: number): string {
	const lines: string[] = [];
	const bytesPerScene = scenes[0].pixels.length;

	lines.push(`// OLED Animation: ${scenes.length} scenes, ${frameDelayMs}ms delay`);
	lines.push(`int _oled_i, _oled_x, _oled_y, _oled_bv, _oled_bit;`);
	lines.push(`int oled_current_frame = 0;`);
	lines.push(`int oled_frame_timer = ${frameDelayMs};`);
	lines.push(``);
	lines.push(`// ${scenes.length} scenes x ${bytesPerScene} bytes each`);
	lines.push(`const int8 oled_scenes[][] = {`);

	for (let s = 0; s < scenes.length; s++) {
		const bytes = Array.from(scenes[s].pixels);
		const hex = bytes.map((b) => '0x' + b.toString(16).toUpperCase().padStart(2, '0'));
		const comma = s < scenes.length - 1 ? ',' : '';

		lines.push(`    // ${scenes[s].name}`);
		lines.push(`    {`);
		for (let row = 0; row < OLED_HEIGHT; row++) {
			const offset = row * 16;
			const rowHex = hex.slice(offset, offset + 16);
			const rowComma = row < OLED_HEIGHT - 1 ? ',' : '';
			lines.push(`        ${rowHex.join(', ')}${rowComma}`);
		}
		lines.push(`    }${comma}`);
	}

	lines.push(`};`);
	lines.push(``);
	lines.push(`function DrawOledFrame() {`);
	lines.push(`    cls_oled(OLED_BLACK);`);
	lines.push(`    for(_oled_i = 0; _oled_i < ${bytesPerScene}; _oled_i++) {`);
	lines.push(`        _oled_bv = oled_scenes[oled_current_frame][_oled_i];`);
	lines.push(`        if(_oled_bv == 0) continue;`);
	lines.push(`        _oled_y = _oled_i / 16;`);
	lines.push(`        _oled_x = (_oled_i % 16) * 8;`);
	lines.push(`        for(_oled_bit = 7; _oled_bit >= 0; _oled_bit--) {`);
	lines.push(`            if(_oled_bv & (1 << _oled_bit)) {`);
	lines.push(`                pixel_oled(_oled_x + (7 - _oled_bit), _oled_y, 1);`);
	lines.push(`            }`);
	lines.push(`        }`);
	lines.push(`    }`);
	lines.push(`}`);
	lines.push(``);
	lines.push(`function OledAnimation() {`);
	lines.push(`    if(oled_frame_timer < ${frameDelayMs}) {`);
	lines.push(`        oled_frame_timer = oled_frame_timer + get_rtime();`);
	lines.push(`        return;`);
	lines.push(`    }`);
	lines.push(`    oled_frame_timer = 0;`);
	lines.push(`    DrawOledFrame();`);
	lines.push(`    oled_current_frame = (oled_current_frame + 1) % ${scenes.length};`);
	lines.push(`}`);

	return lines.join('\n');
}

function exportAnimation16Bit(scenes: OledScene[], frameDelayMs: number): string {
	const lines: string[] = [];
	const wordsPerScene = scenes[0].pixels.length / 2;

	lines.push(`// OLED Animation: ${scenes.length} scenes, ${frameDelayMs}ms delay`);
	lines.push(`int _oled_i, _oled_x, _oled_y, _oled_wv, _oled_bit;`);
	lines.push(`int oled_current_frame = 0;`);
	lines.push(`int oled_frame_timer = ${frameDelayMs};`);
	lines.push(``);
	lines.push(`// ${scenes.length} scenes x ${wordsPerScene} words each`);
	lines.push(`const int16 oled_scenes[][] = {`);

	for (let s = 0; s < scenes.length; s++) {
		const words: number[] = [];
		for (let i = 0; i < scenes[s].pixels.length; i += 2) {
			words.push((scenes[s].pixels[i] << 8) | (scenes[s].pixels[i + 1] || 0));
		}
		const hex = words.map((w) => '0x' + w.toString(16).toUpperCase().padStart(4, '0'));
		const comma = s < scenes.length - 1 ? ',' : '';

		lines.push(`    // ${scenes[s].name}`);
		lines.push(`    {`);
		for (let row = 0; row < OLED_HEIGHT; row++) {
			const offset = row * 8;
			const rowHex = hex.slice(offset, offset + 8);
			const rowComma = row < OLED_HEIGHT - 1 ? ',' : '';
			lines.push(`        ${rowHex.join(', ')}${rowComma}`);
		}
		lines.push(`    }${comma}`);
	}

	lines.push(`};`);
	lines.push(``);
	lines.push(`function DrawOledFrame() {`);
	lines.push(`    cls_oled(OLED_BLACK);`);
	lines.push(`    for(_oled_i = 0; _oled_i < ${wordsPerScene}; _oled_i++) {`);
	lines.push(`        _oled_wv = oled_scenes[oled_current_frame][_oled_i];`);
	lines.push(`        if(_oled_wv == 0) continue;`);
	lines.push(`        _oled_y = _oled_i / 8;`);
	lines.push(`        _oled_x = (_oled_i % 8) * 16;`);
	lines.push(`        for(_oled_bit = 15; _oled_bit >= 0; _oled_bit--) {`);
	lines.push(`            if(_oled_wv & (1 << _oled_bit)) {`);
	lines.push(`                pixel_oled(_oled_x + (15 - _oled_bit), _oled_y, 1);`);
	lines.push(`            }`);
	lines.push(`        }`);
	lines.push(`    }`);
	lines.push(`}`);
	lines.push(``);
	lines.push(`function OledAnimation() {`);
	lines.push(`    if(oled_frame_timer < ${frameDelayMs}) {`);
	lines.push(`        oled_frame_timer = oled_frame_timer + get_rtime();`);
	lines.push(`        return;`);
	lines.push(`    }`);
	lines.push(`    oled_frame_timer = 0;`);
	lines.push(`    DrawOledFrame();`);
	lines.push(`    oled_current_frame = (oled_current_frame + 1) % ${scenes.length};`);
	lines.push(`}`);

	return lines.join('\n');
}

function exportAnimationPixelCalls(scenes: OledScene[], frameDelayMs: number): string {
	const lines: string[] = [];

	lines.push(`// OLED Animation: ${scenes.length} scenes, ${frameDelayMs}ms delay`);
	lines.push(``);

	for (const scene of scenes) {
		lines.push(exportPixelCalls(scene));
		lines.push(``);
	}

	lines.push(`int oled_current_frame = 0;`);
	lines.push(`int oled_frame_timer = ${frameDelayMs};`);
	lines.push(``);
	lines.push(`function OledAnimation() {`);
	lines.push(`    if(oled_frame_timer < ${frameDelayMs}) {`);
	lines.push(`        oled_frame_timer = oled_frame_timer + get_rtime();`);
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

export function exportAnimation(
	scenes: OledScene[],
	format: ExportFormat,
	frameDelayMs: number
): string {
	switch (format) {
		case 'pixel_calls':
			return exportAnimationPixelCalls(scenes, frameDelayMs);
		case 'array_8bit':
			return exportAnimation8Bit(scenes, frameDelayMs);
		case 'array_16bit':
			return exportAnimation16Bit(scenes, frameDelayMs);
	}
}
