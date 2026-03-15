/** Device type for button mapping entries */
export const enum InputDevice {
	None = 0x00,
	Keyboard = 0x01,
	Mouse = 0x02
}

/** Special code values when device type is None */
export const enum EmptyCode {
	Empty = 0x00,
	Unmapped = 0xff
}

/** Mouse button codes (Cronus Zen numbering — reversed from USB HID) */
export const enum MouseButton {
	Right = 0x01,
	Left = 0x02,
	Middle = 0x03,
	Button4 = 0x04,
	Button5 = 0x05,
	WheelUp = 0x11,
	WheelDown = 0x12
}

/** A single input mapping: device type + code */
export interface InputMapping {
	type: InputDevice;
	code: number; // USB HID scancode (keyboard) or MouseButton (mouse)
}

/** Ballistic curve point — Y value with anchor flag */
export interface CurvePoint {
	x: number; // 0, 5, 10, ..., 100 (derived from index)
	y: number; // 0–127
	anchor: boolean; // user-placed control point
}

/** Controller joystick axis assignments */
export interface ControllerAxes {
	ids: number[]; // 6 axis assignment bytes
	leftStickDeadzone: number; // ÷100 for display
	rightStickDeadzone: number; // ÷100 for display
	leftTriggerDeadzone: number; // raw uint8
	rightTriggerDeadzone: number; // raw uint8
}

/** Movement key configuration */
export interface MovementConfig {
	forward: InputMapping;
	left: InputMapping;
	right: InputMapping;
	back: InputMapping;
	analogSim: number; // 0–100
	walkScale: number; // raw uint8 — block offset 0x62
}

/** Controller axis assignment values */
export const AXIS_NAMES: Record<number, string> = {
	0x00: 'None',
	0x01: 'Joystick Left X',
	0x02: 'Joystick Left Y',
	0x03: 'Joystick Left Z',
	0x04: 'Joystick Right X',
	0x05: 'Joystick Right Y',
	0x06: 'Joystick Right Z',
	0x07: 'Joystick Left Trigger',
	0x08: 'Joystick Right Trigger',
	0x09: 'Joystick Slider'
};

/** Labels for the 6 axis slots */
export const AXIS_SLOT_LABELS = [
	'Left Stick X',
	'Left Stick Y',
	'Right Stick X',
	'Right Stick Y',
	'Left Trigger',
	'Right Trigger'
] as const;

/** Deadzone shape enum */
export const enum DeadzoneShape {
	Ellipse = 0x00,
	Rectangle = 0x01,
	COD = 0x02
}

export const DEADZONE_SHAPE_NAMES: Record<number, string> = {
	[DeadzoneShape.Ellipse]: 'Ellipse',
	[DeadzoneShape.Rectangle]: 'Rectangle',
	[DeadzoneShape.COD]: 'COD'
};

/** Aim tuning settings */
export interface AimSettings {
	sensitivity: number; // ÷100 for display (e.g. 5900 → 59.00)
	xyRatio: number; // ÷100 (e.g. 105 → 1.05)
	boost: number; // ÷100 for display (e.g. 500 → 5.00) — block offset 0x2A
	smoothness: number; // raw uint8 (e.g. 22) — block offset 0x24
	invertY: boolean; // block offset 0x25
}

/** Translator settings */
export interface TranslatorSettings {
	deadzoneX: number; // ÷100 for display
	deadzoneY: number; // ÷100 for display
	analogStickize: number; // ÷100 for display (stored twice, only one value)
	deadzoneShape: DeadzoneShape; // block offset 0x0B
}

/** Activation/tail configuration for a profile block */
export interface ActivationConfig {
	enabled: boolean; // tail[0] — 1=active, 0=disabled
	inherit: boolean; // tail[1] — 1=child inherits mappings (HIP only)
	mode: number; // tail[2] — 2=always (HIP), 1=button-triggered
	buttonId: number; // tail[3] — HIP=0x02, ADS=0x59, AUX1-3=0x5A-5C
	toggleToActivate: boolean; // tail[4] — 1=toggle, 0=hold
	activateDelay: number; // tail[5] — milliseconds (200 = 0.2s)
	_reserved6: number; // tail[6] — always 0
	deactivateDelay: number; // block offset 0x09 — milliseconds (50 = 0.05s)
}

