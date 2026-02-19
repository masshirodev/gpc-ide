# GPC IDE

### A Desktop IDE for Cronus Zen Game Scripts

---

## What is GPC IDE?

GPC IDE is a full-featured desktop development environment purpose-built for creating, editing, and building GPC game configurations for the Cronus Zen device.

It replaces the workflow of manually writing TOML configs, managing module files, and running command-line build tools with a visual, integrated experience.

**Built with:** Tauri 2 (Rust) + SvelteKit 2 (Svelte 5) + Monaco Editor

---

## Core Workflow

```
Create Game  -->  Configure Modules  -->  Edit Code  -->  Build  -->  Deploy
   Wizard          GUI / TOML            Monaco         Diff Preview    .gpc output
```

1. **Create** a new game through the guided wizard
2. **Select modules** from 37+ built-in definitions (antirecoil, turbo, aimassist, etc.)
3. **Configure** via a visual GUI editor or raw TOML
4. **Build** with a diff preview showing exactly what changes before committing
5. **Export** a single compiled `.gpc` file ready for device deployment

---

## The Editor

GPC IDE features a Monaco-based code editor with full language support:

- **GPC syntax highlighting** with custom language grammar
- **Language Server Protocol (LSP)** integration via `ersa-lsp-core`
  - Real-time diagnostics and error reporting
  - CodeLens references
  - Inlay Hints
  - Go-to-definition and hover documentation
- **Dual editing modes** for config files:
  - **GUI mode** — visual form editor with drag-and-drop menu reordering
  - **Code mode** — raw TOML with full editor features
- **Visual editors** for specialized file types:
  - Recoil table editor for spray pattern data
  - Keyboard mapping editor with visual key layout
- **File tree** with tab management, dirty state tracking, and external change detection

---

## Module System

Games are built from composable **modules** defined as TOML files. Each module encapsulates:

- Display name, type (FPS/TPS/FGS/All), and description
- GPC trigger and combo code
- Configurable options (toggles, sliders, selectors)
- Extra variables and defines
- OLED config menu definitions
- Conflict declarations (mutual exclusion groups)
- Profile-aware support for per-profile settings

### 37 Built-in Modules

| Category | Modules |
|----------|---------|
| **Aim** | Antirecoil, Antirecoil Decay, Antirecoil Timeline, Aim Assist (Circular, Square, Jitter, Polar, Left Stick) |
| **Movement** | Always Run, Auto Run, Bunny Hop, Slide Cancel, Strafe, Plink Dash, Easy Motion |
| **Combat** | Rapid Fire, Turbo, Dropshot, Jumpshot, Crouchshot, Hold Breath, Fast Melee, Mash |
| **Defense** | Auto Block, Evasive Edge, Divine Lock |
| **Utility** | ADP, Anti-AFK, Auto Ping, Lean Spam, Quick Toggle, Throw Tech, YY Cancel, Omni Plus |
| **Data** | Weapon Data, Keyboard Mappings |

Users can also create **custom modules** through the Module Manager tool.

---

## Build System

The build pipeline is a Rust-native generation engine that:

1. Reads the game's `config.toml`
2. Resolves module dependencies and conflicts
3. Generates individual GPC source files (core, menu, persistence, settings, define, per-module)
4. Preprocesses `#include` directives into a single output file
5. Outputs a deployable `.gpc` file

### Build Diff Preview

Before any build, GPC IDE shows a **line-by-line diff** of every file that will change. Users review the changes and either:

- **Commit & Build** — apply changes and compile
- **Cancel** — discard and keep current files

This prevents accidental overwrites of manually edited code.

### Multi-Game Build Queue

Build multiple games in sequence from the Built Games tool:

- Select any combination of games from all workspaces
- Auto-regenerates files before each build
- Per-game progress tracking with success/failure status
- Results summary after completion

---

## Tools

GPC IDE ships with 11 specialized tools accessible from the sidebar:

### Spray Pattern Tool
Visual editor for creating and fine-tuning antirecoil spray patterns. Draw patterns on a canvas, configure phases, and export directly into recoil table files.

### OLED Creator
Pixel-level OLED screen designer with scene management, drawing tools, and GPC export for custom Cronus Zen display graphics.

### Combo Maker
Visual combo sequence builder with:
- Step-by-step timeline with drag reordering
- Button grid with analog pressure support
- Circular stick input pads for precise analog values
- Cross-console button translation (PS5, Xbox, Switch, Wii)
- Export as GPC code or full module TOML
- **Send to Game** — inject combos directly into the active game

