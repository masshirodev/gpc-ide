export type ConsoleType = 'ps5' | 'xb1' | 'swi' | 'wii';

export const CONSOLE_TYPES: ConsoleType[] = ['ps5', 'xb1', 'swi', 'wii'];

export const CONSOLE_LABELS: Record<ConsoleType, string> = {
	ps5: 'PlayStation 5',
	xb1: 'Xbox One',
	swi: 'Nintendo Switch',
	wii: 'Nintendo Wii'
};

interface ConsoleButton {
	name: string;
	value: number;
}

export const CONSOLE_BUTTONS: Record<ConsoleType, ConsoleButton[]> = {
	ps5: [
		{ name: 'PS5_PS', value: 0 },
		{ name: 'PS5_CREATE', value: 1 },
		{ name: 'PS5_OPTIONS', value: 2 },
		{ name: 'PS5_R1', value: 3 },
		{ name: 'PS5_R2', value: 4 },
		{ name: 'PS5_R3', value: 5 },
		{ name: 'PS5_L1', value: 6 },
		{ name: 'PS5_L2', value: 7 },
		{ name: 'PS5_L3', value: 8 },
		{ name: 'PS5_RX', value: 9 },
		{ name: 'PS5_RY', value: 10 },
		{ name: 'PS5_LX', value: 11 },
		{ name: 'PS5_LY', value: 12 },
		{ name: 'PS5_UP', value: 13 },
		{ name: 'PS5_DOWN', value: 14 },
		{ name: 'PS5_LEFT', value: 15 },
		{ name: 'PS5_RIGHT', value: 16 },
		{ name: 'PS5_TRIANGLE', value: 17 },
		{ name: 'PS5_CIRCLE', value: 18 },
		{ name: 'PS5_CROSS', value: 19 },
		{ name: 'PS5_SQUARE', value: 20 },
		{ name: 'PS5_TOUCH', value: 27 }
	],
	xb1: [
		{ name: 'XB1_XBOX', value: 0 },
		{ name: 'XB1_VIEW', value: 1 },
		{ name: 'XB1_MENU', value: 2 },
		{ name: 'XB1_RB', value: 3 },
		{ name: 'XB1_RT', value: 4 },
		{ name: 'XB1_RS', value: 5 },
		{ name: 'XB1_LB', value: 6 },
		{ name: 'XB1_LT', value: 7 },
		{ name: 'XB1_LS', value: 8 },
		{ name: 'XB1_RX', value: 9 },
		{ name: 'XB1_RY', value: 10 },
		{ name: 'XB1_LX', value: 11 },
		{ name: 'XB1_LY', value: 12 },
		{ name: 'XB1_UP', value: 13 },
		{ name: 'XB1_DOWN', value: 14 },
		{ name: 'XB1_LEFT', value: 15 },
		{ name: 'XB1_RIGHT', value: 16 },
		{ name: 'XB1_Y', value: 17 },
		{ name: 'XB1_B', value: 18 },
		{ name: 'XB1_A', value: 19 },
		{ name: 'XB1_X', value: 20 },
		{ name: 'XB1_SHARE', value: 21 },
		{ name: 'XB1_SYNC', value: 27 },
		{ name: 'XB1_PR1', value: 34 },
		{ name: 'XB1_PR2', value: 35 },
		{ name: 'XB1_PL1', value: 36 },
		{ name: 'XB1_PL2', value: 37 }
	],
	swi: [
		{ name: 'SWI_HOME', value: 0 },
		{ name: 'SWI_MINUS', value: 1 },
		{ name: 'SWI_PLUS', value: 2 },
		{ name: 'SWI_R', value: 3 },
		{ name: 'SWI_ZR', value: 4 },
		{ name: 'SWI_R3', value: 5 },
		{ name: 'SWI_L', value: 6 },
		{ name: 'SWI_ZL', value: 7 },
		{ name: 'SWI_L3', value: 8 },
		{ name: 'SWI_RX', value: 9 },
		{ name: 'SWI_LX', value: 10 },
		{ name: 'SWI_RY', value: 11 },
		{ name: 'SWI_LY', value: 12 },
		{ name: 'SWI_UP', value: 13 },
		{ name: 'SWI_DOWN', value: 14 },
		{ name: 'SWI_LEFT', value: 15 },
		{ name: 'SWI_RIGHT', value: 16 },
		{ name: 'SWI_X', value: 17 },
		{ name: 'SWI_A', value: 18 },
		{ name: 'SWI_B', value: 19 },
		{ name: 'SWI_Y', value: 20 },
		{ name: 'SWI_ACCX', value: 21 },
		{ name: 'SWI_ACCY', value: 22 },
		{ name: 'SWI_ACCZ', value: 23 },
		{ name: 'SWI_GYROX', value: 24 },
		{ name: 'SWI_GYROY', value: 25 },
		{ name: 'SWI_GYROZ', value: 26 },
		{ name: 'SWI_CAPTURE', value: 27 }
	],
	wii: [
		{ name: 'WII_HOME', value: 0 },
		{ name: 'WII_MINUS', value: 1 },
		{ name: 'WII_PLUS', value: 2 },
		{ name: 'WII_RT', value: 3 },
		{ name: 'WII_ZR', value: 4 },
		{ name: 'WII_R3', value: 5 },
		{ name: 'WII_LT', value: 6 },
		{ name: 'WII_ZL', value: 7 },
		{ name: 'WII_TWO', value: 8 },
		{ name: 'WII_RX', value: 9 },
		{ name: 'WII_RY', value: 10 },
		{ name: 'WII_LX', value: 11 },
		{ name: 'WII_LY', value: 12 },
		{ name: 'WII_UP', value: 13 },
		{ name: 'WII_DOWN', value: 14 },
		{ name: 'WII_LEFT', value: 15 },
		{ name: 'WII_RIGHT', value: 16 },
		{ name: 'WII_X', value: 17 },
		{ name: 'WII_B', value: 18 },
		{ name: 'WII_A', value: 19 },
		{ name: 'WII_Y', value: 20 },
		{ name: 'WII_ACCX', value: 21 },
		{ name: 'WII_ACCY', value: 22 },
		{ name: 'WII_ACCZ', value: 23 },
		{ name: 'WII_ACCNX', value: 25 },
		{ name: 'WII_ACCNY', value: 26 },
		{ name: 'WII_ACCNZ', value: 27 },
		{ name: 'WII_IRX', value: 28 },
		{ name: 'WII_IRY', value: 29 }
	]
};

