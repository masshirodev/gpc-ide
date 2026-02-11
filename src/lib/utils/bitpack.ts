import type { GameConfig, MenuItem, MenuOption } from '$lib/types/config';

// ==================== Types ====================

export interface BitVariable {
	varName: string;
	varAccess: string;
	menuItemName: string;
	profileIndex: number | null;
	min: number;
	max: number;
	default: number;
	bitWidth: number;
	bitOffset: number;
}

export interface BitLayout {
	marker: { bitOffset: 0; bitWidth: 1 };
	variables: BitVariable[];
	totalBits: number;
	slotsUsed: number;
	maxSlots: number;
}

// ==================== Layout Analysis ====================

/**
 * Calculate minimum bits needed to represent a value range.
 * Must match Pipeline/generate.py calculate_bit_width() exactly.
 */
export function calculateBitWidth(min: number, max: number): number {
	const range = max - min + 1;
	let bits = 0;
	while ((1 << bits) < range) bits++;
	return bits;
}

/**
 * Analyze a game config and produce the full bit-packing layout.
 * Must match Pipeline/generate.py _analyze_modules() + _analyze_item_persistence().
 */
export function analyzeBitLayout(config: GameConfig): BitLayout {
	const profileCount = config.profile_count ?? 0;
	let bitOffset = 1; // Bit 0 is data-exists marker
	const variables: BitVariable[] = [];

	for (const item of config.menu) {
		if (item.type === 'data') continue;

		if (item.type === 'clickable') {
			for (const opt of item.options ?? []) {
				const vars = analyzeItemPersistence(opt, item.name, profileCount);
				for (const v of vars) {
					variables.push({ ...v, bitOffset });
					bitOffset += v.bitWidth;
				}
			}
		} else if (item.type === 'selector') {
			const items = item.items ?? [];
			const max = (Array.isArray(items[0]) ? 0 : items.length) - 1;
			const vars = analyzeItemPersistence(
				{ ...item, min: 0, max: Math.max(max, 0) },
				item.name,
				profileCount
			);
			for (const v of vars) {
				variables.push({ ...v, bitOffset });
				bitOffset += v.bitWidth;
			}
		} else if (item.type === 'dependent_selector') {
			const groups = (item.items ?? [[]]) as string[][];
			const maxCount = Math.max(...groups.map((g) => g.length), 1);
			const vars = analyzeItemPersistence(
				{ ...item, min: 0, max: maxCount - 1 },
				item.name,
				profileCount
			);
			for (const v of vars) {
				variables.push({ ...v, bitOffset });
				bitOffset += v.bitWidth;
			}
		} else if (item.type === 'custom' && item.var && item.min != null && item.max != null) {
			const vars = analyzeItemPersistence(item, item.name, profileCount);
			for (const v of vars) {
				variables.push({ ...v, bitOffset });
				bitOffset += v.bitWidth;
			}
		} else if (item.type === 'value' || item.type === 'toggle') {
			const vars = analyzeItemPersistence(item, item.name, profileCount);
			for (const v of vars) {
				variables.push({ ...v, bitOffset });
				bitOffset += v.bitWidth;
			}
		}
	}

	const totalBits = bitOffset; // includes marker
	return {
		marker: { bitOffset: 0, bitWidth: 1 },
		variables,
		totalBits,
		slotsUsed: Math.ceil(totalBits / 32),
		maxSlots: 64
	};
}

/**
 * Analyze persistence for a single item/option.
 * Returns one BitVariable per profile slot (or one if not profile-aware).
 */
function analyzeItemPersistence(
	item: MenuItem | MenuOption,
	menuItemName: string,
	profileCount: number
): Omit<BitVariable, 'bitOffset'>[] {
	const varName = item.var ?? sanitizeVarName(item.name);
	const profileAware = 'profile_aware' in item ? !!(item as MenuItem).profile_aware : false;
	const defaultVal = typeof item.default === 'number' ? item.default : 0;

	let min: number, max: number;
	if (item.type === 'toggle') {
		min = 0;
		max = 1;
	} else {
		min = item.min ?? 0;
		max = item.max ?? 100;
	}

	const bitWidth = calculateBitWidth(min, max);
	const result: Omit<BitVariable, 'bitOffset'>[] = [];

	if (profileAware && profileCount > 0) {
		for (let p = 0; p < profileCount; p++) {
			result.push({
				varName,
				varAccess: `${varName}[${p}]`,
				menuItemName,
				profileIndex: p,
				min,
				max,
				default: defaultVal,
				bitWidth
			});
		}
	} else {
		result.push({
			varName,
			varAccess: varName,
			menuItemName,
			profileIndex: null,
			min,
			max,
			default: defaultVal,
			bitWidth
		});
	}

	return result;
}

