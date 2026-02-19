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
	console_type?: string;
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

export async function buildGame(gamePath: string, workspacePath?: string): Promise<BuildResult> {
	return invoke<BuildResult>('build_game_cmd', {
		gamePath,
		workspacePath: workspacePath ?? null
	});
}

export async function getBuildOutputPath(gamePath: string, workspacePath?: string): Promise<string> {
	return invoke<string>('get_build_output_path', {
		gamePath,
		workspacePath: workspacePath ?? null
	});
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

export interface FileDiff {
	path: string;
	old_content: string;
	new_content: string;
}

export async function regeneratePreview(gamePath: string): Promise<FileDiff[]> {
	return invoke<FileDiff[]>('regenerate_preview', { gamePath });
}

export async function regenerateCommit(
	gamePath: string,
	files: { path: string; content: string }[]
): Promise<string[]> {
	return invoke<string[]>('regenerate_commit', { gamePath, files });
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
	params: AddModuleParams,
	workspacePaths?: string[]
): Promise<AddModuleResult> {
	return invoke<AddModuleResult>('add_module', {
		gamePath,
		params,
		workspacePaths: workspacePaths ?? null
	});
}

// === File Watcher Commands ===

export async function watchDirectory(path: string): Promise<void> {
	return invoke<void>('watch_directory', { path });
}

export async function watchWorkspaces(paths: string[]): Promise<void> {
	return invoke<void>('watch_workspaces', { paths });
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

// === Search Commands ===

export interface SearchMatch {
	line_number: number;
	line_content: string;
	match_start: number;
	match_end: number;
}

export interface SearchFileResult {
	path: string;
	matches: SearchMatch[];
}

export async function searchInFiles(
	directory: string,
	query: string,
	caseSensitive: boolean,
	useRegex: boolean
): Promise<SearchFileResult[]> {
	return invoke<SearchFileResult[]>('search_in_files', {
		directory,
		query,
		caseSensitive,
		useRegex
	});
}

export async function replaceInFile(
	path: string,
	query: string,
	replacement: string,
	caseSensitive: boolean,
	useRegex: boolean
): Promise<number> {
	return invoke<number>('replace_in_file', {
		path,
		query,
		replacement,
		caseSensitive,
		useRegex
	});
}

// === Plugin Commands ===

export interface PluginHooks {
	pre_build?: string;
	post_build?: string;
	includes?: string[];
	extra_vars?: Record<string, string>;
	extra_defines?: Record<string, string>;
}

export interface PluginManifest {
	id: string;
	name: string;
	version: string;
	description?: string;
	author?: string;
	homepage?: string;
	hooks: PluginHooks;
}

export interface PluginInfo {
	manifest: PluginManifest;
	path: string;
	enabled: boolean;
}

export async function listPlugins(workspacePaths?: string[]): Promise<PluginInfo[]> {
	return invoke<PluginInfo[]>('list_plugins', { workspacePaths: workspacePaths ?? null });
}

export async function togglePlugin(workspacePath: string, pluginId: string, enabled: boolean): Promise<void> {
	return invoke<void>('toggle_plugin', { workspacePath, pluginId, enabled });
}

export async function readPluginFile(pluginPath: string, fileName: string): Promise<string> {
	return invoke<string>('read_plugin_file', { pluginPath, fileName });
}

export async function createPlugin(
	workspacePath: string,
	pluginId: string,
	pluginName: string,
	description?: string
): Promise<string> {
	return invoke<string>('create_plugin', {
		workspacePath,
		pluginId,
		pluginName,
		description: description ?? null
	});
}

export async function deletePlugin(pluginPath: string): Promise<void> {
	return invoke<void>('delete_plugin', { pluginPath });
}

// === History Commands ===

export interface SnapshotMeta {
	id: string;
	timestamp: number;
	label: string | null;
}

export async function createSnapshot(gamePath: string, label?: string): Promise<SnapshotMeta> {
	return invoke<SnapshotMeta>('create_snapshot', { gamePath, label: label ?? null });
}

export async function listSnapshots(gamePath: string): Promise<SnapshotMeta[]> {
	return invoke<SnapshotMeta[]>('list_snapshots', { gamePath });
}

export async function getSnapshot(gamePath: string, snapshotId: string): Promise<string> {
	return invoke<string>('get_snapshot', { gamePath, snapshotId });
}

export async function rollbackSnapshot(gamePath: string, snapshotId: string): Promise<SnapshotMeta> {
	return invoke<SnapshotMeta>('rollback_snapshot', { gamePath, snapshotId });
}

export async function deleteSnapshot(gamePath: string, snapshotId: string): Promise<void> {
	return invoke<void>('delete_snapshot', { gamePath, snapshotId });
}

export async function renameSnapshot(gamePath: string, snapshotId: string, label: string): Promise<void> {
	return invoke<void>('rename_snapshot', { gamePath, snapshotId, label });
}

// === Opener Commands ===

export async function openInDefaultApp(path: string): Promise<void> {
	const { openPath } = await import('@tauri-apps/plugin-opener');
	return openPath(path);
}
