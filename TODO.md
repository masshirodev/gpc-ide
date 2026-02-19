## High Priority

- [ ] Add margin on bottom of Profile selection.
- [ ] Make CTRL+B open the build tab selection of building.
- [ ] Pressing "2 Reference" codelens link opens the Reference panel, but it is always empty.
- [ ] Add a modal to show the difference when you click to regenerate a single file, with cancel and commit buttons.

## Medium Priority

- [ ] Fix codelens hook into the references panel.
- [ ] Remove module from the script button.

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

- [ ] Game config version history — lightweight snapshotting of game configs (config.toml + module state) on each build; diff between versions, rollback to previous snapshots.

### Simulation

- [ ] GPC runtime simulator — basic simulator showing button output timing diagrams for mock inputs; even simplified visualization (turbo/rapidfire timing) would help debug without a device.

### Batch Operations

- [ ] Multi-game build queue — build multiple games in sequence or parallel with a queue UI and progress tracking.

### Extensibility

- [ ] Plugin / extension system — formalize the existing `/tools/*` routing into a plugin API; let users write custom tools or modules that plug into the IDE with community contribution support.