/** Default button assignments per console for new games */
export const CONSOLE_DEFAULTS: Record<ConsoleType, Record<string, string>> = {
	ps5: {
		menu_mod: 'PS5_L2',
		menu_btn: 'PS5_OPTIONS',
		confirm: 'PS5_CROSS',
		cancel: 'PS5_CIRCLE',
		up: 'PS5_UP',
		down: 'PS5_DOWN',
		left: 'PS5_LEFT',
		right: 'PS5_RIGHT',
		fire: 'PS5_R2',
		ads: 'PS5_L2'
	},
	xb1: {
		menu_mod: 'XB1_LT',
		menu_btn: 'XB1_MENU',
		confirm: 'XB1_A',
		cancel: 'XB1_B',
		up: 'XB1_UP',
		down: 'XB1_DOWN',
		left: 'XB1_LEFT',
		right: 'XB1_RIGHT',
		fire: 'XB1_RT',
		ads: 'XB1_LT'
	},
	swi: {
		menu_mod: 'SWI_ZL',
		menu_btn: 'SWI_PLUS',
		confirm: 'SWI_B',
		cancel: 'SWI_A',
		up: 'SWI_UP',
		down: 'SWI_DOWN',
		left: 'SWI_LEFT',
		right: 'SWI_RIGHT',
		fire: 'SWI_ZR',
		ads: 'SWI_ZL'
	},
	wii: {
		menu_mod: 'WII_ZL',
		menu_btn: 'WII_PLUS',
		confirm: 'WII_A',
		cancel: 'WII_B',
		up: 'WII_UP',
		down: 'WII_DOWN',
		left: 'WII_LEFT',
		right: 'WII_RIGHT',
		fire: 'WII_ZR',
		ads: 'WII_ZL'
	}
};

/** Axis identifiers per console */
export const CONSOLE_AXES: Record<ConsoleType, { rx: string; ry: string; lx: string; ly: string }> =
	{
		ps5: { rx: 'PS5_RX', ry: 'PS5_RY', lx: 'PS5_LX', ly: 'PS5_LY' },
		xb1: { rx: 'XB1_RX', ry: 'XB1_RY', lx: 'XB1_LX', ly: 'XB1_LY' },
		swi: { rx: 'SWI_RX', ry: 'SWI_RY', lx: 'SWI_LX', ly: 'SWI_LY' },
		wii: { rx: 'WII_RX', ry: 'WII_RY', lx: 'WII_LX', ly: 'WII_LY' }
	};

/** Get the list of button names for a console (for ButtonSelect dropdown) */
export function getButtonNames(consoleType: ConsoleType): string[] {
	return CONSOLE_BUTTONS[consoleType].map((b) => b.name);
}

// Build reverse lookup maps: name -> value
const nameToValue = new Map<string, number>();
for (const buttons of Object.values(CONSOLE_BUTTONS)) {
	for (const b of buttons) {
		nameToValue.set(b.name, b.value);
	}
}

// Build value -> name maps per console
const valueToName: Record<ConsoleType, Map<number, string>> = {
	ps5: new Map(),
	xb1: new Map(),
	swi: new Map(),
	wii: new Map()
};
for (const [ct, buttons] of Object.entries(CONSOLE_BUTTONS) as [ConsoleType, ConsoleButton[]][]) {
	for (const b of buttons) {
		// First entry for a value wins (primary name)
		if (!valueToName[ct].has(b.value)) {
			valueToName[ct].set(b.value, b.name);
		}
	}
}

/** Translate a button identifier from one console to another by matching value */
export function translateButton(name: string, from: ConsoleType, to: ConsoleType): string {
	if (from === to) return name;
	const value = nameToValue.get(name);
	if (value === undefined) return name;
	return valueToName[to].get(value) ?? name;
}

/** Detect which console type a button name belongs to */
export function detectConsoleFromButton(name: string): ConsoleType | null {
	if (name.startsWith('PS5_') || name.startsWith('PS4_') || name.startsWith('PS3_')) return 'ps5';
	if (name.startsWith('XB1_') || name.startsWith('XB360_')) return 'xb1';
	if (name.startsWith('SWI_')) return 'swi';
	if (name.startsWith('WII_')) return 'wii';
	return null;
}

/** Get the prefix string for a console type (e.g., 'PS5_', 'XB1_') */
export function getConsolePrefix(consoleType: ConsoleType): string {
	switch (consoleType) {
		case 'ps5':
			return 'PS5_';
		case 'xb1':
			return 'XB1_';
		case 'swi':
			return 'SWI_';
		case 'wii':
			return 'WII_';
	}
}
