# Built Games {ide}

The Built Games tool lets you browse compiled GPC output files and batch-build multiple games at once. Access it from **Tools > Built Games** in the sidebar.

## Overview

After building a game in the editor, the compiled `.gpc` file is placed in a `dist/` directory. This tool provides a central view of all built files across your workspaces, plus a build queue for compiling multiple games in one operation.

## Interface

The tool has two views, toggled with the **Files** / **Build Queue** tabs in the header.

### Files View

A two-panel layout for browsing built output:

**File List (Left)**:
- Lists all `.gpc` files found in `dist/` directories across your workspaces
- **Search**: Filter files by name
- Each file shows its name and source workspace
- Hover to reveal a delete button for removing outdated builds

**File Viewer (Right)**:
- Displays the selected file's GPC source in a read-only Monaco editor
- Shows line count
- **Copy** button to copy the full file contents to clipboard

### Build Queue View

Batch-build multiple games in sequence:

1. All detected games are listed with checkboxes
2. Use **Select All** or click individual games to choose which to build
3. Click **Build N Games** to start the queue
4. Each game is auto-regenerated (if needed) then compiled
5. Progress indicators show building/success/error status per game
6. A results summary appears when the queue completes

## File Discovery

The tool scans for `.gpc` files in:

- `<workspace>/dist/` for each configured workspace
- `<app-root>/dist/` for the application's own dist directory

## Build Queue Details

When building from the queue, each game goes through:

1. **Regeneration check**: Previews changes and commits any updated generated files
2. **Build**: Compiles the game's GPC output using the build pipeline
3. **Result**: Reports success or failure with error details
