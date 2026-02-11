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
	}
];

export function getThemeById(id: string): ThemeInfo | undefined {
	return themes.find((t) => t.id === id);
}

export function getDefaultTheme(): ThemeInfo {
	return themes[0]; // gpc-dark
}