function sanitizeVarName(name: string): string {
	return name.replace(/[\s()[\]]/g, '');
}

// ==================== SPVAR Decode/Encode ====================

// GPC sign-magnitude helpers (match _bp_pack_i / _bp_unpack_i in bitpack.gpc)

function bpBitCount(val1: number, val2: number): number {
	let bits = Math.max(bitLength(Math.abs(val1)), bitLength(Math.abs(val2)));
	if (val1 < 0 || val2 < 0) bits++; // sign bit
	return bits;
}

function bitLength(val: number): number {
	let bits = 0;
	val = Math.abs(val);
	while (val) {
		bits++;
		val = val >>> 1;
	}
	return bits;
}

function makeFullMask(bits: number): number {
	if (bits === 32) return 0xffffffff;
	return ((1 << bits) - 1) >>> 0;
}

function makeSign(bits: number): number {
	return (1 << Math.max(bits - 1, 0)) >>> 0;
}

function makeSignMask(bits: number): number {
	return makeFullMask(bits - 1);
}

function packSigned(val: number, bits: number): number {
	if (val < 0) {
		return ((Math.abs(val) & makeSignMask(bits)) | makeSign(bits)) >>> 0;
	}
	return (val & makeSignMask(bits)) >>> 0;
}

function unpackSigned(val: number, bits: number): number {
	if (val & makeSign(bits)) {
		return -(val & makeSignMask(bits));
	}
	return val & makeSignMask(bits);
}

/**
 * Decode raw SPVAR slot values into variable values.
 * Matches read_spvar() logic from Common/bitpack.gpc.
 *
 * @param layout - The bit layout from analyzeBitLayout()
 * @param slotValues - Array of raw 32-bit values, index 0 = first SPVAR slot
 * @returns Map from varAccess to decoded value, plus dataExists flag
 */
export function decodeSPVAR(
	layout: BitLayout,
	slotValues: number[]
): { dataExists: boolean; values: Map<string, number> } {
	const values = new Map<string, number>();

	let currentBit = 0;
	let currentSlot = 0;

	function readBits(min: number, max: number): number {
		const bits = bpBitCount(min, max);
		const slotVal = (slotValues[currentSlot] ?? 0) >>> 0;
		let value = (slotVal >>> currentBit) & makeFullMask(bits);

		// Handle cross-boundary read
		if (bits >= 32 - currentBit) {
			const lowBits = 32 - currentBit;
			const highBits = bits - lowBits;
			const lowMask = makeFullMask(lowBits);
			const nextSlotVal = (slotValues[currentSlot + 1] ?? 0) >>> 0;
			value = ((slotVal >>> currentBit) & lowMask) | ((nextSlotVal & makeFullMask(highBits)) << lowBits);
		}

		currentBit += bits;
		value = value & makeFullMask(bits);

		if (currentBit >= 32) {
			currentSlot++;
			currentBit -= 32;
		}

		if (min < 0 || max < 0) {
			value = unpackSigned(value, bits);
		}

		return value;
	}

	// Read data-exists marker
	const marker = readBits(0, 1);
	const dataExists = marker === 1;

	if (!dataExists) {
		// No data — return defaults
		for (const v of layout.variables) {
			values.set(v.varAccess, v.default);
		}
		return { dataExists: false, values };
	}

	// Read each variable
	for (const v of layout.variables) {
		const decoded = readBits(v.min, v.max);
		if (decoded < v.min || decoded > v.max) {
			values.set(v.varAccess, v.default);
		} else {
			values.set(v.varAccess, decoded);
		}
	}

	return { dataExists: true, values };
}

/**
 * Encode variable values into raw SPVAR slot values.
 * Matches save_spvar() + flush_spvar() logic from Common/bitpack.gpc.
 *
 * @param layout - The bit layout from analyzeBitLayout()
 * @param values - Map from varAccess to value
 * @returns Array of 32-bit slot values
 */
export function encodeSPVAR(
	layout: BitLayout,
	values: Map<string, number>
): number[] {
	const slots: number[] = [];
	let currentBit = 0;
	let currentSlot = 0;
	let currentValue = 0;

	function writeBits(val: number, min: number, max: number): void {
		const bits = bpBitCount(min, max);
		val = Math.max(min, Math.min(max, val));

		if (min < 0 || max < 0) {
			val = packSigned(val, bits);
		}
		val = (val & makeFullMask(bits)) >>> 0;

		// Check if value spans SPVAR boundary
		if (bits >= 32 - currentBit) {
			currentValue = (currentValue | (val << currentBit)) >>> 0;
			// Ensure slot array is large enough
			while (slots.length <= currentSlot) slots.push(0);
			slots[currentSlot] = currentValue;
			currentSlot++;
			const consumed = 32 - currentBit;
			val = val >>> consumed;
			const remaining = bits - consumed;
			currentBit = 0;
			currentValue = 0;

			// Handle remaining bits
			currentValue = (currentValue | (val << currentBit)) >>> 0;
			currentBit += remaining;
		} else {
			currentValue = (currentValue | (val << currentBit)) >>> 0;
			currentBit += bits;
		}

		if (!currentBit) {
			currentValue = 0;
		}
	}

	// Write data-exists marker
	writeBits(1, 0, 1);

	// Write each variable
	for (const v of layout.variables) {
		const val = values.get(v.varAccess) ?? v.default;
		writeBits(val, v.min, v.max);
	}

	// Flush remaining bits
	while (slots.length <= currentSlot) slots.push(0);
	slots[currentSlot] = currentValue;

	return slots;
}

