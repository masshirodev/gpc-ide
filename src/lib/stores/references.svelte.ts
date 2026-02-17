export interface ReferenceLocation {
	uri: string;
	path: string;
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
	linePreview: string;
}

interface ReferencesStore {
	symbol: string;
	definition: ReferenceLocation | null;
	references: ReferenceLocation[];
}

let store = $state<ReferencesStore>({
	symbol: '',
	definition: null,
	references: []
});

export function getReferencesStore() {
	return store;
}

export function setReferences(
	symbol: string,
	definition: ReferenceLocation | null,
	references: ReferenceLocation[]
) {
	store.symbol = symbol;
	store.definition = definition;
	store.references = references;
}

export function clearReferences() {
	store.symbol = '';
	store.definition = null;
	store.references = [];
}

export function getReferencesCount(): number {
	return (store.definition ? 1 : 0) + store.references.length;
}

export interface ReferencesGrouped {
	path: string;
	items: { location: ReferenceLocation; isDefinition: boolean }[];
}

export function getReferencesGrouped(): ReferencesGrouped[] {
	const map = new Map<string, { location: ReferenceLocation; isDefinition: boolean }[]>();

	if (store.definition) {
		const key = store.definition.path;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push({ location: store.definition, isDefinition: true });
	}

	for (const ref of store.references) {
		const key = ref.path;
		if (!map.has(key)) map.set(key, []);
		// Avoid duplicate if reference is same location as definition
		const items = map.get(key)!;
		const isDuplicate = items.some(
			(item) =>
				item.isDefinition && item.location.line === ref.line && item.location.column === ref.column
		);
		if (!isDuplicate) {
			items.push({ location: ref, isDefinition: false });
		}
	}

	return Array.from(map.entries())
		.map(([path, items]) => ({ path, items }))
		.sort((a, b) => a.path.localeCompare(b.path));
}
