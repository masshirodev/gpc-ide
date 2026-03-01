# Editor {ide}

The editor is the central workspace of GPC IDE, built on Monaco Editor (the same editor powering VS Code) with full GPC language support.

## File Tree

The left side of the editor shows a file tree for the currently selected game:

- Click a file to open it in a new tab
- Generated (protected) files are shown but cannot be deleted
- Right-click files for context menu options
- Use the **New File** button to create custom GPC files
- Error indicators show files with LSP diagnostics

## Tabs

The editor supports multiple open files via tabs:

- Click a tab to switch to that file
- Modified files show a dot indicator on the tab
- Close tabs with the X button or `Ctrl+W`
- Middle-click a tab to close it
- Tabs persist across sessions (session restore)

## Breadcrumbs

A breadcrumb trail below the tabs shows the current file path, making it easy to see where you are within the project structure.

## Monaco Editor Features

The editor provides rich editing capabilities:

- **Syntax highlighting** for GPC language (keywords, functions, constants, comments)
- **Auto-completion** with suggestions from the LSP server
- **Hover information** showing function signatures and documentation
- **Go to definition** — `Ctrl+Click` or `F12` to jump to symbol definitions
- **Find references** — find all usages of a symbol, displayed in the References panel
- **Error diagnostics** — real-time error checking with inline squiggles
- **Code folding** — collapse sections, functions, and combo blocks
- **Bracket matching** — highlights matching brackets
- **Multi-cursor editing** — `Alt+Click` to place multiple cursors
- **Find and replace** — `Ctrl+F` for find, `Ctrl+H` for replace
- **Minimap** — scrollable code overview on the right edge
- **Sticky scroll** — keep current function/block header visible

## Config Editor

When you open `config.toml` (in config-based games), you can switch between two editing modes:

- **GUI Editor**: A form-based interface for editing config values without needing to know TOML syntax. Includes visual editors for buttons, menu items, and module options.
- **Raw Editor**: Edit the TOML directly in Monaco with syntax highlighting.

## Recoil Table Editor

If your game uses per-weapon recoil data, the recoil table provides a spreadsheet-like interface for editing vertical and horizontal values per weapon. You can also launch the **Spray Pattern** tool from here to visually design recoil patterns.

## Keyboard Mapper Editor

When `keyboard.gpc` is generated, the keyboard mapper editor provides a visual interface for assigning keyboard keys to controller inputs.

## Dashboard View

When no file is open, the editor area shows the **Dashboard** with game overview information and quick actions.

## Bottom Panel

The bottom panel provides multiple views via tabs:

| Tab | Description |
|-----|-------------|
| **Build** | Build output, progress, and status |
| **Problems** | LSP diagnostics aggregated by file with error/warning counts |
| **Logs** | Build and execution output logs |
| **Search** | Search across files with regex support, case sensitivity, and replacement |
| **References** | LSP symbol references from "Find all references" |

## Git Integration

The IDE includes built-in Git support:

- **Status** — see modified, staged, and untracked files
- **Diff** — view line-by-line changes for any file
- **Stage/Unstage** — manage the staging area
- **Commit** — create commits with messages

## History & Snapshots

Game state can be checkpointed with snapshots:

- **Create snapshots** at any time to save the current state
- **Preview** any snapshot's content in a read-only editor
- **Rollback** to a previous snapshot (auto-saves current state first)
- **Rename** and **delete** snapshots

## Editor Settings

Customize the editor in **Settings**:

| Setting     | Default        | Description                |
| ----------- | -------------- | -------------------------- |
| Font Size   | 13             | Editor font size in pixels |
| Tab Size    | 4              | Spaces per tab             |
| Font Family | JetBrains Mono | Monospace font stack       |
| Theme       | gpc-dark       | Color theme                |
