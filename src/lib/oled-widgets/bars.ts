import type { OledWidgetDef } from './types';
import { widgetSetPixel, widgetDrawRect } from './types';

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

function fillWidth(value: number, totalWidth: number): number {
	return Math.round(clamp(value, 0, 100) / 100 * (totalWidth - 2));
}

export const recessedBar: OledWidgetDef = {
	id: 'bar-recessed',
	name: 'Recessed Bar',
	category: 'bar',
	description: '3D-style inset bar with border and fill',
	width: 60,
	height: 8,
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 60, min: 20, max: 120 },
		{ key: 'height', label: 'Height', type: 'number', default: 8, min: 4, max: 20 },
	],
	render(config, value, pixels, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		// Outer border
		widgetDrawRect(pixels, x, y, x + w - 1, y + h - 1, false);
		// Inner recess (1px inset, darker = no pixels)
		// Fill based on value
		const fw = fillWidth(value, w);
		if (fw > 0) {
			widgetDrawRect(pixels, x + 2, y + 2, x + 2 + fw - 1, y + h - 3, true);
		}
	},
	generateGpc(config, varName, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		return [
			`    // Recessed Bar for ${varName}`,
			`    rect_oled(${x}, ${y}, ${x + w - 1}, ${y + h - 1}, OLED_WHITE);`,
			`    if(${varName} > 0) {`,
			`        rect_oled(${x + 2}, ${y + 2}, ${x + 2} + (${varName} * ${w - 4} / 100), ${y + h - 3}, OLED_WHITE);`,
			`    }`,
		].join('\n');
	},
};

export const gradientBar: OledWidgetDef = {
	id: 'bar-gradient',
	name: 'Gradient Fill Bar',
	category: 'bar',
	description: 'Stippled pixel pattern simulating gradient on 1-bit display',
	width: 60,
	height: 8,
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 60, min: 20, max: 120 },
		{ key: 'height', label: 'Height', type: 'number', default: 8, min: 4, max: 20 },
	],
	render(config, value, pixels, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		widgetDrawRect(pixels, x, y, x + w - 1, y + h - 1, false);
		const fw = fillWidth(value, w);
		for (let py = y + 1; py < y + h - 1; py++) {
			for (let px = x + 1; px < x + 1 + fw; px++) {
				// Checkerboard dithering for gradient effect
				const density = (px - x) / fw;
				if (density < 0.5 || (px + py) % 2 === 0) {
					widgetSetPixel(pixels, px, py);
				}
			}
		}
	},
	generateGpc(config, varName, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		return [
			`    // Gradient Bar for ${varName}`,
			`    rect_oled(${x}, ${y}, ${x + w - 1}, ${y + h - 1}, OLED_WHITE);`,
			`    _oled_fw = ${varName} * ${w - 2} / 100;`,
			`    for(_oled_py = ${y + 1}; _oled_py < ${y + h - 1}; _oled_py++) {`,
			`        for(_oled_px = ${x + 1}; _oled_px < ${x + 1} + _oled_fw; _oled_px++) {`,
			`            if((_oled_px + _oled_py) % 2 == 0 || _oled_px - ${x} < _oled_fw / 2) pixel_oled(_oled_px, _oled_py, 1);`,
			`        }`,
			`    }`,
		].join('\n');
	},
};

export const chunkyRetroBar: OledWidgetDef = {
	id: 'bar-chunky',
	name: 'Chunky Retro Bar',
	category: 'bar',
	description: 'Large pixel block segments for a retro look',
	width: 60,
	height: 8,
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 60, min: 20, max: 120 },
		{ key: 'height', label: 'Height', type: 'number', default: 8, min: 4, max: 20 },
		{ key: 'segments', label: 'Segments', type: 'number', default: 10, min: 3, max: 20 },
	],
	render(config, value, pixels, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		const segs = (config.segments as number) || 10;
		const segW = Math.floor((w - 2) / segs);
		const filledSegs = Math.round((value / 100) * segs);
		widgetDrawRect(pixels, x, y, x + w - 1, y + h - 1, false);
		for (let s = 0; s < filledSegs; s++) {
			const sx = x + 2 + s * segW;
			widgetDrawRect(pixels, sx, y + 2, sx + segW - 2, y + h - 3, true);
		}
	},
	generateGpc(config, varName, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		const segs = (config.segments as number) || 10;
		const segW = Math.floor((w - 2) / segs);
		return [
			`    // Chunky Retro Bar for ${varName}`,
			`    rect_oled(${x}, ${y}, ${x + w - 1}, ${y + h - 1}, OLED_WHITE);`,
			`    _oled_segs = ${varName} * ${segs} / 100;`,
			`    for(_oled_i = 0; _oled_i < _oled_segs; _oled_i++) {`,
			`        rect_oled(${x + 2} + _oled_i * ${segW}, ${y + 2}, ${x + 2} + _oled_i * ${segW} + ${segW - 2}, ${y + h - 3}, OLED_WHITE);`,
			`    }`,
		].join('\n');
	},
};

