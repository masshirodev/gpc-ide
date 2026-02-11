import type * as Monaco from 'monaco-editor';

export function registerGpcLanguage(monaco: typeof Monaco) {
	monaco.languages.register({ id: 'gpc', extensions: ['.gpc'] });

	monaco.languages.setMonarchTokensProvider('gpc', {
		keywords: [
			'if',
			'while',
			'else',
			'switch',
			'case',
			'default',
			'for',
			'do',
			'return',
			'break',
			'continue'
		],
		declarationKeywords: ['function', 'combo', 'init', 'main', 'enum', 'define', 'const', 'local', 'use'],
		typeKeywords: [
			'int',
			'int8',
			'int16',
			'int32',
			'uint8',
			'uint16',
			'uint32',
			'string',
			'data',
			'image',
			'ps5adt'
		],
		builtinFunctions: [
			'duint8',
			'duint16',
			'dint32',
			'dint8',
			'dint16',
			'get_val',
			'get_lval',
			'get_ptime',
			'get_controller',
			'get_battery',
			'event_press',
			'event_release',
			'get_ival',
			'get_brtime',
			'swap',
			'block',
			'sensitivity',
			'deadzone',
			'stickize',
			'ps4_touchpad',
			'ps4_set_touchpad',
			'turn_off',
			'wii_offscreen',
			'get_adt',
			'set_adt',
			'adt_off',
			'adt_cmp',
			'adt_setx',
			'addr',
			'get_rumble',
			'set_rumble',
			'block_rumble',
			'reset_rumble',
			'set_led',
			'get_led',
			'set_ledx',
			'get_ledx',
			'reset_leds',
			'get_ps4_lbar',
			'set_ps4_lbar',
			'get_keyboard',
			'get_modifiers',
			'get_rtime',
			'get_slot',
			'load_slot',
			'get_ctrlbutton',
			'vm_tctrl',
			'set_polar',
			'set_rgb',
			'set_hsb',
			'clamp',
			'get_polar',
			'get_ipolar',
			'remap',
			'unmap',
			'combo_run',
			'combo_running',
			'combo_stop',
			'combo_restart',
			'combo_suspend',
			'combo_suspended',
			'combo_current_step',
			'combo_step_time_left',
			'combo_stop_all',
			'combo_suspend_all',
			'combo_resume',
			'combo_resume_all',
			'wait',
			'call',
			'set_bit',
			'clear_bit',
			'test_bit',
			'set_bits',
			'get_bits',
			'abs',
			'inv',
			'pow',
			'isqrt',
			'random',
			'min',
			'max',
			'pixel_oled',
			'line_oled',
			'rect_oled',
			'circle_oled',
			'putc_oled',
			'puts_oled',
			'print',
			'cls_oled',
			'get_console',
			'set_val',
			'block_all_inputs',
			'get_info',
			'set_polar2',
			'sizeof',
			'get_pvar',
			'set_pvar',
			'image_oled'
		],
		booleans: ['TRUE', 'FALSE'],
		operators: [
			'+=',
			'-=',
			'*=',
			'/=',
			'%=',
			'==',
			'!=',
			'<=',
			'>=',
			'&&',
			'||',
			'<<',
			'>>',
			'++',
			'--',
			'+',
			'-',
			'*',
			'/',
			'%',
			'&',
			'|',
			'^',
			'~',
			'!',
			'<',
			'>',
			'='
		],
		tokenizer: {
			root: [
				// Comments
				[/\/\/.*$/, 'comment'],
				[/\/\*/, 'comment', '@comment'],

				// Strings
				[/"([^"\\]|\\.)*$/, 'string.invalid'],
				[/"/, 'string', '@string_double'],
				[/'([^'\\]|\\.)*$/, 'string.invalid'],
				[/'/, 'string', '@string_single'],

				// Preprocessor
				[/^\s*#\s*(include|define|ifdef|ifndef|endif|else|elif|pragma)\b/, 'keyword.preprocessor'],

				// Numbers
				[/0[xX][0-9a-fA-F]+/, 'number.hex'],
				[/\d+/, 'number'],

				// Constants - controller buttons and system variables
				[/\bPS5_[A-Z0-9_]+\b/, 'constant.controller'],
				[/\bPS4_[A-Z0-9_]+\b/, 'constant.controller'],
				[/\bPS3_[A-Z0-9_]+\b/, 'constant.controller'],
				[/\bXB1_[A-Z0-9_]+\b/, 'constant.controller'],
				[/\bXB360_[A-Z0-9_]+\b/, 'constant.controller'],
				[/\bSWI_[A-Z0-9_]+\b/, 'constant.controller'],
				[/\bKEY_[A-Z0-9_]+\b/, 'constant.key'],
				[/\bMOD_[A-Z0-9_]+\b/, 'constant.key'],
				[/\bOLED_[A-Z0-9_]+\b/, 'constant.oled'],
				[/\bSPVAR_\d+\b/, 'constant.pvar'],
				[/\bPVAR_\d+\b/, 'constant.pvar'],
				[/\bASCII_[A-Z0-9_]+\b/, 'constant.ascii'],
				[/\bPOLAR_[A-Z0-9_]+\b/, 'constant.polar'],
				[/\bANALOG_[A-Z0-9_]+\b/, 'constant.analog'],
				[/\bTRACE_[1-6]\b/, 'constant.trace'],
				[/\bRUMBLE_[A-Z]+\b/, 'constant.rumble'],
				[/\bLED[A-Z]*_[A-Z0-9_]+\b/, 'constant.led'],
				[/\bPLAYER_[1-4]\b/, 'constant.player'],
				[/\bBITMASK_\d+\b/, 'constant.bitmask'],

				// Identifiers
				[
					/[a-zA-Z_]\w*/,
					{
						cases: {
							'@booleans': 'constant.boolean',
							'@typeKeywords': 'type',
							'@declarationKeywords': 'keyword.declaration',
							'@keywords': 'keyword',
							'@builtinFunctions': 'support.function',
							'@default': 'identifier'
						}
					}
				],

				// Brackets
				[/[{}()]/, '@brackets'],
				[/[\[\]]/, '@brackets'],

				// Operators
				[/[+\-*/%&|^~!<>=]=?/, 'operator'],
				[/&&|\|\|/, 'operator'],
				[/<<|>>/, 'operator'],
				[/\+\+|--/, 'operator'],

				// Semicolons and delimiters
				[/[;,.]/, 'delimiter']
			],
			comment: [
				[/[^/*]+/, 'comment'],
				[/\*\//, 'comment', '@pop'],
				[/[/*]/, 'comment']
			],
			string_double: [
				[/[^\\"]+/, 'string'],
				[/\\./, 'string.escape'],
				[/"/, 'string', '@pop']
			],
			string_single: [
				[/[^\\']+/, 'string'],
				[/\\./, 'string.escape'],
				[/'/, 'string', '@pop']
			]
		}
	});

	monaco.languages.setLanguageConfiguration('gpc', {
		comments: {
			lineComment: '//',
			blockComment: ['/*', '*/']
		},
		brackets: [
			['{', '}'],
			['[', ']'],
			['(', ')']
		],
		autoClosingPairs: [
			{ open: '{', close: '}' },
			{ open: '[', close: ']' },
			{ open: '(', close: ')' },
			{ open: '"', close: '"', notIn: ['string'] },
			{ open: "'", close: "'", notIn: ['string'] }
		],
		surroundingPairs: [
			{ open: '{', close: '}' },
			{ open: '[', close: ']' },
			{ open: '(', close: ')' },
			{ open: '"', close: '"' },
			{ open: "'", close: "'" }
		],
		indentationRules: {
			increaseIndentPattern: /^.*\{[^}"']*$/,
			decreaseIndentPattern: /^\s*\}/
		}
	});

	monaco.editor.defineTheme('gpc-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: 'c586c0' },
			{ token: 'keyword.declaration', foreground: '569cd6', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: '9b9b9b', fontStyle: 'italic' },
			{ token: 'type', foreground: '4ec9b0' },
			{ token: 'support.function', foreground: 'dcdcaa' },
			{ token: 'identifier', foreground: '9cdcfe' },
			{ token: 'constant.boolean', foreground: '569cd6' },
			{ token: 'constant.controller', foreground: 'ce9178' },
			{ token: 'constant.key', foreground: 'd7ba7d' },
			{ token: 'constant.oled', foreground: 'b5cea8' },
			{ token: 'constant.pvar', foreground: 'b5cea8' },
			{ token: 'constant.ascii', foreground: 'ce9178' },
			{ token: 'constant.polar', foreground: 'ce9178' },
			{ token: 'constant.analog', foreground: 'ce9178' },
			{ token: 'constant.trace', foreground: 'ce9178' },
			{ token: 'constant.rumble', foreground: 'ce9178' },
			{ token: 'constant.led', foreground: 'ce9178' },
			{ token: 'constant.player', foreground: 'ce9178' },
			{ token: 'constant.bitmask', foreground: 'ce9178' },
			{ token: 'number', foreground: 'b5cea8' },
			{ token: 'number.hex', foreground: 'b5cea8' },
			{ token: 'string', foreground: 'ce9178' },
			{ token: 'string.escape', foreground: 'd7ba7d' },
			{ token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
			{ token: 'operator', foreground: 'd4d4d4' },
			{ token: 'delimiter', foreground: 'd4d4d4' }
		],
		colors: {
			'editor.background': '#0a0a0a',
			'editor.foreground': '#d4d4d4',
			'editor.lineHighlightBackground': '#1a1a1a',
			'editor.selectionBackground': '#264f78',
			'editorCursor.foreground': '#10b981',
			'editorLineNumber.foreground': '#404040',
			'editorLineNumber.activeForeground': '#737373'
		}
	});
}
