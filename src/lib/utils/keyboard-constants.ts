import {
	CONSOLE_BUTTONS,
	type ConsoleType
} from '$lib/utils/console-buttons';

export interface ButtonDef {
	id: string;
	label: string;
	group: string;
}

/** Get controller buttons as ButtonDef[] for a given console */
export function getControllerButtons(consoleType: ConsoleType): ButtonDef[] {
	return CONSOLE_BUTTONS[consoleType].map((b) => ({
		id: b.name,
		label: b.name.replace(/^(PS5|XB1|SWI|WII)_/, ''),
		group: classifyButton(b.value)
	}));
}

function classifyButton(value: number): string {
	switch (value) {
		case 17:
		case 18:
		case 19:
		case 20:
			return 'face';
		case 13:
		case 14:
		case 15:
		case 16:
			return 'dpad';
		case 3:
		case 6:
			return 'shoulder';
		case 4:
		case 7:
			return 'trigger';
		case 5:
		case 8:
			return 'stick_click';
		case 11:
		case 12:
			return 'left_stick';
		case 9:
		case 10:
			return 'right_stick';
		default:
			return 'system';
	}
}

export const KEYBOARD_KEYS: ButtonDef[] = [
	// Letters
	...Array.from({ length: 26 }, (_, i) => ({
		id: `KEY_${String.fromCharCode(65 + i)}`,
		label: String.fromCharCode(65 + i),
		group: 'letter'
	})),
	// Numbers
	...Array.from({ length: 10 }, (_, i) => ({
		id: `KEY_${i}`,
		label: `${i}`,
		group: 'number'
	})),
	// Special keys
	{ id: 'KEY_SPACE', label: 'Space', group: 'special' },
	{ id: 'KEY_ENTER', label: 'Enter', group: 'special' },
	{ id: 'KEY_TAB', label: 'Tab', group: 'special' },
	{ id: 'KEY_ESC', label: 'Esc', group: 'special' },
	{ id: 'KEY_BACKSPACE', label: 'Backspace', group: 'special' },
	{ id: 'KEY_CAPSLOCK', label: 'Caps Lock', group: 'special' },
	{ id: 'KEY_DELETE', label: 'Delete', group: 'special' },
	{ id: 'KEY_INSERT', label: 'Insert', group: 'special' },
	// Modifiers (left)
	{ id: 'KEY_LEFTCTRL', label: 'Left Ctrl', group: 'modifier' },
	{ id: 'KEY_LEFTSHIFT', label: 'Left Shift', group: 'modifier' },
	{ id: 'KEY_LEFTALT', label: 'Left Alt', group: 'modifier' },
	{ id: 'KEY_LEFTMETA', label: 'Left Meta', group: 'modifier' },
	// Modifiers (right)
	{ id: 'KEY_RIGHTCTRL', label: 'Right Ctrl', group: 'modifier' },
	{ id: 'KEY_RIGHTSHIFT', label: 'Right Shift', group: 'modifier' },
	{ id: 'KEY_RIGHTALT', label: 'Right Alt', group: 'modifier' },
	{ id: 'KEY_RIGHTMETA', label: 'Right Meta', group: 'modifier' },
	// Arrow keys
	{ id: 'KEY_UP', label: 'Up', group: 'arrow' },
	{ id: 'KEY_DOWN', label: 'Down', group: 'arrow' },
	{ id: 'KEY_LEFT', label: 'Left', group: 'arrow' },
	{ id: 'KEY_RIGHT', label: 'Right', group: 'arrow' },
	// Navigation
	{ id: 'KEY_HOME', label: 'Home', group: 'navigation' },
	{ id: 'KEY_END', label: 'End', group: 'navigation' },
	{ id: 'KEY_PAGEUP', label: 'Page Up', group: 'navigation' },
	{ id: 'KEY_PAGEDOWN', label: 'Page Down', group: 'navigation' },
	// Function keys
	...Array.from({ length: 12 }, (_, i) => ({
		id: `KEY_F${i + 1}`,
		label: `F${i + 1}`,
		group: 'function'
	})),
	// Punctuation
	{ id: 'KEY_MINUS', label: '-', group: 'punctuation' },
	{ id: 'KEY_EQUAL', label: '=', group: 'punctuation' },
	{ id: 'KEY_LEFTBRACE', label: '[', group: 'punctuation' },
	{ id: 'KEY_RIGHTBRACE', label: ']', group: 'punctuation' },
	{ id: 'KEY_SEMICOLON', label: ';', group: 'punctuation' },
	{ id: 'KEY_APOSTROPHE', label: "'", group: 'punctuation' },
	{ id: 'KEY_GRAVE', label: '`', group: 'punctuation' },
	{ id: 'KEY_COMMA', label: ',', group: 'punctuation' },
	{ id: 'KEY_DOT', label: '.', group: 'punctuation' },
	{ id: 'KEY_SLASH', label: '/', group: 'punctuation' },
	{ id: 'KEY_BACKSLASH', label: '\\', group: 'punctuation' },
	{ id: 'KEY_HASHTILDE', label: '#~', group: 'punctuation' },
	// Numpad
	...Array.from({ length: 10 }, (_, i) => ({
		id: `KEY_KP${i}`,
		label: `Num ${i}`,
		group: 'numpad'
	})),
	{ id: 'KEY_NUMLOCK', label: 'Num Lock', group: 'numpad' },
	{ id: 'KEY_KPSLASH', label: 'Num /', group: 'numpad' },
	{ id: 'KEY_KPASTERISK', label: 'Num *', group: 'numpad' },
	{ id: 'KEY_KPMINUS', label: 'Num -', group: 'numpad' },
	{ id: 'KEY_KPPLUS', label: 'Num +', group: 'numpad' },
	{ id: 'KEY_KPENTER', label: 'Num Enter', group: 'numpad' },
	{ id: 'KEY_KPDOT', label: 'Num .', group: 'numpad' },
	{ id: 'KEY_KPEQUAL', label: 'Num =', group: 'numpad' },
	// System
	{ id: 'KEY_SYSRQ', label: 'Print Screen', group: 'system' },
	{ id: 'KEY_SCROLLLOCK', label: 'Scroll Lock', group: 'system' },
	{ id: 'KEY_PAUSE', label: 'Pause', group: 'system' },
	{ id: 'KEY_COMPOSE', label: 'Compose', group: 'system' },
	{ id: 'KEY_POWER', label: 'Power', group: 'system' },
	// Media
	{ id: 'KEY_MUTE', label: 'Mute', group: 'media' },
	{ id: 'KEY_VOLUMEUP', label: 'Vol Up', group: 'media' },
	{ id: 'KEY_VOLUMEDOWN', label: 'Vol Down', group: 'media' },
	{ id: 'KEY_MEDIA_PLAYPAUSE', label: 'Play/Pause', group: 'media' },
	{ id: 'KEY_MEDIA_STOPCD', label: 'Stop', group: 'media' },
	{ id: 'KEY_MEDIA_PREVIOUSSONG', label: 'Prev Track', group: 'media' },
	{ id: 'KEY_MEDIA_NEXTSONG', label: 'Next Track', group: 'media' },
];

