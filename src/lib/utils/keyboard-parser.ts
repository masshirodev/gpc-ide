export interface KeyMapping {
	source: string;
	target: string;
	value: number;
	type: 'keyboard' | 'controller';
	enabled: boolean;
}

/**
 * Parse keyboard mappings from keyboard.gpc content.
 * Handles patterns:
 *   if (GetKeyboardKey(KEY_X)) { set_val(PS5_Y, 100); }
 *   if (get_val(BUTTON_X)) { set_val(PS5_Y, 100); }
 *   set_val(PS5_X, get_val(XB1_Y));  (not inside if)
 *   // if (...) { ... }  (commented = disabled)
 */
export function parseKeyboardMappings(content: string): KeyMapping[] {
	const mappings: KeyMapping[] = [];

	// Find the ApplyKeyboard function body
	const funcMatch = content.match(
		/function\s+ApplyKeyboard\s*\(\)\s*\{([\s\S]*?)\n\}/
	);
	if (!funcMatch) return mappings;

	const body = funcMatch[1];
	const lines = body.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Check if line is commented out
		const isCommented = trimmed.startsWith('//');
		const uncommented = isCommented ? trimmed.replace(/^\/\/\s*/, '') : trimmed;

		// Pattern 1: if (GetKeyboardKey(KEY_X)) { set_val(PS5_Y, value); }
		const kbMatch = uncommented.match(
			/if\s*\(\s*GetKeyboardKey\((\w+)\)\s*\)\s*\{\s*set_val\((\w+),\s*(-?\d+)\)\s*;\s*\}/
		);
		if (kbMatch) {
			mappings.push({
				source: kbMatch[1],
				target: kbMatch[2],
				value: parseInt(kbMatch[3], 10),
				type: 'keyboard',
				enabled: !isCommented
			});
			continue;
		}

		// Pattern 2: if (get_val(BUTTON_X)) { set_val(PS5_Y, value); }
		const mouseMatch = uncommented.match(
			/if\s*\(\s*get_val\((\w+)\)\s*\)\s*\{\s*set_val\((\w+),\s*(-?\d+)\)\s*;\s*\}/
		);
		if (mouseMatch) {
			const source = mouseMatch[1];
			mappings.push({
				source,
				target: mouseMatch[2],
				value: parseInt(mouseMatch[3], 10),
				type: 'controller',
				enabled: !isCommented
			});
			continue;
		}

		// Pattern 3: set_val(PS5_X, get_val(XB1_Y)); (controller-to-controller map)
		const mapMatch = uncommented.match(
			/set_val\((\w+),\s*get_val\((\w+)\)\)\s*;/
		);
		if (mapMatch) {
			mappings.push({
				source: mapMatch[2],
				target: mapMatch[1],
				value: 0, // map uses get_val directly
				type: 'controller',
				enabled: !isCommented
			});
			continue;
		}
	}

	return mappings;
}

/**
 * Serialize keyboard mappings back into the keyboard.gpc file content.
 * Replaces the ApplyKeyboard function body while preserving the rest of the file.
 */
export function serializeKeyboardMappings(
	originalContent: string,
	mappings: KeyMapping[]
): string {
	const funcStart = originalContent.indexOf('function ApplyKeyboard()');
	if (funcStart === -1) return originalContent;

	const braceStart = originalContent.indexOf('{', funcStart);
	if (braceStart === -1) return originalContent;

	// Find the matching closing brace
	let depth = 1;
	let braceEnd = braceStart + 1;
	while (braceEnd < originalContent.length && depth > 0) {
		if (originalContent[braceEnd] === '{') depth++;
		if (originalContent[braceEnd] === '}') depth--;
		braceEnd++;
	}

	const header = originalContent.substring(0, braceStart + 1);
	const footer = originalContent.substring(braceEnd - 1);

	// Build body
	const lines: string[] = [];

	// Group mappings by type for readability
	const kbMappings = mappings.filter((m) => m.type === 'keyboard');
	const ctrlMappings = mappings.filter((m) => m.type === 'controller');

	if (kbMappings.length > 0) {
		lines.push('    // Keyboard mappings');
		for (const m of kbMappings) {
			const code = `    if (GetKeyboardKey(${m.source})) { set_val(${m.target}, ${m.value}); }`;
			lines.push(m.enabled ? code : `    // ${code.trim()}`);
		}
	}

	if (ctrlMappings.length > 0) {
		if (lines.length > 0) lines.push('');
		lines.push('    // Controller mappings');
		for (const m of ctrlMappings) {
			let code: string;
			if (m.value === 0) {
				// Map syntax: set_val(target, get_val(source));
				code = `    set_val(${m.target}, get_val(${m.source}));`;
			} else {
				code = `    if (get_val(${m.source})) { set_val(${m.target}, ${m.value}); }`;
			}
			lines.push(m.enabled ? code : `    // ${code.trim()}`);
		}
	}

	if (lines.length === 0) {
		lines.push('    // No mappings configured');
	}

	return header + '\n' + lines.join('\n') + '\n' + footer;
}

/**
 * Add a new mapping or update an existing one for the same target.
 */
export function upsertMapping(
	mappings: KeyMapping[],
	newMapping: KeyMapping
): KeyMapping[] {
	const idx = mappings.findIndex((m) => m.target === newMapping.target && m.value === newMapping.value);
	if (idx >= 0) {
		return mappings.map((m, i) => (i === idx ? newMapping : m));
	}
	return [...mappings, newMapping];
}

/**
 * Remove a mapping by index.
 */
export function removeMapping(mappings: KeyMapping[], index: number): KeyMapping[] {
	return mappings.filter((_, i) => i !== index);
}

/**
 * Toggle a mapping's enabled state.
 */
export function toggleMapping(mappings: KeyMapping[], index: number): KeyMapping[] {
	return mappings.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m));
}