// ==================== GPC File Scanning ====================

/**
 * A save_spvar() call parsed from GPC source code.
 */
export interface GpcSaveCall {
	varAccess: string;
	min: number;
	max: number;
	bitWidth: number;
	file: string;
	line: number;
}

/**
 * A set_pvar() call parsed from GPC source code (manual SPVAR usage).
 */
export interface GpcSetPvarCall {
	slotName: string;
	value: string;
	file: string;
	line: number;
}

/**
 * Result of scanning GPC files for persistence calls.
 */
export interface GpcScanResult {
	saveCalls: GpcSaveCall[];
	setPvarCalls: GpcSetPvarCall[];
	totalBitpackBits: number; // Sum of bitwidths from save_spvar calls (including marker)
}

/**
 * Scan GPC source content for save_spvar() and set_pvar() calls.
 * @param content - GPC file content
 * @param fileName - File name for display
 * @returns Parsed persistence calls
 */
export function scanGpcFile(
	content: string,
	fileName: string
): { saveCalls: GpcSaveCall[]; setPvarCalls: GpcSetPvarCall[] } {
	const saveCalls: GpcSaveCall[] = [];
	const setPvarCalls: GpcSetPvarCall[] = [];
	const lines = content.split('\n');

	// Match: save_spvar(VarName, min, max);  or  save_spvar(VarName[idx], min, max);
	const saveRe = /save_spvar\(\s*([A-Za-z_]\w*(?:\[\w+\])?)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/;
	// Match: set_pvar(SPVAR_NAME, value);
	const setRe = /set_pvar\(\s*([A-Za-z_]\w*)\s*,\s*(.+?)\s*\)/;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		// Skip comments
		if (line.startsWith('//')) continue;

		const saveMatch = line.match(saveRe);
		if (saveMatch) {
			const min = parseInt(saveMatch[2]);
			const max = parseInt(saveMatch[3]);
			saveCalls.push({
				varAccess: saveMatch[1],
				min,
				max,
				bitWidth: bpBitCount(min, max),
				file: fileName,
				line: i + 1
			});
		}

		const setMatch = line.match(setRe);
		if (setMatch) {
			setPvarCalls.push({
				slotName: setMatch[1],
				value: setMatch[2],
				file: fileName,
				line: i + 1
			});
		}
	}

	return { saveCalls, setPvarCalls };
}

/**
 * Merge scan results from multiple files into a single result.
 */
export function mergeGpcScans(
	scans: { saveCalls: GpcSaveCall[]; setPvarCalls: GpcSetPvarCall[] }[]
): GpcScanResult {
	const saveCalls: GpcSaveCall[] = [];
	const setPvarCalls: GpcSetPvarCall[] = [];

	for (const scan of scans) {
		saveCalls.push(...scan.saveCalls);
		setPvarCalls.push(...scan.setPvarCalls);
	}

	// Total bits = sum of all save_spvar bit widths
	const totalBitpackBits = saveCalls.reduce((sum, c) => sum + c.bitWidth, 0);

	return { saveCalls, setPvarCalls, totalBitpackBits };
}

// ==================== Helpers ====================

/**
 * Get which SPVAR slot a bit offset falls into.
 */
export function bitToSlot(bitOffset: number): number {
	return Math.floor(bitOffset / 32);
}

/**
 * Get the bit position within a slot.
 */
export function bitInSlot(bitOffset: number): number {
	return bitOffset % 32;
}

/**
 * Generate a color for a menu item index (for visualization).
 */
const ITEM_COLORS = [
	'#e94560', '#48cae4', '#ffd700', '#95d5b2', '#c084fc',
	'#ff6b6b', '#7b68ee', '#ffb347', '#f472b6', '#38bdf8',
	'#a3e635', '#fb923c', '#818cf8', '#2dd4bf', '#f87171'
];

export function getItemColor(index: number): string {
	return ITEM_COLORS[index % ITEM_COLORS.length];
}