/** Controller button slot order — 18 fixed slots */
export const CONTROLLER_SLOTS = [
	'L2',
	'R2',
	'R3',
	'L3',
	'R1',
	'L1',
	'Cross',
	'Circle',
	'Square',
	'Triangle',
	'D-Up',
	'D-Down',
	'D-Right',
	'D-Left',
	'Share',
	'Options',
	'PS',
	'Touchpad'
] as const;

export type ControllerSlot = (typeof CONTROLLER_SLOTS)[number];

/** Button layout display names */
export type ButtonLayout = 'ps' | 'xbox';

export const BUTTON_LAYOUT_NAMES: Record<ButtonLayout, Record<string, string>> = {
	ps: {
		Cross: 'Cross',
		Circle: 'Circle',
		Square: 'Square',
		Triangle: 'Triangle',
		L1: 'L1',
		L2: 'L2',
		L3: 'L3',
		R1: 'R1',
		R2: 'R2',
		R3: 'R3',
		Share: 'Share',
		Options: 'Options',
		PS: 'PS',
		Touchpad: 'Touchpad'
	},
	xbox: {
		Cross: 'A',
		Circle: 'B',
		Square: 'X',
		Triangle: 'Y',
		L1: 'LB',
		L2: 'LT',
		L3: 'LS',
		R1: 'RB',
		R2: 'RT',
		R3: 'RS',
		Share: 'View',
		Options: 'Menu',
		PS: 'Xbox',
		Touchpad: 'Share'
	}
};

/** Get display name for a controller slot given a layout */
export function getSlotDisplayName(slot: ControllerSlot, layout: ButtonLayout): string {
	if (slot.startsWith('D-')) return slot;
	return BUTTON_LAYOUT_NAMES[layout][slot] ?? slot;
}

