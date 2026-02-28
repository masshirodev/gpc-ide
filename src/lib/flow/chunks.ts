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
			onEnter: 'cls_oled(OLED_BLACK);',
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
			variables: [],
			gpcCode: '',
			onEnter: '',
			onExit: '',
			comboCode: '',
			stackOffsetX: 0,
			stackOffsetY: 0,
			subNodes: [
				{
					id: 'chunk-menu3-header',
					type: 'header',
					label: 'MENU',
					position: 'stack',
					order: 0,
					interactive: false,
					config: { align: 'left', font: 'default', separator: true, paddingTop: 0 },
				},
				{
					id: 'chunk-menu3-item1',
					type: 'menu-item',
					label: 'Item 1',
					position: 'stack',
					order: 1,
					interactive: true,
					config: { cursorStyle: 'invert', prefixChar: '>', prefixSpacing: 1, font: 'default' },
				},
				{
					id: 'chunk-menu3-item2',
					type: 'menu-item',
					label: 'Item 2',
					position: 'stack',
					order: 2,
					interactive: true,
					config: { cursorStyle: 'invert', prefixChar: '>', prefixSpacing: 1, font: 'default' },
				},
				{
					id: 'chunk-menu3-item3',
					type: 'menu-item',
					label: 'Item 3',
					position: 'stack',
					order: 3,
					interactive: true,
					config: { cursorStyle: 'invert', prefixChar: '>', prefixSpacing: 1, font: 'default' },
				},
			],
		},
		edgeTemplates: [
			{
				label: 'Confirm',
				condition: { type: 'button_press', button: 'PS5_CROSS' },
				direction: 'outgoing',
			},
			{
				label: 'Cancel',
				condition: { type: 'button_press', button: 'PS5_CIRCLE' },
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
				{ name: 'Setting1', type: 'int', defaultValue: 0, persist: true },
				{ name: 'Setting2', type: 'int', defaultValue: 0, persist: true },
			],
			gpcCode: '',
			onEnter: '',
			onExit: '',
			comboCode: '',
			stackOffsetX: 0,
			stackOffsetY: 0,
			subNodes: [
				{
					id: 'chunk-settings-header',
					type: 'header',
					label: 'SETTINGS',
					position: 'stack',
					order: 0,
					interactive: false,
					config: { align: 'left', font: 'default', separator: true, paddingTop: 0 },
				},
				{
					id: 'chunk-settings-toggle1',
					type: 'toggle-item',
					label: 'Option 1',
					position: 'stack',
					order: 1,
					interactive: true,
					config: { cursorStyle: 'invert', onText: 'ON', offText: 'OFF', valueAlign: 'right', font: 'default' },
					boundVariable: 'Setting1',
				},
				{
					id: 'chunk-settings-toggle2',
					type: 'toggle-item',
					label: 'Option 2',
					position: 'stack',
					order: 2,
					interactive: true,
					config: { cursorStyle: 'invert', onText: 'ON', offText: 'OFF', valueAlign: 'right', font: 'default' },
					boundVariable: 'Setting2',
				},
			],
		},
		edgeTemplates: [
			{
				label: 'Back',
				condition: { type: 'button_press', button: 'PS5_CIRCLE' },
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
				condition: { type: 'custom', customCode: 'event_press(PS5_CROSS) || event_press(PS5_CIRCLE)' },
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
				'rect_oled(0, 0, 128, 64, 0, OLED_WHITE);',
				'rect_oled(2, 2, 124, 60, 0, OLED_WHITE);',
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
				condition: { type: 'button_press', button: 'PS5_CROSS' },
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
				'line_oled(0, 9, 127, 9, 1, OLED_WHITE);',
			].join('\n'),
			onEnter: '',
			onExit: '',
			comboCode: '',
		},
		edgeTemplates: [
			{
				label: 'Open Menu',
				condition: { type: 'button_press', button: 'PS5_CROSS' },
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
