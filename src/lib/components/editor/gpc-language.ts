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

	// Atom One Dark
	monaco.editor.defineTheme('atom-one-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: 'c678dd' },
			{ token: 'keyword.declaration', foreground: 'c678dd', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: '828997', fontStyle: 'italic' },
			{ token: 'type', foreground: 'e5c07b' },
			{ token: 'support.function', foreground: '61afef' },
			{ token: 'identifier', foreground: 'e06c75' },
			{ token: 'constant.boolean', foreground: 'd19a66' },
			{ token: 'constant.controller', foreground: 'd19a66' },
			{ token: 'constant.key', foreground: 'd19a66' },
			{ token: 'constant.oled', foreground: 'd19a66' },
			{ token: 'constant.pvar', foreground: 'd19a66' },
			{ token: 'constant.ascii', foreground: 'd19a66' },
			{ token: 'constant.polar', foreground: 'd19a66' },
			{ token: 'constant.analog', foreground: 'd19a66' },
			{ token: 'constant.trace', foreground: 'd19a66' },
			{ token: 'constant.rumble', foreground: 'd19a66' },
			{ token: 'constant.led', foreground: 'd19a66' },
			{ token: 'constant.player', foreground: 'd19a66' },
			{ token: 'constant.bitmask', foreground: 'd19a66' },
			{ token: 'number', foreground: 'd19a66' },
			{ token: 'number.hex', foreground: 'd19a66' },
			{ token: 'string', foreground: '98c379' },
			{ token: 'string.escape', foreground: '56b6c2' },
			{ token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
			{ token: 'operator', foreground: '56b6c2' },
			{ token: 'delimiter', foreground: 'abb2bf' }
		],
		colors: {
			'editor.background': '#282c34',
			'editor.foreground': '#abb2bf',
			'editor.lineHighlightBackground': '#2c313c',
			'editor.selectionBackground': '#3e4451',
			'editorCursor.foreground': '#528bff',
			'editorLineNumber.foreground': '#495162',
			'editorLineNumber.activeForeground': '#abb2bf'
		}
	});

	// Monokai
	monaco.editor.defineTheme('monokai', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: 'f92672' },
			{ token: 'keyword.declaration', foreground: '66d9ef', fontStyle: 'bold italic' },
			{ token: 'keyword.preprocessor', foreground: 'f92672', fontStyle: 'italic' },
			{ token: 'type', foreground: '66d9ef', fontStyle: 'italic' },
			{ token: 'support.function', foreground: 'a6e22e' },
			{ token: 'identifier', foreground: 'f8f8f2' },
			{ token: 'constant.boolean', foreground: 'ae81ff' },
			{ token: 'constant.controller', foreground: 'ae81ff' },
			{ token: 'constant.key', foreground: 'ae81ff' },
			{ token: 'constant.oled', foreground: 'ae81ff' },
			{ token: 'constant.pvar', foreground: 'ae81ff' },
			{ token: 'constant.ascii', foreground: 'ae81ff' },
			{ token: 'constant.polar', foreground: 'ae81ff' },
			{ token: 'constant.analog', foreground: 'ae81ff' },
			{ token: 'constant.trace', foreground: 'ae81ff' },
			{ token: 'constant.rumble', foreground: 'ae81ff' },
			{ token: 'constant.led', foreground: 'ae81ff' },
			{ token: 'constant.player', foreground: 'ae81ff' },
			{ token: 'constant.bitmask', foreground: 'ae81ff' },
			{ token: 'number', foreground: 'ae81ff' },
			{ token: 'number.hex', foreground: 'ae81ff' },
			{ token: 'string', foreground: 'e6db74' },
			{ token: 'string.escape', foreground: 'ae81ff' },
			{ token: 'comment', foreground: '75715e', fontStyle: 'italic' },
			{ token: 'operator', foreground: 'f92672' },
			{ token: 'delimiter', foreground: 'f8f8f2' }
		],
		colors: {
			'editor.background': '#272822',
			'editor.foreground': '#f8f8f2',
			'editor.lineHighlightBackground': '#3e3d32',
			'editor.selectionBackground': '#49483e',
			'editorCursor.foreground': '#f8f8f0',
			'editorLineNumber.foreground': '#90908a',
			'editorLineNumber.activeForeground': '#c2c2bf'
		}
	});

	// Kanagawa
	monaco.editor.defineTheme('kanagawa', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: '957fb8' },
			{ token: 'keyword.declaration', foreground: '957fb8', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: 'e46876', fontStyle: 'italic' },
			{ token: 'type', foreground: '7aa89f' },
			{ token: 'support.function', foreground: '7e9cd8' },
			{ token: 'identifier', foreground: 'dcd7ba' },
			{ token: 'constant.boolean', foreground: 'ffa066' },
			{ token: 'constant.controller', foreground: 'ffa066' },
			{ token: 'constant.key', foreground: 'e6c384' },
			{ token: 'constant.oled', foreground: 'd27e99' },
			{ token: 'constant.pvar', foreground: 'd27e99' },
			{ token: 'constant.ascii', foreground: 'ffa066' },
			{ token: 'constant.polar', foreground: 'ffa066' },
			{ token: 'constant.analog', foreground: 'ffa066' },
			{ token: 'constant.trace', foreground: 'ffa066' },
			{ token: 'constant.rumble', foreground: 'ffa066' },
			{ token: 'constant.led', foreground: 'ffa066' },
			{ token: 'constant.player', foreground: 'ffa066' },
			{ token: 'constant.bitmask', foreground: 'ffa066' },
			{ token: 'number', foreground: 'd27e99' },
			{ token: 'number.hex', foreground: 'd27e99' },
			{ token: 'string', foreground: '98bb6c' },
			{ token: 'string.escape', foreground: 'e6c384' },
			{ token: 'comment', foreground: '727169', fontStyle: 'italic' },
			{ token: 'operator', foreground: 'c0a36e' },
			{ token: 'delimiter', foreground: '9a9a93' }
		],
		colors: {
			'editor.background': '#1f1f28',
			'editor.foreground': '#dcd7ba',
			'editor.lineHighlightBackground': '#2a2a37',
			'editor.selectionBackground': '#2d4f67',
			'editorCursor.foreground': '#c8c093',
			'editorLineNumber.foreground': '#54546d',
			'editorLineNumber.activeForeground': '#c8c093'
		}
	});

	// Dracula
	monaco.editor.defineTheme('dracula', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: 'ff79c6' },
			{ token: 'keyword.declaration', foreground: 'ff79c6', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: 'ff79c6', fontStyle: 'italic' },
			{ token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
			{ token: 'support.function', foreground: '50fa7b' },
			{ token: 'identifier', foreground: 'f8f8f2' },
			{ token: 'constant.boolean', foreground: 'bd93f9' },
			{ token: 'constant.controller', foreground: 'bd93f9' },
			{ token: 'constant.key', foreground: 'bd93f9' },
			{ token: 'constant.oled', foreground: 'bd93f9' },
			{ token: 'constant.pvar', foreground: 'bd93f9' },
			{ token: 'constant.ascii', foreground: 'bd93f9' },
			{ token: 'constant.polar', foreground: 'bd93f9' },
			{ token: 'constant.analog', foreground: 'bd93f9' },
			{ token: 'constant.trace', foreground: 'bd93f9' },
			{ token: 'constant.rumble', foreground: 'bd93f9' },
			{ token: 'constant.led', foreground: 'bd93f9' },
			{ token: 'constant.player', foreground: 'bd93f9' },
			{ token: 'constant.bitmask', foreground: 'bd93f9' },
			{ token: 'number', foreground: 'bd93f9' },
			{ token: 'number.hex', foreground: 'bd93f9' },
			{ token: 'string', foreground: 'f1fa8c' },
			{ token: 'string.escape', foreground: 'ff79c6' },
			{ token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
			{ token: 'operator', foreground: 'ff79c6' },
			{ token: 'delimiter', foreground: 'f8f8f2' }
		],
		colors: {
			'editor.background': '#282a36',
			'editor.foreground': '#f8f8f2',
			'editor.lineHighlightBackground': '#44475a',
			'editor.selectionBackground': '#44475a',
			'editorCursor.foreground': '#f8f8f2',
			'editorLineNumber.foreground': '#6272a4',
			'editorLineNumber.activeForeground': '#f8f8f2'
		}
	});

	// Gruvbox Dark
	monaco.editor.defineTheme('gruvbox-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: 'fb4934' },
			{ token: 'keyword.declaration', foreground: 'fb4934', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: '8ec07c', fontStyle: 'italic' },
			{ token: 'type', foreground: 'fabd2f' },
			{ token: 'support.function', foreground: '8ec07c' },
			{ token: 'identifier', foreground: 'ebdbb2' },
			{ token: 'constant.boolean', foreground: 'd3869b' },
			{ token: 'constant.controller', foreground: 'd3869b' },
			{ token: 'constant.key', foreground: 'd3869b' },
			{ token: 'constant.oled', foreground: 'd3869b' },
			{ token: 'constant.pvar', foreground: 'd3869b' },
			{ token: 'constant.ascii', foreground: 'd3869b' },
			{ token: 'constant.polar', foreground: 'd3869b' },
			{ token: 'constant.analog', foreground: 'd3869b' },
			{ token: 'constant.trace', foreground: 'd3869b' },
			{ token: 'constant.rumble', foreground: 'd3869b' },
			{ token: 'constant.led', foreground: 'd3869b' },
			{ token: 'constant.player', foreground: 'd3869b' },
			{ token: 'constant.bitmask', foreground: 'd3869b' },
			{ token: 'number', foreground: 'd3869b' },
			{ token: 'number.hex', foreground: 'd3869b' },
			{ token: 'string', foreground: 'b8bb26' },
			{ token: 'string.escape', foreground: 'fe8019' },
			{ token: 'comment', foreground: '928374', fontStyle: 'italic' },
			{ token: 'operator', foreground: '8ec07c' },
			{ token: 'delimiter', foreground: 'ebdbb2' }
		],
		colors: {
			'editor.background': '#282828',
			'editor.foreground': '#ebdbb2',
			'editor.lineHighlightBackground': '#3c3836',
			'editor.selectionBackground': '#504945',
			'editorCursor.foreground': '#ebdbb2',
			'editorLineNumber.foreground': '#665c54',
			'editorLineNumber.activeForeground': '#a89984'
		}
	});

	// Nord
	monaco.editor.defineTheme('nord', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: '81a1c1' },
			{ token: 'keyword.declaration', foreground: '81a1c1', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: '5e81ac', fontStyle: 'italic' },
			{ token: 'type', foreground: '8fbcbb' },
			{ token: 'support.function', foreground: '88c0d0' },
			{ token: 'identifier', foreground: 'd8dee9' },
			{ token: 'constant.boolean', foreground: '81a1c1' },
			{ token: 'constant.controller', foreground: 'd08770' },
			{ token: 'constant.key', foreground: 'd08770' },
			{ token: 'constant.oled', foreground: 'b48ead' },
			{ token: 'constant.pvar', foreground: 'b48ead' },
			{ token: 'constant.ascii', foreground: 'd08770' },
			{ token: 'constant.polar', foreground: 'd08770' },
			{ token: 'constant.analog', foreground: 'd08770' },
			{ token: 'constant.trace', foreground: 'd08770' },
			{ token: 'constant.rumble', foreground: 'd08770' },
			{ token: 'constant.led', foreground: 'd08770' },
			{ token: 'constant.player', foreground: 'd08770' },
			{ token: 'constant.bitmask', foreground: 'd08770' },
			{ token: 'number', foreground: 'b48ead' },
			{ token: 'number.hex', foreground: 'b48ead' },
			{ token: 'string', foreground: 'a3be8c' },
			{ token: 'string.escape', foreground: 'ebcb8b' },
			{ token: 'comment', foreground: '616e88', fontStyle: 'italic' },
			{ token: 'operator', foreground: '81a1c1' },
			{ token: 'delimiter', foreground: 'eceff4' }
		],
		colors: {
			'editor.background': '#2e3440',
			'editor.foreground': '#d8dee9',
			'editor.lineHighlightBackground': '#3b4252',
			'editor.selectionBackground': '#434c5e',
			'editorCursor.foreground': '#d8dee9',
			'editorLineNumber.foreground': '#4c566a',
			'editorLineNumber.activeForeground': '#d8dee9'
		}
	});

	// Catppuccin Mocha
	monaco.editor.defineTheme('catppuccin-mocha', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'keyword', foreground: 'cba6f7' },
			{ token: 'keyword.declaration', foreground: 'cba6f7', fontStyle: 'bold' },
			{ token: 'keyword.preprocessor', foreground: 'f38ba8', fontStyle: 'italic' },
			{ token: 'type', foreground: 'f9e2af' },
			{ token: 'support.function', foreground: '89b4fa' },
			{ token: 'identifier', foreground: 'cdd6f4' },
			{ token: 'constant.boolean', foreground: 'fab387' },
			{ token: 'constant.controller', foreground: 'fab387' },
			{ token: 'constant.key', foreground: 'fab387' },
			{ token: 'constant.oled', foreground: 'f5c2e7' },
			{ token: 'constant.pvar', foreground: 'f5c2e7' },
			{ token: 'constant.ascii', foreground: 'fab387' },
			{ token: 'constant.polar', foreground: 'fab387' },
			{ token: 'constant.analog', foreground: 'fab387' },
			{ token: 'constant.trace', foreground: 'fab387' },
			{ token: 'constant.rumble', foreground: 'fab387' },
			{ token: 'constant.led', foreground: 'fab387' },
			{ token: 'constant.player', foreground: 'fab387' },
			{ token: 'constant.bitmask', foreground: 'fab387' },
			{ token: 'number', foreground: 'fab387' },
			{ token: 'number.hex', foreground: 'fab387' },
			{ token: 'string', foreground: 'a6e3a1' },
			{ token: 'string.escape', foreground: 'f2cdcd' },
			{ token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
			{ token: 'operator', foreground: '89dceb' },
			{ token: 'delimiter', foreground: 'bac2de' }
		],
		colors: {
			'editor.background': '#1e1e2e',
			'editor.foreground': '#cdd6f4',
			'editor.lineHighlightBackground': '#313244',
			'editor.selectionBackground': '#45475a',
			'editorCursor.foreground': '#f5e0dc',
			'editorLineNumber.foreground': '#585b70',
			'editorLineNumber.activeForeground': '#a6adc8'
		}
	});
}