/** Sub-profile names */
export const PROFILE_NAMES = ['HIP', 'ADS', 'AUX1', 'AUX2', 'AUX3', 'AUX4'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

/** A single profile block (HIP, ADS, AUX1–4) */
export interface ZmkProfile {
	name: ProfileName;
	flags: number;
	translator: TranslatorSettings;
	aim: AimSettings;
	curve: CurvePoint[];
	movement: MovementConfig;
	controller: ControllerAxes;
	primaryMappings: InputMapping[];
	secondaryMappings: InputMapping[];
	activation: ActivationConfig;
	/** Raw reserved regions for round-trip fidelity */
	_reserved: {
		block01_08: Uint8Array; // offset 0x01–0x08 (8 bytes)
		// 0x09 = deactivateDelay (now in activation)
		block0A: Uint8Array; // offset 0x0A (1 byte)
		// 0x0B = deadzoneShape (now in translator)
		block14_1A: Uint8Array; // offset 0x14–0x1A (7 bytes)
		block1E_23: Uint8Array; // offset 0x1E–0x23 (6 bytes)
		// 0x24 = smoothness, 0x25 = invertY (now in aim)
		block26_29: Uint8Array; // offset 0x26–0x29 (4 bytes)
		// 0x2A-0x2B = boost (now in aim)
		block41_4B: Uint8Array; // offset 0x41–0x4B (11 bytes)
		block54_61: Uint8Array; // offset 0x54–0x61 (14 bytes)
		// 0x62 = walkScale (now in movement)
	};
}

/** Full .zmk file */
export interface ZmkFile {
	/** Format magic — always "MKZEN" */
	magic: string;
	/** Format version (e.g. "1.0.0") */
	formatVersion: string;
	/** Profile display name */
	profileName: string;
	/** ZenStudio app version that created this file */
	appVersion: string;
	/** Global settings bytes (16 bytes, not fully decoded) */
	globalSettings: Uint8Array;
	/** 6 profile blocks: HIP, ADS, AUX1–4 */
	profiles: ZmkProfile[];
	/** In-game settings notes (freeform text) */
	notes: string;
	/** Whether file uses legacy space-padding (0x20) or null-padding (0x00) */
	legacyFormat: boolean;
}

/** USB HID keyboard scan code lookup */
export const HID_KEY_NAMES: Record<number, string> = {
	0x04: 'A',
	0x05: 'B',
	0x06: 'C',
	0x07: 'D',
	0x08: 'E',
	0x09: 'F',
	0x0a: 'G',
	0x0b: 'H',
	0x0c: 'I',
	0x0d: 'J',
	0x0e: 'K',
	0x0f: 'L',
	0x10: 'M',
	0x11: 'N',
	0x12: 'O',
	0x13: 'P',
	0x14: 'Q',
	0x15: 'R',
	0x16: 'S',
	0x17: 'T',
	0x18: 'U',
	0x19: 'V',
	0x1a: 'W',
	0x1b: 'X',
	0x1c: 'Y',
	0x1d: 'Z',
	0x1e: '1',
	0x1f: '2',
	0x20: '3',
	0x21: '4',
	0x22: '5',
	0x23: '6',
	0x24: '7',
	0x25: '8',
	0x26: '9',
	0x27: '0',
	0x28: 'Enter',
	0x29: 'Escape',
	0x2a: 'Backspace',
	0x2b: 'Tab',
	0x2c: 'Space',
	0x2d: '-',
	0x2e: '=',
	0x2f: '[',
	0x30: ']',
	0x31: '\\',
	0x33: ';',
	0x34: "'",
	0x35: '`',
	0x36: ',',
	0x37: '.',
	0x38: '/',
	0x39: 'CapsLock',
	0x3a: 'F1',
	0x3b: 'F2',
	0x3c: 'F3',
	0x3d: 'F4',
	0x3e: 'F5',
	0x3f: 'F6',
	0x40: 'F7',
	0x41: 'F8',
	0x42: 'F9',
	0x43: 'F10',
	0x44: 'F11',
	0x45: 'F12',
	0x46: 'PrintScreen',
	0x47: 'ScrollLock',
	0x48: 'Pause',
	0x49: 'Insert',
	0x4a: 'Home',
	0x4b: 'PageUp',
	0x4c: 'Delete',
	0x4d: 'End',
	0x4e: 'PageDown',
	0x4f: 'Right',
	0x50: 'Left',
	0x51: 'Down',
	0x52: 'Up',
	0x53: 'NumLock',
	0x54: 'KP /',
	0x55: 'KP *',
	0x56: 'KP -',
	0x57: 'KP +',
	0x58: 'KP Enter',
	0x59: 'KP 1',
	0x5a: 'KP 2',
	0x5b: 'KP 3',
	0x5c: 'KP 4',
	0x5d: 'KP 5',
	0x5e: 'KP 6',
	0x5f: 'KP 7',
	0x60: 'KP 8',
	0x61: 'KP 9',
	0x62: 'KP 0',
	0x63: 'KP .',
	0x65: 'Apps',
	0xe0: 'LeftCtrl',
	0xe1: 'LeftShift',
	0xe2: 'LeftAlt',
	0xe3: 'LeftMeta',
	0xe4: 'RightCtrl',
	0xe5: 'RightShift',
	0xe6: 'RightAlt',
	0xe7: 'RightMeta'
};

/** Mouse button name lookup */
export const MOUSE_BUTTON_NAMES: Record<number, string> = {
	[MouseButton.Right]: 'Right Mouse',
	[MouseButton.Left]: 'Left Mouse',
	[MouseButton.Middle]: 'Middle Mouse',
	[MouseButton.Button4]: 'Mouse 4',
	[MouseButton.Button5]: 'Mouse 5',
	[MouseButton.WheelUp]: 'Wheel Up',
	[MouseButton.WheelDown]: 'Wheel Down'
};

/** Get human-readable name for an input mapping */
export function getInputName(mapping: InputMapping): string {
	if (mapping.type === InputDevice.None) {
		return mapping.code === EmptyCode.Unmapped ? '(unmapped)' : '';
	}
	if (mapping.type === InputDevice.Keyboard) {
		return HID_KEY_NAMES[mapping.code] ?? `Key 0x${mapping.code.toString(16).toUpperCase()}`;
	}
	if (mapping.type === InputDevice.Mouse) {
		return MOUSE_BUTTON_NAMES[mapping.code] ?? `Mouse ${mapping.code}`;
	}
	return `Unknown(${mapping.type}:${mapping.code})`;
}