### Keyboard Mapper
Visual keyboard layout editor for mapping keyboard inputs to controller buttons with per-key binding configuration.

### Module Manager
Create, edit, and manage custom module TOML definitions. Full module builder with options, parameters, triggers, combos, config menus, and conflict declarations.

### Built Games
Browse and manage compiled `.gpc` output files across all workspaces with search, preview, copy, and delete. Includes the **Build Queue** for batch operations.

### Snippet Library
User-managed collection of reusable GPC code snippets:
- Create, edit, tag, and search snippets
- Monaco editor for code authoring
- Import/export as JSON for sharing

### Module Dependency Graph
Interactive SVG visualization of module relationships:
- Circular layout with color-coded nodes by game type
- Red dashed edges for conflicts, green solid for dependencies
- Click-to-highlight connected modules
- Detail panel with module metadata

### Combo Simulator
Step-through execution simulator for combo code:
- Parse any `combo` block
- Play/pause with adjustable speed (0.25x to 4x)
- Step forward/backward through execution
- Visual output state display with value bars
- Loop support for repeated execution testing

### Plugin Manager
Discover, enable/disable, create, and manage workspace plugins with TOML-based manifests supporting build hooks, includes, extra variables, and defines.

### Documentation
Built-in GPC language reference and IDE documentation.

---

## Profiles

GPC IDE supports **multi-profile configurations** where settings can vary per profile (e.g., different recoil values per weapon loadout):

- Profile selector bar with named profile tabs
- Profile-aware badge indicators on menu items
- Per-profile variable arrays in generated GPC code
- Automatic `[Profile]` indexing in module code

---

## Config Version History

Every game config supports **snapshot-based version history**:

- **Create snapshots** of the current `config.toml` state at any time
- **Preview** any snapshot's full TOML content in a read-only Monaco editor
- **Rollback** to any previous snapshot (auto-saves current state first)
- **Rename** snapshots for easy identification
- **Delete** outdated snapshots

Stored as `.history/` directory alongside the game files with a JSON metadata index.

---

## Plugin System

Extend GPC IDE with workspace-level plugins:

```toml
# plugins/my-plugin/plugin.toml
id = "my-plugin"
name = "My Custom Plugin"
version = "1.0.0"
description = "Adds custom build hooks"

[hooks]
pre_build = "// Injected before main code"
post_build = "// Injected after main code"
includes = ["my_include.gpc"]

[hooks.extra_vars]
MyVar = "int"

[hooks.extra_defines]
MY_DEFINE = "1"
```

Plugins support:
- **Pre/post build hooks** — inject GPC code around the main generation
- **Custom includes** — add extra `.gpc` files to the build
- **Extra variables and defines** — extend the generated variable/define sections
- Enable/disable per workspace without deleting

---

## Architecture

```
+----------------------------------+
|          SvelteKit Frontend      |
|  Svelte 5 Runes + Monaco Editor |
+----------------------------------+
           |  Tauri IPC  |
+----------------------------------+
|         Rust Backend (Tauri 2)   |
|  Commands | Pipeline | Models    |
+----------------------------------+
           |           |
    +------+     +-----+
    | LSP  |     | FS  |
    | Core |     | Ops |
    +------+     +-----+
```

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | SvelteKit 2 + Svelte 5 | UI, state management, Monaco integration |
| IPC | Tauri 2 invoke | Type-safe command bridge |
| Backend | Rust | File I/O, config parsing, code generation, build pipeline |
| LSP | ersa-lsp-core | GPC language intelligence |
| Editor | Monaco | Code editing, syntax highlighting, diagnostics |

### Key Design Decisions

- **TOML everywhere** — configs, modules, and plugins all use TOML for human-readable, git-friendly definitions
- **Rust-native pipeline** — the entire generation and build system runs in Rust for performance and reliability
- **Workspace-based** — multi-workspace support with independent game directories, modules, and plugins
- **Non-destructive builds** — diff preview before any file modifications, snapshot history for rollback

---

## Getting Started

```bash
# Install dependencies
npm install

# Development mode (frontend + backend)
npm run tauri dev

# Production build
npm run tauri build
```

### Requirements

- Node.js 18+
- Rust 1.77+
- Tauri 2 CLI

---

## License

MIT
