# GPC IDE

Desktop IDE for creating, editing, and building Cronus Zen GPC game scripts with OLED menu support.

Built with Tauri v2 (Rust backend) + SvelteKit (Svelte 5) + TailwindCSS + Monaco Editor.

## Features

- **Game Management** - Create, configure, and build GPC game scripts from a visual interface. Delete games from the sidebar or dashboard.
- **Module System** - Pick from built-in modules (anti-recoil, rapid fire, aim assist, turbo, etc.) with automatic dependency resolution and conflict detection. Create custom modules with the full-featured module editor including advanced options (extra variables, parameters, config menus, conflicts).
- **Code Editor** - Monaco-based editor with GPC language support and LSP integration. Tabbed editing with middle-click to close, dirty state tracking, and keyboard shortcuts.
- **Config Editor** - Visual GUI editor for `config.toml` with searchable button/key selects, menu item management, and sticky header.
- **Build System** - One-click preprocessing and compilation of game scripts with error navigation.
- **Workspace Support** - Configure multiple workspace directories for organizing game scripts.
- **Custom Game Types** - Define custom game types beyond the built-in FPS, TPS, and FGS categories.
- **Template Library** - Import common GPC templates into your projects.
- **Recoil Table Editor** - Visual spray pattern editor for per-weapon recoil curves.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

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
    components/       # Svelte components (editor, inputs, layout, modals)
    stores/           # Svelte 5 reactive stores (editor, game, settings, ui, lsp)
    tauri/            # Tauri IPC command wrappers
    types/            # TypeScript interfaces
    lsp/              # Monaco LSP bridge
src-tauri/            # Rust/Tauri backend
  src/
    commands/         # IPC command handlers
    models/           # Data structures
    pipeline/         # Code generation and build pipeline
modules/              # Bundled module definitions (TOML)
common/               # Shared GPC helper files
drawings/             # OLED drawing primitives
lsp-server/           # GPC language server
```

## Game Types

- **FPS/TPS** - Anti Recoil, Rapid Fire, Aim Assist, Auto Ping, KBM mapping, etc.
- **FGS** - Turbo, Auto Block, Throw Tech, Plink Dash, Easy Motion, etc.
- **Custom** - Define your own game types via Settings for any genre.