export const notchedBar: OledWidgetDef = {
	id: 'bar-notched',
	name: 'Notched / Stepped Bar',
	category: 'bar',
	description: 'Discrete step markers showing exact level',
	width: 60,
	height: 8,
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 60, min: 20, max: 120 },
		{ key: 'height', label: 'Height', type: 'number', default: 8, min: 4, max: 20 },
		{ key: 'steps', label: 'Steps', type: 'number', default: 5, min: 2, max: 20 },
	],
	render(config, value, pixels, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		const steps = (config.steps as number) || 5;
		const stepW = Math.floor(w / steps);
		const filledSteps = Math.round((value / 100) * steps);

		for (let s = 0; s < steps; s++) {
			const sx = x + s * stepW;
			if (s < filledSteps) {
				widgetDrawRect(pixels, sx, y, sx + stepW - 2, y + h - 1, true);
			} else {
				widgetDrawRect(pixels, sx, y, sx + stepW - 2, y + h - 1, false);
			}
		}
	},
	generateGpc(config, varName, x, y) {
		const w = (config.width as number) || 60;
		const h = (config.height as number) || 8;
		const steps = (config.steps as number) || 5;
		const stepW = Math.floor(w / steps);
		return [
			`    // Notched Bar for ${varName}`,
			`    _oled_filled = ${varName} * ${steps} / 100;`,
			`    for(_oled_i = 0; _oled_i < ${steps}; _oled_i++) {`,
			`        _oled_sx = ${x} + _oled_i * ${stepW};`,
			`        if(_oled_i < _oled_filled) {`,
			`            rect_oled(_oled_sx, ${y}, _oled_sx + ${stepW - 2}, ${y + h - 1}, OLED_WHITE);`,
			`        } else {`,
			`            line_oled(_oled_sx, ${y}, _oled_sx + ${stepW - 2}, ${y}, OLED_WHITE);`,
			`            line_oled(_oled_sx, ${y + h - 1}, _oled_sx + ${stepW - 2}, ${y + h - 1}, OLED_WHITE);`,
			`            line_oled(_oled_sx, ${y}, _oled_sx, ${y + h - 1}, OLED_WHITE);`,
			`            line_oled(_oled_sx + ${stepW - 2}, ${y}, _oled_sx + ${stepW - 2}, ${y + h - 1}, OLED_WHITE);`,
			`        }`,
			`    }`,
		].join('\n');
	},
};

export const cellSignal: OledWidgetDef = {
	id: 'indicator-cell-signal',
	name: 'Cell Signal',
	category: 'indicator',
	description: 'Signal strength indicator (1-5 bars, increasing height)',
	width: 20,
	height: 12,
	params: [
		{ key: 'bars', label: 'Max Bars', type: 'number', default: 5, min: 3, max: 7 },
	],
	render(config, value, pixels, x, y) {
		const bars = (config.bars as number) || 5;
		const filledBars = Math.round((value / 100) * bars);
		const barW = 3;
		const gap = 1;
		const maxH = 12;

		for (let b = 0; b < bars; b++) {
			const bh = Math.round(((b + 1) / bars) * maxH);
			const bx = x + b * (barW + gap);
			const by = y + maxH - bh;
			if (b < filledBars) {
				widgetDrawRect(pixels, bx, by, bx + barW - 1, y + maxH - 1, true);
			} else {
				widgetDrawRect(pixels, bx, by, bx + barW - 1, y + maxH - 1, false);
			}
		}
	},
	generateGpc(config, varName, x, y) {
		const bars = (config.bars as number) || 5;
		const barW = 3;
		const gap = 1;
		const maxH = 12;
		const lines: string[] = [`    // Cell Signal for ${varName}`];
		lines.push(`    _oled_filled = ${varName} * ${bars} / 100;`);
		for (let b = 0; b < bars; b++) {
			const bh = Math.round(((b + 1) / bars) * maxH);
			const bx = x + b * (barW + gap);
			const by = y + maxH - bh;
			lines.push(`    if(_oled_filled > ${b}) rect_oled(${bx}, ${by}, ${bx + barW - 1}, ${y + maxH - 1}, OLED_WHITE);`);
			lines.push(`    else { line_oled(${bx}, ${by}, ${bx + barW - 1}, ${by}, OLED_WHITE); line_oled(${bx}, ${by}, ${bx}, ${y + maxH - 1}, OLED_WHITE); line_oled(${bx + barW - 1}, ${by}, ${bx + barW - 1}, ${y + maxH - 1}, OLED_WHITE); line_oled(${bx}, ${y + maxH - 1}, ${bx + barW - 1}, ${y + maxH - 1}, OLED_WHITE); }`);
		}
		return lines.join('\n');
	},
};

