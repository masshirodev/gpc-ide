export interface ModuleSummary {
	id: string;
	display_name: string;
	module_type: string;
	description: string | null;
	has_quick_toggle: boolean;
	param_count: number;
	option_count: number;
	conflicts: string[];
	needs_weapondata: boolean;
}

export interface ModuleDefinition {
	display_name: string;
	id: string;
	type: string;
	description?: string;
	state_display?: string;
	status_var?: string;
	has_quick_toggle?: boolean;
	trigger?: string;
	combo?: string;
	options: ModuleOption[];
	extra_vars: Record<string, string>;
	params: ModuleParam[];
	conflicts: string[];
	menu_priority?: number;
	needs_weapondata?: boolean;
	requires_keyboard_file?: boolean;
	config_menu?: ConfigMenu;
}

export interface ConfigMenu {
	name: string;
	type: string;
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
}

export interface ModuleParam {
	key: string;
	prompt: string;
	type: string;
	default?: string;
}
