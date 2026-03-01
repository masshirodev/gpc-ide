# GPC IDE

![GPC IDE Screenshot](https://github.com/masshirodev/gpc-ide/blob/main/screenshots/flow.png?raw=true)

Desktop IDE for creating, editing, and building Cronus Zen GPC game scripts with a visual flow editor, OLED menu designer, and 17 specialized tools.

Built with Tauri v2 (Rust backend) + SvelteKit (Svelte 5) + TailwindCSS + Monaco Editor.

## Features

### Flow Editor
Visual state machine builder for designing OLED menus and game logic. Drag-and-drop nodes, connect transitions, compose OLED layouts with sub-node widgets, and generate complete GPC code from your visual graph.

- 6 node types (intro, home, menu, submenu, custom, screensaver)
- 12 OLED sub-node widgets (headers, menu items, toggle/value editors, bars, indicators, pixel art, etc.)
- 5 edge condition types (button press, hold, timeout, variable, custom code)
- Chunk library with 20+ reusable node templates
- Built-in flow emulator with keyboard input simulation
- Multi-profile support with variable overrides
- Module nodes for embedding GPC modules with trigger conditions

### Code Editor
Monaco-based editor with full GPC language support:

- GPC syntax highlighting with custom language grammar
- LSP integration — real-time diagnostics, completions, references, hover docs
- Tabbed editing with dirty state tracking and session restore
- Dual editing modes for config files (GUI editor or raw TOML)
- Visual editors for recoil tables and keyboard mappings
- File tree with breadcrumbs and context menus
- Git integration — status, diff, stage, commit

### Game Management
- Guided game creation wizard with module selection
- Two generation modes: Flow-based (modern) and Config-based (legacy)
- 37+ built-in modules (antirecoil, turbo, aim assist, rapid fire, etc.)
- Automatic dependency resolution and conflict detection
- Project templates — save and create games from templates
- Zip import/export for sharing complete game projects
- Snapshot-based version history with rollback

### Build System
Rust-native generation pipeline:

- Parses flow graphs or config files
- Resolves module dependencies
- Generates GPC source files (main, menu, persistence, data, per-module)
- Preprocesses `#include` directives into a single output
- Plugin system for injecting custom hooks
- Multi-game build queue for batch compilation

### Tools (17 built-in)

| Category | Tools |
|----------|-------|
| **OLED** | OLED Creator, Font Import, Sprite Import |
| **Combat** | Spray Pattern, Combo Maker |
| **Code** | Snippets, String to Array, Obfuscator |
| **Project** | Module Manager, Built Games, Dependency Graph, Plugins, Compare Games |
| **Testing** | Combo Simulator, Keyboard Mapper |
| **Reference** | Documentation |

### IDE Features
- Command palette for quick actions
- Bottom panel with build output, problems, logs, search, and references tabs
- Notification system with toast messages
- Customizable keybindings
- Multi-workspace support
- Pinned games and recent files
- Tag-based game filtering

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## Installation

Head over to [Releases](https://github.com/masshirodev/gpc-ide/releases) to grab the latest pre-built binaries. We provide both installers and portable archives for Windows and Linux.

## Development

```bash
npm install
npm run tauri dev
```

Frontend-only development (no Rust backend):
```bash
npm run dev
```

## Build

```bash
npm run tauri build
```

## Project Structure

```
src/                  # SvelteKit frontend
  lib/
    components/       # Svelte components (editor, layout, modals, inputs, sprites)
    stores/           # Svelte 5 rune-based stores (.svelte.ts)
    flow/             # Flow editor engine (codegen, subnodes, emulator, chunks)
    tauri/            # Tauri IPC command wrappers
    types/            # TypeScript interfaces
    lsp/              # Monaco LSP bridge
    utils/            # Parsing utilities
  routes/
    tools/            # 17 tool pages (flow, oled, recoil, combo, etc.)
    wizard/           # Game creation wizard
src-tauri/            # Rust/Tauri backend
  src/
    commands/         # IPC command handlers (18 modules)
    models/           # Data structures (config, flow, game_meta, module)
    pipeline/         # Code generation and build pipeline
    lsp/              # Language server management
modules/              # 37 built-in module definitions (TOML)
common/               # Shared GPC helper files
drawings/             # OLED drawing primitives
lsp-server/           # GPC language server
```

## Game Types

- **FPS/TPS** — Anti Recoil, Rapid Fire, Aim Assist, Auto Ping, KBM mapping, etc.
- **FGS** — Turbo, Auto Block, Throw Tech, Plink Dash, Easy Motion, etc.
- **Custom** — Define your own game types via Settings for any genre.

## License

MIT
