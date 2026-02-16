import { searchInFiles, type SearchFileResult } from '$lib/tauri/commands';

interface SearchStore {
	query: string;
	replacement: string;
	caseSensitive: boolean;
	useRegex: boolean;
	results: SearchFileResult[];
	searching: boolean;
	totalMatches: number;
}

let store = $state<SearchStore>({
	query: '',
	replacement: '',
	caseSensitive: false,
	useRegex: false,
	results: [],
	searching: false,
	totalMatches: 0
});

export function getSearchStore() {
	return store;
}

export async function performSearch(directory: string) {
	if (!store.query.trim()) {
		store.results = [];
		store.totalMatches = 0;
		return;
	}

	store.searching = true;
	try {
		const results = await searchInFiles(
			directory,
			store.query,
			store.caseSensitive,
			store.useRegex
		);
		store.results = results;
		store.totalMatches = results.reduce((sum, f) => sum + f.matches.length, 0);
	} catch (e) {
		console.error('Search failed:', e);
		store.results = [];
		store.totalMatches = 0;
	} finally {
		store.searching = false;
	}
}

export function clearSearch() {
	store.query = '';
	store.replacement = '';
	store.results = [];
	store.totalMatches = 0;
}

export function setSearchQuery(query: string) {
	store.query = query;
}

export function setSearchReplacement(replacement: string) {
	store.replacement = replacement;
}

export function setSearchCaseSensitive(caseSensitive: boolean) {
	store.caseSensitive = caseSensitive;
}

export function setSearchUseRegex(useRegex: boolean) {
	store.useRegex = useRegex;
}

export function removeFileFromResults(path: string) {
	store.results = store.results.filter((f) => f.path !== path);
	store.totalMatches = store.results.reduce((sum, f) => sum + f.matches.length, 0);
}
