# Building {ide}

Building a game compiles your flow graphs or config files into final `.gpc` output files that can be loaded onto a Cronus Zen device.

## Build Process

The build pipeline varies depending on the game's generation mode.

### Flow-Based Games

1. **Parse flow graph** — Reads the `flows.json` data (nodes, edges, sub-nodes, variables)
2. **Generate GPC code** — Converts the visual state machine into GPC:
   - State defines and variable declarations
   - OLED draw functions (pixel data from sub-nodes and scenes)
   - Per-state logic with enter/exit guards
   - Transition conditions matching your edges
   - Combo definitions from each node
   - Optional SPVAR persistence for marked variables
   - Init block and main loop with state dispatch
3. **Integrate modules** — Merges code from any module nodes
4. **Compile output** — Produces a single `.gpc` file

### Config-Based Games

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
- **Build queue**: Batch-build from the Built Games tool

## Build Output

Built files are saved to the `dist/` directory within your workspace. The bottom panel shows:

- Build progress and status
- Any errors or warnings
- The generated GPC code (viewable and copyable)

## Generated Files (Config-Based)

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
- Batch-build multiple games with the build queue

## Plugin Integration

If workspace plugins are enabled, they inject code at configured hook points during the build:

- **Pre-build hooks** — code injected before the main generation
- **Post-build hooks** — code injected after the main generation
- **Custom includes** — additional `.gpc` files added to the build
- **Extra variables and defines** — extend the generated declarations
