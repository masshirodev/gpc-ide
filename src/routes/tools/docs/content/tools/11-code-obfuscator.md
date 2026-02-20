# Code Obfuscator {ide}

The Code Obfuscator applies layered transformations to GPC scripts to make them difficult to reverse-engineer. Access it from **Tools > Obfuscator** in the sidebar.

## Overview

After building a GPC script, you may want to protect your code before sharing or distributing it. The obfuscator applies up to 5 levels of transformation, from basic minification to control flow restructuring.

## Interface

### Controls Bar

- **Load .gpc File**: Open a compiled GPC file to obfuscate
- **Level slider** (1–5): Select how many obfuscation layers to apply
- **Obfuscate**: Run the obfuscation pipeline
- **Copy / Save As**: Export the result (appear after obfuscation)

### Split Editor View

- **Source** (left): Read-only view of the original GPC code
- **Obfuscated Output** (right): Read-only view of the transformed result

### Stats Bar

After obfuscation, a stats bar shows transformation metrics:

- Identifiers renamed
- Comments removed
- Strings encoded
- Dead code blocks injected
- Line count change (before → after)
- Size change (percentage)

## Obfuscation Levels

Each level includes all transformations from previous levels:

| Level | Name | Description |
|-------|------|-------------|
| 1 | Strip & Minify | Remove comments and collapse whitespace |
| 2 | Rename Identifiers | Replace variable, function, and combo names with random identifiers |
| 3 | Encode Strings | Convert string constants to character code arrays |
| 4 | Dead Code Injection | Insert unused code blocks to confuse readers |
| 5 | Control Flow | Add opaque predicates and restructure logic flow |

## Usage

1. Click **Load .gpc File** and select a compiled GPC file
2. Adjust the obfuscation level with the slider
3. Click **Obfuscate**
4. Review the output in the right panel
5. Click **Copy** or **Save As** to export

You can re-obfuscate at different levels without reloading the file. The obfuscator always works from the original source, not from a previously obfuscated result.

## Tips

- **Level 2** is a good default — it renames identifiers while keeping the code functional
- Higher levels produce larger output due to injected code
- Always test obfuscated scripts to verify they still function correctly