export const ledStrip: OledWidgetDef = {
	id: 'indicator-led-strip',
	name: 'LED Strip',
	category: 'indicator',
	description: 'Individual LED-style dots in a row',
	width: 60,
	height: 6,
	params: [
		{ key: 'leds', label: 'LED Count', type: 'number', default: 10, min: 3, max: 20 },
		{ key: 'radius', label: 'Dot Radius', type: 'number', default: 2, min: 1, max: 4 },
	],
	render(config, value, pixels, x, y) {
		const leds = (config.leds as number) || 10;
		const r = (config.radius as number) || 2;
		const filledLeds = Math.round((value / 100) * leds);
		const spacing = (r * 2 + 2);

		for (let i = 0; i < leds; i++) {
			const cx = x + r + i * spacing;
			const cy = y + r;
			if (i < filledLeds) {
				// Filled circle
				for (let dy = -r; dy <= r; dy++) {
					for (let dx = -r; dx <= r; dx++) {
						if (dx * dx + dy * dy <= r * r) {
							widgetSetPixel(pixels, cx + dx, cy + dy);
						}
					}
				}
			} else {
				// Outline circle
				for (let a = 0; a < 360; a += 15) {
					const dx = Math.round(r * Math.cos((a * Math.PI) / 180));
					const dy = Math.round(r * Math.sin((a * Math.PI) / 180));
					widgetSetPixel(pixels, cx + dx, cy + dy);
				}
			}
		}
	},
	generateGpc(config, varName, x, y) {
		const leds = (config.leds as number) || 10;
		const r = (config.radius as number) || 2;
		const spacing = r * 2 + 2;
		return [
			`    // LED Strip for ${varName}`,
			`    _oled_filled = ${varName} * ${leds} / 100;`,
			`    for(_oled_i = 0; _oled_i < ${leds}; _oled_i++) {`,
			`        _oled_cx = ${x + r} + _oled_i * ${spacing};`,
			`        if(_oled_i < _oled_filled) {`,
			`            rect_oled(_oled_cx - ${r}, ${y}, _oled_cx + ${r}, ${y + r * 2}, OLED_WHITE);`,
			`        } else {`,
			`            pixel_oled(_oled_cx, ${y}, 1);`,
			`            pixel_oled(_oled_cx, ${y + r * 2}, 1);`,
			`            pixel_oled(_oled_cx - ${r}, ${y + r}, 1);`,
			`            pixel_oled(_oled_cx + ${r}, ${y + r}, 1);`,
			`        }`,
			`    }`,
		].join('\n');
	},
};

export const diagnosticBar: OledWidgetDef = {
	id: 'diagnostic-bar',
	name: 'Diagnostic Bar',
	category: 'diagnostic',
	description: 'Uni-directional diagnostic bar with value label',
	width: 80,
	height: 10,
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 80, min: 30, max: 120 },
		{ key: 'showValue', label: 'Show Value', type: 'boolean', default: true },
	],
	render(config, value, pixels, x, y) {
		const w = (config.width as number) || 80;
		// Bar area
		widgetDrawRect(pixels, x, y + 2, x + w - 20, y + 9, false);
		const fw = Math.round((value / 100) * (w - 22));
		if (fw > 0) {
			widgetDrawRect(pixels, x + 1, y + 3, x + 1 + fw, y + 8, true);
		}
	},
	generateGpc(config, varName, x, y) {
		const w = (config.width as number) || 80;
		const showValue = (config.showValue as boolean) !== false;
		const lines = [
			`    // Diagnostic Bar for ${varName}`,
			`    rect_oled(${x}, ${y + 2}, ${x + w - 20}, ${y + 9}, OLED_WHITE);`,
			`    if(${varName} > 0) rect_oled(${x + 1}, ${y + 3}, ${x + 1} + ${varName} * ${w - 22} / 100, ${y + 8}, OLED_WHITE);`,
		];
		if (showValue) {
			lines.push(`    PrintNumber(${x + w - 16}, ${y + 2}, OLED_FONT_SMALL, OLED_WHITE, ${varName});`);
		}
		return lines.join('\n');
	},
};

