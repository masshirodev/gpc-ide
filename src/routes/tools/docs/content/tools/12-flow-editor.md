# Flow Editor {ide}

The Flow Editor is a visual state machine builder for designing OLED menu systems, intro sequences, and game flow logic. Access it from **Tools > Flow Editor** in the sidebar.

## Overview

Design interactive flows as connected nodes on a canvas. Each node represents a screen state (intro, menu, home, etc.) and edges define transitions between them (button press, timeout, variable condition). The editor generates complete GPC code from your visual graph.

## Interface

### Canvas

The main editing area is an SVG canvas with a dot grid background:

- **Left-click drag** a node to move it
- **Drag from output port** (right side) to **input port** (left side) to create an edge
- **Middle-click drag** or **Alt + left drag** to pan
- **Scroll wheel** to zoom in/out
- **Click background** to deselect

### Toolbar

Top toolbar with the following actions:

- **Add Node** dropdown with 6 node types
- **Delete** selected node or edge
- **Undo / Redo** with full history
- **Zoom In / Out / Fit** controls with zoom indicator
- **New / Load / Save** graph management
- **Export GPC** copies generated code to clipboard

### Property Panel (Right)

When a **node** is selected:

- **Label** and **Type** (intro, home, menu, submenu, custom, screensaver)
- **Set as Initial State** button
- **OLED Scene** link to open the OLED Creator
- **OLED Widgets** add widgets from the widget library
- **Code tabs** with expandable Monaco editors:
  - **Main** - primary state logic
  - **Enter** - runs once when entering the state
  - **Exit** - runs when leaving the state
  - **Combo** - combo/macro definitions
- **Variables** with name, type (int, int8, int16, int32), add/remove
- **Save as Chunk**, **Duplicate**, **Delete** actions

When an **edge** is selected:

- **Label** override text
- **Condition type** and its configuration fields
- **Delete Edge** button

### Chunk Library (Left)

A sidebar of reusable node templates organized by category:

- **Search** to filter by name, description, or tags
- **Categories**: Intro/Splash, Menu Pages, Home/Status, Screensaver, Utility
- Click a chunk to insert it onto the canvas
- **Save as Chunk** from any node via the property panel

Built-in chunks include Intro Screen, Menu Page (3 Items), Settings Submenu, Screensaver, Splash Screen, and Home/Status Screen.

## Node Types

| Type | Color | Purpose |
|------|-------|---------|
| Intro | Blue | Splash/startup screens, auto-transition |
| Home | Green | Main status screen with menu access |
| Menu | Purple | Navigation menu with multiple options |
| Submenu | Orange | Secondary menus or settings pages |
| Custom | Gray | User-defined state with flexible logic |
| Screensaver | Cyan | Idle screen activated on timeout |

Nodes display content badges: **C** (code), **O** (OLED scene), **X** (combo), plus a variable count.

## Edge Conditions

| Condition | Description |
|-----------|-------------|
| Button Press | Trigger on a button event (e.g. `CONFIRM_BTN`) |
| Button Hold | Trigger when a button is held for a duration |
| Timeout | Auto-transition after idle time in milliseconds |
| Variable | Compare a variable value (==, !=, >, <, >=, <=) |
| Custom Code | Inline GPC expression evaluated as a condition |

Custom code conditions are used as `if(expression)` checks and should evaluate to a truthy (non-zero) value.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Delete / Backspace | Remove selected node or edge |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+S | Save graph |
| Escape | Clear selection, cancel connection |

## Code Generation

**Export GPC** generates a self-contained script with:

- State defines and variable declarations
- OLED draw functions (pixel data from scenes)
- Per-state logic with enter/exit guards
- Transition conditions matching your edges
- Combo definitions from each node
- Optional SPVAR persistence for marked variables
- Init block and main loop with state dispatch

## Features

- **Visual state machine** with drag-and-drop node editing
- **6 node types** with color-coded headers and content badges
- **5 condition types** for flexible state transitions
- **Chunk library** with built-in and user-saved reusable templates
- **OLED integration** with per-node scenes and widget placements
- **Undo/Redo** across all operations
- **Variable system** with global and per-node scopes, optional persistence
- **Complete GPC generation** from visual graph to working script
