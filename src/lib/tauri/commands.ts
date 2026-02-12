import { invoke } from '@tauri-apps/api/core';
import type { GameConfig, GameSummary } from '$lib/types/config';
import type { ModuleSummary, ModuleDefinition } from '$lib/types/module';

export async function listGames(workspacePaths?: string[]): Promise<GameSummary[]> {
	return invoke<GameSummary[]>('list_games', { workspacePaths: workspacePaths ?? null });
}

export async function getGameConfig(gamePath: string): Promise<GameConfig> {
	return invoke<GameConfig>('get_game_config', { gamePath });
}

export async function getAppRoot(): Promise<string> {
	return invoke<string>('get_app_root');
}

export async function deleteGame(gamePath: string): Promise<void> {
	return invoke<void>('delete_game', { gamePath });
}

export async function listModules(moduleType?: string, workspacePaths?: string[]): Promise<ModuleSummary[]> {
	return invoke<ModuleSummary[]>('list_modules', {
		moduleType: moduleType ?? null,
		workspacePaths: workspacePaths ?? null
	});
}

export async function listAvailableModules(gamePath: string, workspacePaths?: string[]): Promise<ModuleSummary[]> {
	return invoke<ModuleSummary[]>('list_available_modules', {
		gamePath,
		workspacePaths: workspacePaths ?? null
	});
}

export async function getModule(moduleId: string, workspacePaths?: string[]): Promise<ModuleDefinition> {
	return invoke<ModuleDefinition>('get_module', {
		moduleId,
		workspacePaths: workspacePaths ?? null
	});
}

export async function validateModuleSelection(moduleIds: string[], workspacePaths?: string[]): Promise<string[]> {
	return invoke<string[]>('validate_module_selection', {
		moduleIds,
		workspacePaths: workspacePaths ?? null
	});
}

// === User Module Commands ===

export async function saveUserModule(workspacePath: string, moduleToml: string): Promise<string> {
	return invoke<string>('save_user_module', { workspacePath, moduleToml });
}

export async function deleteUserModule(moduleId: string, workspacePaths?: string[]): Promise<void> {
	return invoke<void>('delete_user_module', {
		moduleId,
		workspacePaths: workspacePaths ?? null
	});
}

export interface CreateGameParams {
	name: string;
	display_name?: string;
	username?: string;
	game_type: string;
	version: number;
	profiles: number;
	module_ids: string[];
	module_params: Record<string, Record<string, string>>;
	quick_toggles: Record<string, string>;
	weapon_names: string[];
	workspace_path?: string;
}

export interface CreateGameResult {
	game_path: string;
	config_path: string;
	files_created: string[];
}

export async function createGame(params: CreateGameParams): Promise<CreateGameResult> {
	return invoke<CreateGameResult>('create_game', { params });
}

// === Build Commands ===

export interface BuildResult {
	output_path: string;
	success: boolean;
	errors: string[];
	warnings: string[];
}

export async function buildGame(gamePath: string): Promise<BuildResult> {
	return invoke<BuildResult>('build_game_cmd', { gamePath });
}

export async function getBuildOutputPath(gamePath: string): Promise<string> {
	return invoke<string>('get_build_output_path', { gamePath });
}

// === Config Commands ===

export async function saveGameConfig(gamePath: string, config: GameConfig): Promise<void> {
	return invoke<void>('save_game_config', { gamePath, config });
}

// === File Commands ===

export async function readFile(path: string): Promise<string> {
	return invoke<string>('read_file', { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
	return invoke<void>('write_file', { path, content });
}

export interface FileTreeEntry {
	name: string;
	path: string;
	is_dir: boolean;
	children?: FileTreeEntry[];
}

export async function readFileTree(path: string): Promise<FileTreeEntry[]> {
	return invoke<FileTreeEntry[]>('read_file_tree', { path });
}

export async function createStandaloneFile(gamePath: string, filename: string): Promise<string> {
	return invoke<string>('create_standalone_file', { gamePath, filename });
}

export async function deleteFile(filePath: string): Promise<void> {
	return invoke<void>('delete_file', { filePath });
}

export async function regenerateFile(gamePath: string, filePath: string): Promise<string> {
	return invoke<string>('regenerate_file', { gamePath, filePath });
}

export async function regenerateAll(gamePath: string): Promise<string[]> {
	return invoke<string[]>('regenerate_all', { gamePath });
}

// === Add Module Commands ===

export interface AddModuleParams {
	module_id: string;
	module_params?: Record<string, string>;
	quick_toggle_key?: string;
	weapon_names?: string[];
}

export interface AddModuleResult {
	success: boolean;
	messages: string[];
	files_modified: string[];
}

export async function addModule(
	gamePath: string,
	params: AddModuleParams
): Promise<AddModuleResult> {
	return invoke<AddModuleResult>('add_module', { gamePath, params });
}

// === File Watcher Commands ===

export async function watchDirectory(path: string): Promise<void> {
	return invoke<void>('watch_directory', { path });
}

export async function unwatchDirectory(): Promise<void> {
	return invoke<void>('unwatch_directory');
}

// === Workspace Commands ===

export async function pickWorkspaceDirectory(): Promise<string | null> {
	return invoke<string | null>('pick_workspace_directory');
}

export async function getDefaultWorkspace(): Promise<string> {
	return invoke<string>('get_default_workspace');
}

// === Template Commands ===

export interface TemplateFile {
	name: string;
	path: string;
	category: string;
	description: string;
	size: number;
}

export async function listTemplates(): Promise<TemplateFile[]> {
	return invoke<TemplateFile[]>('list_templates');
}

export async function readTemplate(templatePath: string): Promise<string> {
	return invoke<string>('read_template', { templatePath });
}

export async function importTemplate(
	gamePath: string,
	templatePath: string,
	targetFilename?: string
): Promise<string> {
	return invoke<string>('import_template', {
		gamePath,
		templatePath,
		targetFilename: targetFilename ?? null
	});
}

// === Opener Commands ===

export async function openInDefaultApp(path: string): Promise<void> {
	const { openPath } = await import('@tauri-apps/plugin-opener');
	return openPath(path);
}
