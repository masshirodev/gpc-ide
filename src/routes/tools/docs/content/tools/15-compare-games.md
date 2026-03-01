# Compare Games {ide}

The Compare Games tool lets you view side-by-side file differences between two games. Access it from **Tools > Compare Games** in the sidebar.

## Overview

When you have multiple game projects, it's useful to compare their files to see what's different — configuration changes, module differences, or code variations. This tool loads the file trees of two games, finds common files, and displays a line-by-line diff.

## Interface

### Game Selection

Two dropdown menus at the top let you select the games to compare:

- **Game A** (left) — select the first game
- **Game B** (right) — select the second game

Both dropdowns list all games from your configured workspaces.

### File List

After selecting two games, a list of **common files** appears — files that exist in both games. Click a file to load its contents and view the diff.

### Diff Viewer

The main area shows a side-by-side diff of the selected file:

- **Added lines** highlighted in green
- **Removed lines** highlighted in red
- **Unchanged lines** shown normally for context
- Line numbers for both versions

## Workflow

1. Select **Game A** from the left dropdown
2. Select **Game B** from the right dropdown
3. Browse the list of common files
4. Click a file to view its diff
5. Review line-by-line differences between the two versions

## Use Cases

- **Compare configurations** — see how two games' `config.toml` files differ
- **Review module changes** — check differences in module GPC files
- **Audit custom code** — compare user-created files across projects
- **Template verification** — confirm a game matches a template's structure
