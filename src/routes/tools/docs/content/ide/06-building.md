# Building

Building a game compiles your `config.toml` and modules into final `.gpc` output files that can be loaded onto a Cronus Zen device.

## Build Process

The build pipeline performs these steps:

1. **Parse config.toml** — Reads your game configuration
2. **Resolve modules** — Loads all referenced module definitions
3. **Generate GPC files** — Creates the individual source files:
   - `main.gpc` — Entry point with imports and main loop
   - `menu.gpc` — Complete OLED menu system with navigation
   - `persistence.gpc` — Save/load system for user settings
   - `data.gpc` — Variable declarations and data tables
   - Module files — One `.gpc` per installed module
4. **Compile output** — Concatenates everything into a single build output

## How to Build

There are several ways to trigger a build:

- **Keyboard shortcut**: `Ctrl+B` to build, `Ctrl+Shift+B` to build and copy
- **Build button**: Click the build icon in the toolbar
- **Bottom panel**: Use the build controls in the output panel

## Build Output

Built files are saved to the `dist/` directory within your workspace. The output panel shows:

- Build progress and status
- Any errors or warnings
- The generated GPC code (viewable and copyable)

## Generated Files

The build generates several interconnected GPC files:

### main.gpc

The entry point that imports all other files and runs the main loop. Contains:

- `#include` directives for all generated files
- `main { }` block that runs module triggers and menu logic

### menu.gpc

A complete OLED menu system featuring:

- Page-based navigation with up/down/left/right controls
- Toggle, value, and selector item rendering
- State display showing active module statuses
- Menu modifier + button combo to open the menu

### persistence.gpc

Handles saving and loading user settings to the Cronus Zen's persistent storage:

- Bit-packed storage for efficient use of limited PVAR space
- Automatic save on value change
- Load on device startup

### data.gpc

Contains all variable declarations, constants, and data arrays used by the game.

## Viewing Built Games

Use the **Built Games** tool (sidebar > Tools > Built Games) to:

- Browse all compiled `.gpc` files from your workspaces
- View the generated code
- Copy output to clipboard
- Delete old builds
