# GPC IDE

### A Desktop IDE for Cronus Zen Game Scripts

---

## What is GPC IDE?

GPC IDE is a full-featured desktop development environment purpose-built for creating, editing, and building GPC game scripts for the Cronus Zen device.

It replaces the workflow of manually writing configs, managing module files, and running command-line build tools with a visual, integrated experience — centered around a **Flow Editor** that lets you design OLED menus and game logic as visual state machines.

**Built with:** Tauri 2 (Rust) + SvelteKit 2 (Svelte 5) + Monaco Editor

---

## Core Workflow

```
Create Game  -->  Design Flows  -->  Edit Code  -->  Build  -->  Deploy
   Wizard        Flow Editor        Monaco        Pipeline     .gpc output
```

1. **Create** a new game through the guided wizard
2. **Design** OLED menus and game logic visually in the Flow Editor
3. **Configure** modules — 37+ built-in features like antirecoil, turbo, aim assist
4. **Edit** code in the Monaco editor with full LSP support
5. **Build** and export a single compiled `.gpc` file ready for the device

---

## Flow Editor

The Flow Editor is the primary way to build games — a visual state machine builder that generates complete GPC code from connected nodes:

### Node System
- **6 node types**: Intro, Home, Menu, Submenu, Custom, Screensaver
- Each node represents a screen state with enter/exit logic, OLED rendering, and code
- Color-coded headers and content badges (code, OLED, combo, variables)

### Sub-Node Widgets (v2)
Composable OLED widgets rendered directly on flow nodes:

| Widget | Description |
|--------|-------------|
| Header | Title bar with text and optional icon |
| Menu Item | Navigable menu entry with label |
| Toggle Item | On/off switch with status display |
| Value Item | Numeric value with min/max range |
| Scroll Bar | Visual position indicator |
| Text Line | Static text display |
| Bar | Progress/level bar widget |
| Indicator | Status indicator (LED-style) |
| Pixel Art | Embedded sprite graphics |
| Separator | Visual divider line |
| Blank | Empty spacer |
| Custom | User-defined rendering code |

### Edge Conditions
- **Button Press** — trigger on button event
- **Button Hold** — trigger when held for duration
- **Timeout** — auto-transition after idle time
- **Variable** — compare variable value (==, !=, >, <, >=, <=)
- **Custom Code** — inline GPC expression

### Chunk Library
20+ reusable node templates organized by category (Intro/Splash, Menu Pages, Home/Status, Screensaver, Utility). Save any node as a custom chunk for reuse across projects.

### Module Nodes
Embed GPC modules directly into flows with trigger conditions and configurable options. Module nodes integrate seamlessly with the code generation pipeline.

### Emulator
Preview flows in a built-in emulator with keyboard input simulation, real-time state transitions, and OLED rendering.

### Profiles
Multi-profile support with named profiles, variable overrides per profile, and automatic profile-aware code generation.

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
- **File tree** with breadcrumbs, tab management, dirty state tracking, and session restore
- **Git integration** — status, diff, stage, commit from within the IDE

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

The build pipeline is a Rust-native generation engine that supports two game modes:

### Flow-Based (Modern)
1. Reads the game's `game.json` metadata and `flows.json` graph data
2. Generates GPC code from the visual state machine (states, transitions, OLED rendering)
3. Integrates module code from module nodes
4. Outputs a single deployable `.gpc` file

### Config-Based (Legacy)
1. Reads the game's `config.toml`
2. Resolves module dependencies and conflicts
3. Generates individual GPC source files (main, menu, persistence, data, per-module)
4. Preprocesses `#include` directives into a single output file

### Multi-Game Build Queue

Build multiple games in sequence from the Built Games tool:

- Select any combination of games from all workspaces
- Auto-regenerates files before each build
- Per-game progress tracking with success/failure status
- Results summary after completion

---

## Tools

GPC IDE ships with 17 specialized tools accessible from the sidebar:

### OLED Tools

**OLED Creator** — Pixel-level OLED screen designer with scene management, drawing tools (pencil, eraser, line, rectangle, fill), animation presets, custom font editor, animation sequencer, and a GPC code runner for programmatic drawing.

