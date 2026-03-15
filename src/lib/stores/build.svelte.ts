import type { BuildResult } from '$lib/tauri/commands';

interface BuildState {
	result: BuildResult | null;
	outputContent: string | null;
	gamePath: string | null;
}

let state = $state<BuildState>({
	result: null,
	outputContent: null,
	gamePath: null
});

export function getLastBuildResult(): BuildState {
	return state;
}

export function setLastBuildResult(
	result: BuildResult,
	outputContent: string | null,
	gamePath: string
): void {
	state.result = result;
	state.outputContent = outputContent;
	state.gamePath = gamePath;
}

export function clearLastBuildResult(): void {
	state.result = null;
	state.outputContent = null;
	state.gamePath = null;
}
