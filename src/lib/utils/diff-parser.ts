import type { GitLineChange } from '$lib/components/editor/MonacoEditor.svelte';

/**
 * Parse unified diff output into GitLineChange[] for Monaco gutter decorations.
 * Handles `@@ -old,count +new,count @@` hunk headers and categorises lines
 * as added, modified, or deleted.
 */
export function parseDiffToLineChanges(diffText: string): GitLineChange[] {
	if (!diffText) return [];

	const changes: GitLineChange[] = [];
	const lines = diffText.split('\n');

	let newLine = 0; // current line number in the new (working) file

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Hunk header — extract new-file start line
		const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (hunkMatch) {
			newLine = parseInt(hunkMatch[1], 10);
			continue;
		}

		// Skip file headers and any lines before the first hunk
		if (newLine === 0) continue;

		if (line.startsWith('+') && !line.startsWith('+++')) {
			// Check if this is a modification (preceded by deletion(s))
			// Walk backwards to see if the previous non-context line was a deletion
			let isModification = false;
			for (let j = i - 1; j >= 0; j--) {
				const prev = lines[j];
				if (prev.startsWith('-') && !prev.startsWith('---')) {
					isModification = true;
					break;
				}
				if (prev.startsWith('+') && !prev.startsWith('+++')) {
					// Another addition — still part of a mod block if deletions precede it
					continue;
				}
				// Context line or hunk header — stop looking
				break;
			}

			const type = isModification ? 'modified' : 'added';

			// Merge with previous change of same type on adjacent line
			const last = changes[changes.length - 1];
			if (last && last.type === type && last.endLine === newLine - 1) {
				last.endLine = newLine;
			} else {
				changes.push({ type, startLine: newLine, endLine: newLine });
			}
			newLine++;
		} else if (line.startsWith('-') && !line.startsWith('---')) {
			// Deletion — mark at the current new-file line position.
			// Don't advance newLine since deleted lines don't exist in the new file.
			// Only add a deletion marker if the next line is NOT an addition
			// (additions following deletions are treated as modifications above).
			let followedByAdd = false;
			for (let j = i + 1; j < lines.length; j++) {
				const next = lines[j];
				if (next.startsWith('+') && !next.startsWith('+++')) {
					followedByAdd = true;
					break;
				}
				if (next.startsWith('-') && !next.startsWith('---')) {
					continue; // more deletions — keep looking
				}
				break;
			}

			if (!followedByAdd) {
				// Pure deletion — show marker at the line where content was removed
				const markerLine = Math.max(1, newLine);
				const last = changes[changes.length - 1];
				if (last && last.type === 'deleted' && last.endLine === markerLine) {
					// Already have a deletion marker here
				} else {
					changes.push({ type: 'deleted', startLine: markerLine, endLine: markerLine });
				}
			}
			// Don't advance newLine for deletions
		} else {
			// Context line (space prefix) or other
			if (!line.startsWith('\\')) {
				newLine++;
			}
		}
	}

	return changes;
}