**Font Import** — Import BDF bitmap fonts, preview rendered text on a simulated OLED display, and generate GPC font code. Send imported fonts directly to the OLED Creator.

**Sprite Import** — Import sprite sheets from images, configure cell dimensions and threshold, edit individual frames in a pixel editor, and save sprite collections to workspaces.

### Combat Tools

**Spray Pattern** — Visual editor for creating antirecoil spray patterns. Draw patterns on a canvas and export compensation values directly into recoil table files.

**Combo Maker** — Visual combo sequence builder with step-by-step timeline, button grid with analog pressure support, circular stick input pads, cross-console button translation, and GPC code export.

### Code Tools

**Snippets** — User-managed collection of reusable GPC code fragments with Monaco editor, tagging, search, and JSON import/export.

**String to Array** — Convert text into GPC array declarations with configurable byte/word format, null termination, padding, and hex dump visualization.

**Obfuscator** — Apply layered transformations (1-5 levels) to GPC scripts — from minification to identifier renaming, string encoding, dead code injection, and control flow restructuring.

### Project Tools

**Module Manager** — Browse, create, and edit module TOML definitions with a full GUI builder for metadata, options, triggers, combos, advanced flags, and conflict declarations.

**Built Games** — Browse compiled `.gpc` output files across workspaces with search, preview, and copy. Includes a **Build Queue** for batch-building multiple games.

**Dependency Graph** — Interactive SVG visualization of module relationships with color-coded nodes by game type, conflict/dependency edges, and click-to-highlight navigation.

**Plugins** — Discover, enable/disable, create, and manage workspace-level plugins with TOML manifests supporting pre/post build hooks, custom includes, extra variables, and defines.

**Compare Games** — Side-by-side file comparison between two games using a diff viewer. Select common files and view line-by-line differences.

### Testing Tools

**Combo Simulator** — Step-through execution simulator for combo code with play/pause, adjustable speed (0.25x-4x), visual output state display, and loop support.

**Keyboard Mapper** — Visual keyboard layout editor for mapping keyboard keys to controller inputs with per-key binding configuration and integration with the game config.

### Reference

**Documentation** — Built-in searchable documentation with IDE guides, GPC language reference, LSP features, and tool documentation.

---

## IDE Features

### Bottom Panel
Multi-tab panel with specialized views:
- **Build** — build output and status
- **Problems** — LSP diagnostics aggregated by file
- **Logs** — build and execution output logs
- **Search** — search across files with regex support and replacement
- **References** — LSP symbol references

### Version History
Snapshot-based game state checkpoints:
- Create, preview, rename, and delete snapshots
- Rollback to any previous state (auto-saves current state first)
- Stored as `.history/` directory with JSON metadata

### Command Palette
Quick-access action launcher for common operations.

### Notifications
Toast messages and notification inbox for tracking build results, errors, and system events.

### Customization
- Customizable keybindings
- Editor font, size, tab size, theme
- Multiple workspaces
- Custom game types
- Pinned games and recent files
- Tag-based game filtering

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
| Frontend | SvelteKit 2 + Svelte 5 | UI, state management, Monaco integration, flow editor |
| IPC | Tauri 2 invoke | Type-safe command bridge |
| Backend | Rust | File I/O, config parsing, code generation, build pipeline |
| LSP | ersa-lsp-core | GPC language intelligence |
| Editor | Monaco | Code editing, syntax highlighting, diagnostics |

### Key Design Decisions

- **Flow-first** — the Flow Editor is the primary interface for game creation, generating code from visual state machines
- **TOML everywhere** — configs, modules, and plugins all use TOML for human-readable, git-friendly definitions
- **Rust-native pipeline** — the entire generation and build system runs in Rust for performance and reliability
- **Workspace-based** — multi-workspace support with independent game directories, modules, and plugins
- **Sub-node composition** — OLED layouts are built from composable widgets rather than pixel-level editing
- **Non-destructive builds** — snapshot history for rollback, protected generated files

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
