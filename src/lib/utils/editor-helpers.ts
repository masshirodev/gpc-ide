// Utility functions extracted from the main page

export interface DiffLine {
	type: 'context' | 'added' | 'removed';
	text: string;
	oldNum?: number;
	newNum?: number;
}

export function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	// Myers-like diff using LCS for reasonable performance
	const result: DiffLine[] = [];
	const n = oldLines.length;
	const m = newLines.length;

	// For very large files, use a simplified approach
	if (n + m > 10000) {
		// Just show all old as removed, all new as added
		for (let i = 0; i < n; i++) {
			result.push({ type: 'removed', text: oldLines[i], oldNum: i + 1 });
		}
		for (let i = 0; i < m; i++) {
			result.push({ type: 'added', text: newLines[i], newNum: i + 1 });
		}
		return result;
	}

	// Simple O(nm) LCS-based diff
	const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
	for (let i = 1; i <= n; i++) {
		for (let j = 1; j <= m; j++) {
			if (oldLines[i - 1] === newLines[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to build diff
	const lines: DiffLine[] = [];
	let i = n,
		j = m;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
			lines.push({ type: 'context', text: oldLines[i - 1], oldNum: i, newNum: j });
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			lines.push({ type: 'added', text: newLines[j - 1], newNum: j });
			j--;
		} else {
			lines.push({ type: 'removed', text: oldLines[i - 1], oldNum: i });
			i--;
		}
	}

	return lines.reverse();
}

export interface BuildErrorLink {
	path: string;
	line?: number;
}

export function parseBuildErrorLink(error: string): BuildErrorLink | null {
	// "Referenced from: /path/to/file:123"
	const refMatch = error.match(/Referenced from:\s*(.+):(\d+)$/);
	if (refMatch) return { path: refMatch[1], line: parseInt(refMatch[2]) };

	// "File not found: /path/to/file"
	const notFoundMatch = error.match(/File not found:\s*(.+)$/);
	if (notFoundMatch) return { path: notFoundMatch[1] };

	// "Could not read /path/to/file: ..."
	const readMatch = error.match(/Could not read\s+(.+?):\s/);
	if (readMatch) return { path: readMatch[1] };

	return null;
}

export function getLanguageForFile(path: string): string {
	if (path.endsWith('.gpc')) return 'gpc';
	if (path.endsWith('.toml')) return 'ini';
	if (path.endsWith('.json')) return 'json';
	return 'plaintext';
}

export function getFileIconColor(name: string): string {
	const ext = name.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'gpc':
			return 'text-emerald-400';
		case 'toml':
			return 'text-amber-400';
		case 'txt':
		case 'md':
			return 'text-blue-400';
		case 'json':
			return 'text-yellow-400';
		default:
			return 'text-zinc-500';
	}
}

export function canDeleteFile(path: string): boolean {
	// Check if file is in modules/ directory
	if (path.includes('/modules/') || path.includes('\\modules\\')) {
		return false;
	}

	// Only config.toml is protected
	const filename = path.split('/').pop() || '';
	if (filename === 'config.toml') {
		return false;
	}

	return true;
}


export function formatSnapshotDate(ts: number): string {
	return new Date(ts * 1000).toLocaleString();
}
