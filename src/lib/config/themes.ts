// Editor themes configuration
// This mirrors the themes.toml file for easy editing

export interface ThemeInfo {
	id: string;
	name: string;
	description: string;
	base: 'vs' | 'vs-dark' | 'hc-black';
}

export const themes: ThemeInfo[] = [
	{
		id: 'gpc-dark',
		name: 'GPC Dark (Custom)',
		description: 'Custom dark theme optimized for GPC syntax',
		base: 'vs-dark'
	},
	{
		id: 'vs-dark',
		name: 'VS Dark (Default)',
		description: 'Visual Studio Code dark theme',
		base: 'vs-dark'
	},
	{
		id: 'vs-light',
		name: 'VS Light',
		description: 'Visual Studio Code light theme',
		base: 'vs'
	},
	{
		id: 'hc-black',
		name: 'High Contrast',
		description: 'High contrast black theme for accessibility',
		base: 'hc-black'
	},
	{
		id: 'atom-one-dark',
		name: 'Atom One Dark',
		description: 'Atom editor inspired dark theme with muted blues and purples',
		base: 'vs-dark'
	},
	{
		id: 'monokai',
		name: 'Monokai',
		description: 'Classic Monokai theme with vibrant pinks, greens, and yellows',
		base: 'vs-dark'
	},
	{
		id: 'kanagawa',
		name: 'Kanagawa',
		description: 'Wave-inspired dark theme with deep indigo and warm accents',
		base: 'vs-dark'
	},
	{
		id: 'dracula',
		name: 'Dracula',
		description: 'Dark theme with vibrant purples, pinks, and greens',
		base: 'vs-dark'
	},
	{
		id: 'gruvbox-dark',
		name: 'Gruvbox Dark',
		description: 'Retro warm theme with earthy oranges, greens, and yellows',
		base: 'vs-dark'
	},
	{
		id: 'nord',
		name: 'Nord',
		description: 'Arctic-inspired theme with a cool blue palette',
		base: 'vs-dark'
	},
	{
		id: 'catppuccin-mocha',
		name: 'Catppuccin Mocha',
		description: 'Warm pastel dark theme with soothing colors',
		base: 'vs-dark'
	}
];

export function getThemeById(id: string): ThemeInfo | undefined {
	return themes.find((t) => t.id === id);
}

export function getDefaultTheme(): ThemeInfo {
	return themes[0]; // gpc-dark
}
