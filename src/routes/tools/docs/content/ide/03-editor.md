# Editor {ide}

The editor is the central workspace of GPC IDE, built on Monaco Editor (the same editor powering VS Code) with full GPC language support.

## File Tree

The left side of the editor shows a file tree for the currently selected game:

- Click a file to open it in a new tab
- Generated (protected) files are shown but cannot be deleted
- Right-click files for context menu options
- Use the **New File** button to create custom GPC files

## Tabs

The editor supports multiple open files via tabs:

- Click a tab to switch to that file
- Modified files show a dot indicator on the tab
- Close tabs with the X button or `Ctrl+W`
- Tabs persist while the game is selected

## Monaco Editor Features

The editor provides rich editing capabilities:

- **Syntax highlighting** for GPC language (keywords, functions, constants, comments)
- **Auto-completion** with suggestions from the LSP server
- **Hover information** showing function signatures and documentation
- **Go to definition** — `Ctrl+Click` or `F12` to jump to symbol definitions
- **Find references** — find all usages of a symbol
- **Error diagnostics** — real-time error checking with inline squiggles
- **Code folding** — collapse sections, functions, and combo blocks
- **Bracket matching** — highlights matching brackets
- **Multi-cursor editing** — `Alt+Click` to place multiple cursors
- **Find and replace** — `Ctrl+F` for find, `Ctrl+H` for replace

## Config Editor

When you open `config.toml`, you can switch between two editing modes:

- **GUI Editor**: A form-based interface for editing config values without needing to know TOML syntax. Includes visual editors for buttons, menu items, and module options.
- **Raw Editor**: Edit the TOML directly in Monaco with syntax highlighting.

## Recoil Table Editor

If your game uses per-weapon recoil data, the recoil table provides a spreadsheet-like interface for editing vertical and horizontal values per weapon. You can also launch the **Spray Pattern** tool from here to visually design recoil patterns.

## Keyboard Mapper Editor

When `keyboard.gpc` is generated, the keyboard mapper editor provides a visual interface for assigning keyboard keys to controller inputs.

## Editor Settings

Customize the editor in **Settings**:

| Setting     | Default        | Description                |
| ----------- | -------------- | -------------------------- |
| Font Size   | 13             | Editor font size in pixels |
| Tab Size    | 4              | Spaces per tab             |
| Font Family | JetBrains Mono | Monospace font stack       |
| Theme       | gpc-dark       | Color theme                |
