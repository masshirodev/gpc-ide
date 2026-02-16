const BOTTOM_PANEL_STORAGE_KEY = 'gpc-ide-bottom-panel';
const BOTTOM_PANEL_MIN_HEIGHT = 100;
const BOTTOM_PANEL_MAX_HEIGHT = 500;
const BOTTOM_PANEL_DEFAULT_HEIGHT = 200;

export type BottomPanelTab = 'problems' | 'logs';

interface BottomPanelState {
	open: boolean;
	height: number;
	activeTab: BottomPanelTab;
}

interface FileNavRequest {
	path: string;
	line: number;
	column: number;
}

interface UiStore {
	sidebarCollapsed: boolean;
	bottomPanel: BottomPanelState;
	fileNavRequest: FileNavRequest | null;
}

function loadBottomPanelState(): BottomPanelState {
	try {
		const raw = localStorage.getItem(BOTTOM_PANEL_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				open: parsed.open ?? false,
				height: Math.min(
					Math.max(parsed.height ?? BOTTOM_PANEL_DEFAULT_HEIGHT, BOTTOM_PANEL_MIN_HEIGHT),
					BOTTOM_PANEL_MAX_HEIGHT
				),
				activeTab: parsed.activeTab ?? 'problems'
			};
		}
	} catch {
		// ignore
	}
	return { open: false, height: BOTTOM_PANEL_DEFAULT_HEIGHT, activeTab: 'problems' };
}

function saveBottomPanelState(state: BottomPanelState) {
	try {
		localStorage.setItem(
			BOTTOM_PANEL_STORAGE_KEY,
			JSON.stringify({ open: state.open, height: state.height, activeTab: state.activeTab })
		);
	} catch {
		// ignore
	}
}

let store = $state<UiStore>({
	sidebarCollapsed: true,
	bottomPanel: loadBottomPanelState(),
	fileNavRequest: null
});

export function getUiStore() {
	return store;
}

// Sidebar

export function toggleSidebar() {
	store.sidebarCollapsed = !store.sidebarCollapsed;
}

export function setSidebarCollapsed(collapsed: boolean) {
	store.sidebarCollapsed = collapsed;
}

// Bottom panel

export function toggleBottomPanel() {
	store.bottomPanel.open = !store.bottomPanel.open;
	saveBottomPanelState(store.bottomPanel);
}

export function setBottomPanelOpen(open: boolean) {
	store.bottomPanel.open = open;
	saveBottomPanelState(store.bottomPanel);
}

export function setBottomPanelHeight(height: number) {
	store.bottomPanel.height = Math.min(
		Math.max(height, BOTTOM_PANEL_MIN_HEIGHT),
		BOTTOM_PANEL_MAX_HEIGHT
	);
	saveBottomPanelState(store.bottomPanel);
}

export function setBottomPanelActiveTab(tab: BottomPanelTab) {
	store.bottomPanel.activeTab = tab;
	saveBottomPanelState(store.bottomPanel);
}

// File navigation

export function requestFileNavigation(path: string, line: number, column: number) {
	store.fileNavRequest = { path, line, column };
}

export function consumeFileNavigation(): FileNavRequest | null {
	const req = store.fileNavRequest;
	if (req) {
		store.fileNavRequest = null;
	}
	return req;
}