export const BUTTON_GROUPS = [
	{ id: 'face', label: 'Face' },
	{ id: 'dpad', label: 'D-Pad' },
	{ id: 'shoulder', label: 'Bumpers' },
	{ id: 'trigger', label: 'Triggers' },
	{ id: 'stick_click', label: 'Sticks' },
	{ id: 'left_stick', label: 'L-Stick Axes' },
	{ id: 'right_stick', label: 'R-Stick Axes' },
	{ id: 'system', label: 'System' }
];

/** Get display label for any button/key ID */
export function getButtonLabel(id: string): string {
	// Keyboard keys
	const kb = KEYBOARD_KEYS.find((b) => b.id === id);
	if (kb) return kb.label;
	// Controller buttons — strip console prefix
	return id.replace(/^(PS5|PS4|PS3|XB1|XB360|SWI|WII)_/, '');
}

/** Controller button positions for the visual layout (relative percentages).
 *  Uses GPC button value indices so positions can be translated to any console.
 *  Layout follows PlayStation DualSense: D-pad upper-left, sticks at bottom. */
export interface ButtonPosition {
	value: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export const CONTROLLER_LAYOUT: ButtonPosition[] = [
	// Triggers (top row)
	{ value: 7, x: 10, y: 0, width: 14, height: 8 }, // L2/LT
	{ value: 4, x: 76, y: 0, width: 14, height: 8 }, // R2/RT
	// Bumpers
	{ value: 6, x: 10, y: 10, width: 14, height: 8 }, // L1/LB
	{ value: 3, x: 76, y: 10, width: 14, height: 8 }, // R1/RB
	// System buttons
	{ value: 0, x: 46, y: 24, width: 8, height: 6 }, // PS/Xbox/Home
	{ value: 1, x: 32, y: 24, width: 8, height: 6 }, // Share/Create/View
	{ value: 2, x: 60, y: 24, width: 8, height: 6 }, // Options/Menu
	{ value: 27, x: 46, y: 32, width: 8, height: 6 }, // Touch/Sync/Capture
	// D-pad (upper-left — PlayStation layout)
	{ value: 13, x: 14, y: 32, width: 8, height: 8 }, // Up
	{ value: 14, x: 14, y: 48, width: 8, height: 8 }, // Down
	{ value: 15, x: 6, y: 40, width: 8, height: 8 }, // Left
	{ value: 16, x: 22, y: 40, width: 8, height: 8 }, // Right
	// Face buttons (upper-right)
	{ value: 17, x: 74, y: 32, width: 8, height: 8 }, // Triangle/Y
	{ value: 18, x: 82, y: 40, width: 8, height: 8 }, // Circle/B
	{ value: 19, x: 74, y: 48, width: 8, height: 8 }, // Cross/A
	{ value: 20, x: 66, y: 40, width: 8, height: 8 }, // Square/X
	// Left stick axes + click (bottom-left)
	{ value: 11, x: 30, y: 58, width: 12, height: 6 }, // LX
	{ value: 12, x: 30, y: 64, width: 12, height: 6 }, // LY
	{ value: 8, x: 32, y: 72, width: 10, height: 8 }, // L3
	// Right stick axes + click (bottom-right)
	{ value: 9, x: 56, y: 58, width: 12, height: 6 }, // RX
	{ value: 10, x: 56, y: 64, width: 12, height: 6 }, // RY
	{ value: 5, x: 58, y: 72, width: 10, height: 8 } // R3
];

/** Look up the button name for a layout position on a given console */
export function getLayoutButtonName(
	pos: ButtonPosition,
	consoleType: ConsoleType
): string {
	const btn = CONSOLE_BUTTONS[consoleType].find((b) => b.value === pos.value);
	return btn?.name ?? `BTN_${pos.value}`;
}
