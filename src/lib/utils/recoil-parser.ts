export interface WeaponRecoilEntry {
    index: number;
    name: string;
    type: string;
    values: number[];    // 20 values: [V0, H0, V1, H1, ..., V9, H9]
    rawLine: string;
}

export const PHASE_LABELS = [
    '~80ms', '~160ms', '~280ms', '~420ms', '~600ms',
    '~800ms', '~1.05s', '~1.35s', '~1.75s', '1.75s+'
];

/**
 * Parse weapon names from a weapondata.gpc file.
 * Looks for `const string Weapons[]` or `const string GunName[]`.
 */
export function parseWeaponNames(content: string): string[] {
    const names: string[] = [];

    // Match the array declaration
    const match = content.match(/const\s+string\s+(?:Weapons|GunName)\s*\[\]\s*=\s*\{([\s\S]*?)\};/);
    if (!match) return names;

    const body = match[1];
    // Extract each quoted string
    const stringRegex = /"([^"]+)"/g;
    let m;
    while ((m = stringRegex.exec(body)) !== null) {
        names.push(m[1]);
    }

    return names;
}

/**
 * Parse a recoiltable.gpc file into structured weapon entries.
 */
export function parseRecoilTable(content: string): WeaponRecoilEntry[] {
    const entries: WeaponRecoilEntry[] = [];

    // Find the WeaponRecoilTable array body
    const tableMatch = content.match(/WeaponRecoilTable\s*\[\]\[\]\s*=\s*\{([\s\S]*?)\};/);
    if (!tableMatch) return entries;

    const body = tableMatch[1];
    const lines = body.split('\n');

    for (const line of lines) {
        // Match a row: { values }, /* index  name  type */
        const rowMatch = line.match(/\{([^}]+)\}\s*,?\s*\/\*\s*(\d+)\s+([\s\S]*?)\s*\*\//);
        if (!rowMatch) continue;

        const valuesStr = rowMatch[1];
        const index = parseInt(rowMatch[2], 10);
        const commentBody = rowMatch[3].trim();

        // Parse the 20 integer values
        const values = valuesStr.split(',').map((s) => parseInt(s.trim(), 10));
        if (values.length !== 20) continue;

        // Extract name and optional type from comment
        // Format: "AUG A2        AR" or "Kettle I" (no type)
        const typeMatch = commentBody.match(/^(.+?)\s{2,}(\S+)\s*$/);
        let name: string;
        let type: string;
        if (typeMatch) {
            name = typeMatch[1].trim();
            type = typeMatch[2].trim();
        } else {
            name = commentBody.trim();
            type = '';
        }

        entries.push({ index, name, type, values, rawLine: line });
    }

    return entries;
}

/**
 * Serialize updated entries back into the recoiltable.gpc content.
 * Preserves the header and footer, only replaces the data rows.
 */
export function serializeRecoilTable(
    originalContent: string,
    entries: WeaponRecoilEntry[]
): string {
    const tableStart = originalContent.indexOf('WeaponRecoilTable');
    if (tableStart === -1) return originalContent;

    // Find the opening brace of the array
    const openBrace = originalContent.indexOf('{', tableStart);
    if (openBrace === -1) return originalContent;

    // Find the closing `};`
    const closeBrace = originalContent.indexOf('};', openBrace);
    if (closeBrace === -1) return originalContent;

    // Build the replacement body
    const header = originalContent.substring(0, openBrace + 1);
    const footer = originalContent.substring(closeBrace);

    // Rebuild just the data rows
    const commentLine = '\n//  V0  H0  V1  H1  V2  H2  V3  H3  V4  H4  V5  H5  V6  H6  V7  H7  V8  H8  V9  H9';

    const rows = entries.map((entry) => {
        const vals = entry.values.map((v) => {
            const s = String(v);
            return s.length < 2 ? ' ' + s : s;
        });

        // Format: {V0, H0, V1, H1, ...}, /* index name type */
        const valStr = vals.join(', ');
        const idxStr = String(entry.index).padStart(4, ' ');
        const nameStr = entry.name.padEnd(14, ' ');
        const typeStr = entry.type ? entry.type.padEnd(4, ' ') : '';
        const comment = `/*${idxStr}  ${nameStr}${typeStr}*/`;

        return `    {${valStr}}, ${comment}`;
    });

    return header + commentLine + '\n' + rows.join('\n') + '\n' + footer;
}

/**
 * Update a single weapon's values in the entries array.
 * Returns a new array (immutable).
 */
export function updateWeaponValues(
    entries: WeaponRecoilEntry[],
    weaponIndex: number,
    newValues: number[]
): WeaponRecoilEntry[] {
    return entries.map((entry) => {
        if (entry.index === weaponIndex) {
            return { ...entry, values: [...newValues] };
        }
        return entry;
    });
}
