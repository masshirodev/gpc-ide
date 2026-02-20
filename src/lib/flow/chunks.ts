import type { FlowChunk } from '$lib/types/flow';

/**
 * Built-in chunk definitions that ship with the IDE.
 * These are pre-built node templates users can drag into their flow graphs.
 */
export const BUILTIN_CHUNKS: FlowChunk[] = [
	{
		id: 'builtin-intro-screen',
		name: 'Intro Screen',
		description: 'A splash/intro screen with a timeout transition to the next state.',
		category: 'intro',
		tags: ['intro', 'splash', 'startup'],
		nodeTemplate: {
			type: 'intro',
			label: 'Intro',
			gpcCode: '// Intro screen — auto-transitions after timeout',
			onEnter: 'cls_oled(OLED_BLACK);\ntext_oled(30, 28, OLED_FONT_SMALL, OLED_WHITE, "LOADING...");',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Timeout',
				condition: { type: 'timeout', timeoutMs: 3000 },
				direction: 'outgoing',
			},
		],
		parameters: [
			{
				key: 'timeoutMs',
				label: 'Duration (ms)',
				type: 'number',
				defaultValue: '3000',
				description: 'How long to show the intro before transitioning',
			},
		],
		createdAt: 0,
		updatedAt: 0,
	},
	{
		id: 'builtin-menu-3items',
		name: 'Menu Page (3 Items)',
		description: 'A standard 3-item OLED menu page with up/down navigation and confirm/cancel.',
		category: 'menu',
		tags: ['menu', 'navigation', 'oled'],
		nodeTemplate: {
			type: 'menu',
			label: 'Main Menu',
			variables: [
				{ name: 'MenuCursor', type: 'int', defaultValue: 0, persist: true },
			],
			gpcCode: [
				'// Draw menu items',
				'cls_oled(OLED_BLACK);',
				'text_oled(4, 0, OLED_FONT_SMALL, OLED_WHITE, "MENU");',
				'line_oled(0, 9, 127, 9, OLED_WHITE);',
				'',
				'// Draw 3 items with cursor',
				'if(MenuCursor == 0) rect_oled(0, 12, 127, 24, OLED_WHITE);',
				'text_oled(4, 13, OLED_FONT_SMALL, MenuCursor == 0 ? OLED_BLACK : OLED_WHITE, "Item 1");',
				'if(MenuCursor == 1) rect_oled(0, 28, 127, 40, OLED_WHITE);',
				'text_oled(4, 29, OLED_FONT_SMALL, MenuCursor == 1 ? OLED_BLACK : OLED_WHITE, "Item 2");',
				'if(MenuCursor == 2) rect_oled(0, 44, 127, 56, OLED_WHITE);',
				'text_oled(4, 45, OLED_FONT_SMALL, MenuCursor == 2 ? OLED_BLACK : OLED_WHITE, "Item 3");',
				'',
				'// Navigation',
				'if(event_press(DOWN_BTN)) MenuCursor = (MenuCursor + 1) % 3;',
				'if(event_press(UP_BTN)) MenuCursor = (MenuCursor + 2) % 3;',
			].join('\n'),
			onEnter: '',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Confirm',
				condition: { type: 'button_press', button: 'CONFIRM_BTN' },
				direction: 'outgoing',
			},
			{
				label: 'Cancel',
				condition: { type: 'button_press', button: 'CANCEL_BTN' },
				direction: 'outgoing',
			},
		],
		parameters: [],
		createdAt: 0,
		updatedAt: 0,
	},
	{
		id: 'builtin-settings-submenu',
		name: 'Settings Submenu',
		description: 'A submenu with toggle options and a cancel/back button.',
		category: 'menu',
		tags: ['settings', 'submenu', 'options'],
		nodeTemplate: {
			type: 'submenu',
			label: 'Settings',
			variables: [
				{ name: 'SettingsCursor', type: 'int', defaultValue: 0, persist: false },
				{ name: 'Setting1', type: 'int', defaultValue: 0, persist: true },
				{ name: 'Setting2', type: 'int', defaultValue: 0, persist: true },
			],
			gpcCode: [
				'cls_oled(OLED_BLACK);',
				'text_oled(4, 0, OLED_FONT_SMALL, OLED_WHITE, "SETTINGS");',
				'line_oled(0, 9, 127, 9, OLED_WHITE);',
				'',
				'// Toggle items',
				'if(SettingsCursor == 0) rect_oled(0, 12, 127, 24, OLED_WHITE);',
				'text_oled(4, 13, OLED_FONT_SMALL, SettingsCursor == 0 ? OLED_BLACK : OLED_WHITE, "Option 1");',
				'text_oled(100, 13, OLED_FONT_SMALL, SettingsCursor == 0 ? OLED_BLACK : OLED_WHITE, Setting1 ? "ON" : "OFF");',
				'',
				'if(SettingsCursor == 1) rect_oled(0, 28, 127, 40, OLED_WHITE);',
				'text_oled(4, 29, OLED_FONT_SMALL, SettingsCursor == 1 ? OLED_BLACK : OLED_WHITE, "Option 2");',
				'text_oled(100, 29, OLED_FONT_SMALL, SettingsCursor == 1 ? OLED_BLACK : OLED_WHITE, Setting2 ? "ON" : "OFF");',
				'',
				'if(event_press(DOWN_BTN)) SettingsCursor = (SettingsCursor + 1) % 2;',
				'if(event_press(UP_BTN)) SettingsCursor = (SettingsCursor + 1) % 2;',
				'if(event_press(CONFIRM_BTN)) {',
				'    if(SettingsCursor == 0) Setting1 = !Setting1;',
				'    if(SettingsCursor == 1) Setting2 = !Setting2;',
				'}',
			].join('\n'),
			onEnter: 'SettingsCursor = 0;',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Back',
				condition: { type: 'button_press', button: 'CANCEL_BTN' },
				direction: 'outgoing',
			},
		],
		parameters: [],
		createdAt: 0,
		updatedAt: 0,
	},
	{
		id: 'builtin-screensaver',
		name: 'Screensaver',
		description: 'A simple screensaver state that activates after idle timeout and wakes on any button.',
		category: 'screensaver',
		tags: ['screensaver', 'idle', 'sleep'],
		nodeTemplate: {
			type: 'screensaver',
			label: 'Screensaver',
			variables: [
				{ name: 'ScreenSaverX', type: 'int', defaultValue: 0, persist: false },
				{ name: 'ScreenSaverY', type: 'int', defaultValue: 0, persist: false },
			],
			gpcCode: [
				'cls_oled(OLED_BLACK);',
				'// Moving dot screensaver',
				'ScreenSaverX = (ScreenSaverX + 3) % 128;',
				'ScreenSaverY = (ScreenSaverY + 2) % 64;',
				'pixel_oled(ScreenSaverX, ScreenSaverY, 1);',
			].join('\n'),
			onEnter: '',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Wake',
				condition: { type: 'custom', customCode: 'event_press(CONFIRM_BTN) || event_press(CANCEL_BTN)' },
				direction: 'outgoing',
			},
		],
		parameters: [],
		createdAt: 0,
		updatedAt: 0,
	},
	{
		id: 'builtin-splash-timed',
		name: 'Splash Screen',
		description: 'A timed splash screen showing a title and subtitle, then auto-transitions.',
		category: 'intro',
		tags: ['splash', 'title', 'intro'],
		nodeTemplate: {
			type: 'intro',
			label: 'Splash',
			gpcCode: [
				'cls_oled(OLED_BLACK);',
				'// Border',
				'rect_oled(0, 0, 127, 63, OLED_WHITE);',
				'rect_oled(2, 2, 125, 61, OLED_WHITE);',
				'// Title',
				'text_oled(20, 20, OLED_FONT_MED_NUMBERS, OLED_WHITE, "MY SCRIPT");',
				'// Subtitle',
				'text_oled(35, 40, OLED_FONT_SMALL, OLED_WHITE, "v1.0");',
			].join('\n'),
			onEnter: '',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Timeout',
				condition: { type: 'timeout', timeoutMs: 2000 },
				direction: 'outgoing',
			},
			{
				label: 'Skip',
				condition: { type: 'button_press', button: 'CONFIRM_BTN' },
				direction: 'outgoing',
			},
		],
		parameters: [
			{
				key: 'timeoutMs',
				label: 'Duration (ms)',
				type: 'number',
				defaultValue: '2000',
				description: 'How long to show the splash',
			},
		],
		createdAt: 0,
		updatedAt: 0,
	},
	{
		id: 'builtin-home-status',
		name: 'Home / Status Screen',
		description: 'A home/status screen showing the current state of toggles, with menu button access.',
		category: 'home',
		tags: ['home', 'status', 'main'],
		nodeTemplate: {
			type: 'home',
			label: 'Home',
			gpcCode: [
				'cls_oled(OLED_BLACK);',
				'text_oled(4, 0, OLED_FONT_SMALL, OLED_WHITE, "HOME");',
				'line_oled(0, 9, 127, 9, OLED_WHITE);',
				'text_oled(4, 20, OLED_FONT_SMALL, OLED_WHITE, "Status: Active");',
				'text_oled(4, 50, OLED_FONT_SMALL, OLED_WHITE, "Press CONFIRM for menu");',
			].join('\n'),
			onEnter: '',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Open Menu',
				condition: { type: 'button_press', button: 'CONFIRM_BTN' },
				direction: 'outgoing',
			},
		],
		parameters: [],
		createdAt: 0,
		updatedAt: 0,
	},
];

export function getBuiltinChunk(id: string): FlowChunk | undefined {
	return BUILTIN_CHUNKS.find((c) => c.id === id);
}

export function getChunksByCategory(chunks: FlowChunk[]): Record<string, FlowChunk[]> {
	const grouped: Record<string, FlowChunk[]> = {};
	for (const chunk of chunks) {
		const cat = chunk.category || 'uncategorized';
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(chunk);
	}
	return grouped;
}