export const biDiagnosticBar: OledWidgetDef = {
	id: 'diagnostic-bidir',
	name: 'Bi-Directional Bar',
	category: 'diagnostic',
	description: 'Bi-directional bar with center line, fills left or right from center',
	width: 80,
	height: 10,
	params: [
		{ key: 'width', label: 'Width', type: 'number', default: 80, min: 30, max: 120 },
	],
	render(config, value, pixels, x, y) {
		const w = (config.width as number) || 80;
		const center = Math.floor(w / 2);
		// Frame
		widgetDrawRect(pixels, x, y + 2, x + w - 1, y + 9, false);
		// Center line
		for (let py = y + 2; py <= y + 9; py++) {
			widgetSetPixel(pixels, x + center, py);
		}
		// Fill — value 0-100 maps to -50 to +50
		const offset = Math.round(((value - 50) / 50) * (center - 2));
		if (offset > 0) {
			widgetDrawRect(pixels, x + center + 1, y + 3, x + center + offset, y + 8, true);
		} else if (offset < 0) {
			widgetDrawRect(pixels, x + center + offset, y + 3, x + center - 1, y + 8, true);
		}
	},
	generateGpc(config, varName, x, y) {
		const w = (config.width as number) || 80;
		const center = Math.floor(w / 2);
		return [
			`    // Bi-Directional Bar for ${varName}`,
			`    rect_oled(${x}, ${y + 2}, ${x + w - 1}, ${y + 9}, OLED_WHITE);`,
			`    line_oled(${x + center}, ${y + 2}, ${x + center}, ${y + 9}, OLED_WHITE);`,
			`    _oled_offset = (${varName} - 50) * ${center - 2} / 50;`,
			`    if(_oled_offset > 0) rect_oled(${x + center + 1}, ${y + 3}, ${x + center} + _oled_offset, ${y + 8}, OLED_WHITE);`,
			`    if(_oled_offset < 0) rect_oled(${x + center} + _oled_offset, ${y + 3}, ${x + center - 1}, ${y + 8}, OLED_WHITE);`,
		].join('\n');
	},
};

export const equalizerBar: OledWidgetDef = {
	id: 'bar-equalizer',
	name: 'Equalizer',
	category: 'bar',
	description: 'Multiple vertical bars side by side, like an audio equalizer',
	width: 40,
	height: 16,
	params: [
		{ key: 'bars', label: 'Bar Count', type: 'number', default: 5, min: 3, max: 10 },
		{ key: 'height', label: 'Height', type: 'number', default: 16, min: 8, max: 32 },
	],
	render(config, value, pixels, x, y) {
		const bars = (config.bars as number) || 5;
		const h = (config.height as number) || 16;
		const barW = 3;
		const gap = 2;
		// Simulate different bar heights based on value
		for (let b = 0; b < bars; b++) {
			const bx = x + b * (barW + gap);
			const bh = Math.round((value / 100) * h * (0.5 + 0.5 * Math.sin(b * 1.2)));
			const by = y + h - bh;
			if (bh > 0) {
				widgetDrawRect(pixels, bx, by, bx + barW - 1, y + h - 1, true);
			}
		}
	},
	generateGpc(config, varName, x, y) {
		const bars = (config.bars as number) || 5;
		const h = (config.height as number) || 16;
		const barW = 3;
		const gap = 2;
		return [
			`    // Equalizer for ${varName} (simplified — single value)`,
			`    for(_oled_i = 0; _oled_i < ${bars}; _oled_i++) {`,
			`        _oled_bx = ${x} + _oled_i * ${barW + gap};`,
			`        _oled_bh = ${varName} * ${h} / 100;`,
			`        if(_oled_bh > 0) rect_oled(_oled_bx, ${y + h} - _oled_bh, _oled_bx + ${barW - 1}, ${y + h - 1}, OLED_WHITE);`,
			`    }`,
		].join('\n');
	},
};
