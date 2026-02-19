## High Priority

- [ ] Add margin on bottom of Profile selection.
- [ ] Make CTRL+B open the build tab selection of building.
- [ ] Pressing "2 Reference" codelens link opens the Reference panel, but it is always empty.
- [ ] Add a modal to show the difference when you click to regenerate a single file, with cancel and commit buttons.

## Medium Priority

- [ ] Fix codelens hook into the references panel.
- [ ] Remove module from the script button.
- [ ] Tree view icons.
- [ ] Themes should reflect on the tree view too.

## Low Priority

---

## Roadmap

### CI / Infrastructure

- [x] Fix GitHub Actions build — remote `ersa-lsp-core` is missing `start_with_streams`; either push the local LSP changes upstream or pin a working revision in CI.

### Editor & LSP

- [x] Wire up CodeLens provider in `MonacoLspBridge` — the LSP advertises it but no client provider is registered.
- [x] Wire up Inlay Hints provider in `MonacoLspBridge` — same situation as CodeLens; the capability is advertised but never consumed.
- [x] Snippet library — user-managed reusable GPC code snippets with Monaco snippet completion integration, import/export support.

### Build System

- [x] Build diff preview — when clicking "Build", show file diffs (before vs after) instead of immediate output. Replace the "Build" button with "Cancel" and "Commit" buttons. Cancel hides the diff and restores the Build button. Commit applies the changes, hides the diff, and shows the build output.

### Config & UI

- [x] Drag-and-drop menu item reordering in ConfigEditor.
- [x] Profiles UI — profile selector (dropdown/tabs) in the editor to view and edit per-profile settings; currently profile count is stored in config but there's no switching UI.

### Tools & Integration

- [x] Combo Editor → Game integration — add a "Send to game" action that writes combo output directly into the active game's module files instead of just exporting standalone GPC/JSON.
- [x] Module dependency graph visualization — visual graph showing module conflicts and dependencies, useful for games with many modules.

### Version Control

- [x] Game config version history — lightweight snapshotting of game configs (config.toml) with create, preview, rollback, rename, and delete. Auto-snapshots current state before rollback.

### Simulation

- [x] GPC runtime simulator — combo simulator with step-through execution, playback controls, speed adjustment, loop support, and visual output state display.

### Batch Operations

- [x] Multi-game build queue — build multiple games in sequence from the Built Games tool with auto-regeneration, progress tracking, and result summary.

### Extensibility

- [x] Plugin / extension system — TOML-based plugin manifests in workspace `plugins/` directories with hooks for pre/post build, includes, extra vars/defines. Plugin manager UI for create, enable/disable, delete, and manifest viewing.
