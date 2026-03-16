export interface ModuleSummary {
	id: string;
	display_name: string;
	module_type: string;
	description: string | null;
	quick_toggle: string[];
	param_count: number;
	option_count: number;
	conflicts: string[];
	needs_weapondata: boolean;
	is_user_module: boolean;
	flow_target: string;
	input_device: string;
}

export interface ModuleDefinition {
	display_name: string;
	id: string;
	type: string;
	description?: string;
	state_display?: string;
	status_var?: string;
	quick_toggle?: string[];
	trigger?: string;
	combo?: string;
	init_code?: string;
	functions_code?: string;
	options: ModuleOption[];
	extra_vars: Record<string, string>;
	params: ModuleParam[];
	conflicts: string[];
	menu_priority?: number;
	needs_weapondata?: boolean;
	requires_keyboard_file?: boolean;
	config_menu?: ConfigMenu;
	flow_target?: string;
	input_device?: string;
}

export interface ConfigMenu {
	name: string;
	type: string;
	render_function?: string;
	display_function?: string;
	edit_function?: string;
	profile_aware?: boolean;
	options: ModuleOption[];
}

export interface ModuleOption {
	name: string;
	var: string;
	type: string;
	default?: unknown;
	min?: number;
	max?: number;
	array_name?: string;
	array_size?: number;
	on_change_code?: string;
}

export interface ModuleParam {
	key: string;
	prompt: string;
	type: string;
	default?: string;
}

export interface ModuleFormState {
	moduleId: string;
	displayName: string;
	moduleType: string;
	flowTarget: 'gameplay' | 'data';
	inputDevice: 'controller' | 'kbm' | 'any';
	description: string;
	enableVariable: string;
	quickToggleMode: 'buttons' | 'key';
	quickToggle: string[];
	options: ModuleFormOption[];
	initCode: string;
	mainCode: string;
	functionsCode: string;
	comboCode: string;
	needsWeapondata: boolean;
	requiresKeyboardFile: boolean;
	conflicts: string[];
	extraVars: Array<{ name: string; type: string }>;
	params: Array<{ key: string; prompt: string; type: string; default: string }>;
}

export interface ModuleFormOption {
	name: string;
	variable: string;
	type: 'toggle' | 'value' | 'array';
	default: string;
	min: string;
	max: string;
	arrayName: string;
	arraySize: string;
	onChangeCode: string;
}
