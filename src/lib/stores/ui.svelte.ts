interface UiStore {
	sidebarCollapsed: boolean;
}

let store = $state<UiStore>({
	sidebarCollapsed: false
});

export function getUiStore() {
	return store;
}

export function toggleSidebar() {
	store.sidebarCollapsed = !store.sidebarCollapsed;
}

export function setSidebarCollapsed(collapsed: boolean) {
	store.sidebarCollapsed = collapsed;
}
