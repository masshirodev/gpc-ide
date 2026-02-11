# GPC IDE

Desktop IDE for creating, editing, and building Cronus Zen GPC game scripts with OLED menu support.

Built with Tauri v2 (Rust backend) + SvelteKit (Svelte 5) + TailwindCSS + Monaco Editor.

## Features

- **Game Management** - Create, configure, and build GPC game scripts from a visual interface
- **Module System** - Pick from 30+ modules (anti-recoil, rapid fire, aim assist, turbo, etc.) with automatic dependency resolution
- **Code Editor** - Monaco-based editor with GPC language support and LSP integration
- **Config Editor** - Visual editor for `config.toml` with searchable button/key selects
- **Build System** - One-click preprocessing and compilation of game scripts
- **Workspace Support** - Configure multiple workspace directories for organizing game scripts
- **Template Library** - Import common GPC templates into your projects

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Project Structure

```
src/                  # SvelteKit frontend
src-tauri/            # Rust/Tauri backend
modules/              # Bundled module definitions (TOML)
common/               # Shared GPC helper files
drawings/             # OLED drawing primitives
lsp-server/           # GPC language server
```

## Game Types

- **FPS/TPS** - Anti Recoil, Rapid Fire, Aim Assist, Auto Ping, KBM mapping, etc.
- **FGS** - Turbo, Auto Block, Throw Tech, Plink Dash, Easy Motion, etc.
