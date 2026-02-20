# Plugin System {ide}

The Plugin System lets you extend the GPC generation pipeline with custom code injected at specific hook points. Access it from **Tools > Plugins** in the sidebar.

## Overview

Plugins are workspace-level extensions that inject GPC code into the generated output at predefined hook points. This allows you to add custom logic — initialization routines, shared utilities, or post-processing — without modifying built-in modules.

## Interface

### Plugin List (Left)

- Lists all detected plugins from your workspaces
- Each entry shows: name, ID, description, enabled/disabled state, and hook point
- **Toggle switch**: Enable or disable a plugin without deleting it
- **Delete button**: Permanently remove a plugin (hover to reveal)

### Detail Panel (Right)

When a plugin is selected:

- Displays the full plugin manifest (`plugin.toml`) in a read-only Monaco editor
- Shows plugin metadata: name, ID, description, version, author, hook, and priority

## Creating a Plugin

1. Click **+ New Plugin** in the header
2. Fill in:
   - **Plugin ID**: Lowercase identifier (e.g., `my_plugin`)
   - **Name**: Display name
   - **Description**: Optional explanation
3. Click **Create**

This generates a plugin directory in `<workspace>/plugins/<id>/` containing:

- `plugin.toml` — manifest with metadata and hook configuration
- `code.gpc` — the GPC code to inject

## Plugin Manifest

The `plugin.toml` file defines the plugin:

```toml
[plugin]
id = "my_plugin"
name = "My Plugin"
description = "Adds custom initialization"
version = "1.0.0"
hook = "init"
priority = 100
```

### Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Display name |
| `description` | What the plugin does |
| `version` | Semantic version |
| `hook` | Where code is injected in the pipeline |
| `priority` | Execution order (lower = earlier) |

## Enabling / Disabling

Toggle a plugin's enabled state without deleting it. Disabled plugins are skipped during code generation. The enabled state is tracked per-workspace.
