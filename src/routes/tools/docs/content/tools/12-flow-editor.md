# Flow Editor {ide}

The Flow Editor is a visual state machine builder for designing OLED menu systems, game flow logic, and complete GPC scripts. Access it from **Tools > Flow Editor** in the sidebar, or open a flow-based game to enter the editor directly.

## Overview

Design interactive flows as connected nodes on a canvas. Each node represents a screen state with OLED rendering, code logic, and sub-node widgets. Edges define transitions between states (button press, timeout, variable condition). The editor generates complete GPC code from your visual graph.

## Interface

### Canvas

The main editing area is an SVG canvas with a dot grid background:

- **Left-click drag** a node to move it
- **Drag from output port** (right side) to **input port** (left side) to create an edge
- **Middle-click drag** or **Alt + left drag** to pan
- **Scroll wheel** to zoom in/out
- **Click background** to deselect
- **Multi-select** — click and drag on background to select multiple nodes, or Ctrl+click

### Toolbar

Top toolbar with the following actions:

- **Add Node** dropdown with 6 node types
- **Delete** selected node or edge
- **Undo / Redo** with full history
- **Zoom In / Out / Fit** controls with zoom indicator
- **New / Load / Save** graph management
- **Export GPC** copies generated code to clipboard
- **Emulator** toggle for flow preview

### Property Panel (Right)

When a **node** is selected:

- **Label** and **Type** (intro, home, menu, submenu, custom, screensaver)
- **Set as Initial State** button
- **Sub-Nodes** — add and configure OLED widgets (see Sub-Node System below)
- **OLED Scene** link to open the OLED Creator
- **Code tabs** with expandable Monaco editors:
  - **Main** — primary state logic
  - **Enter** — runs once when entering the state
  - **Exit** — runs when leaving the state
  - **Combo** — combo/macro definitions
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

Built-in chunks include Intro Screen, Menu Page (3 Items), Settings Submenu, Screensaver, Splash Screen, Home/Status Screen, and many more.

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

## Sub-Node System

Sub-nodes are composable OLED widgets that you add to flow nodes to build the on-screen display. Each sub-node renders visually on the node preview and generates corresponding GPC drawing code.

### Available Sub-Node Types

| Type | Category | Description |
|------|----------|-------------|
| Header | Text & Headers | Title bar with text and optional formatting |
| Menu Item | Interactive Items | Navigable menu entry with label |
| Toggle Item | Interactive Items | On/off switch with status display |
| Value Item | Interactive Items | Numeric value editor with min/max range |
| Scroll Bar | Interactive Items | Visual position/scroll indicator |
| Text Line | Text & Headers | Static text display line |
| Bar | Display Widgets | Progress/level bar widget |
| Indicator | Display Widgets | Status indicator (LED-style) |
| Pixel Art | Display Widgets | Embedded sprite graphics |
| Separator | Display Widgets | Visual divider line |
| Blank | Display Widgets | Empty spacer for layout |
| Custom | Advanced | User-defined GPC rendering code |

Each sub-node has configurable parameters (text, position, size, colors, etc.) that you set in the Property Panel.

## Edge Conditions

| Condition | Description |
|-----------|-------------|
| Button Press | Trigger on a button event (e.g. `CONFIRM_BTN`) |
| Button Hold | Trigger when a button is held for a duration |
| Timeout | Auto-transition after idle time in milliseconds |
| Variable | Compare a variable value (==, !=, >, <, >=, <=) |
| Custom Code | Inline GPC expression evaluated as a condition |

Custom code conditions are used as `if(expression)` checks and should evaluate to a truthy (non-zero) value.

## Module Nodes

Embed GPC modules directly into your flow:

1. Add a module node from the toolbar or chunk library
2. Configure the module's trigger condition
3. Set module options and parameters
4. The module's code integrates with the flow's code generation

Module nodes let you combine visual flow design with the full module system without leaving the editor.

## Profiles

The Flow Editor supports multi-profile configurations:

- **Profile panel** with named profile tabs
- **Variable overrides** — set different values per profile
- **Automatic code generation** — profile-aware arrays and indexing in generated GPC

Useful for games with multiple weapon loadouts or configuration presets.

## Emulator

Preview your flow in a built-in emulator:

- **Keyboard input** simulation for button presses
- **Real-time state transitions** following your edge conditions
- **OLED rendering** showing the current state's display
- **State tracking** showing which node is active

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
- OLED draw functions (pixel data from sub-nodes and scenes)
- Per-state logic with enter/exit guards
- Transition conditions matching your edges
- Combo definitions from each node
- Module code from module nodes
- Optional SPVAR persistence for marked variables
- Init block and main loop with state dispatch
- Profile-aware variable arrays when profiles are configured

## Flow Types

The editor supports two flow types:

- **Menu** — OLED menu and UI flows with navigation and display widgets
- **Gameplay** — Module logic and game behavior flows

## Features

- **Visual state machine** with drag-and-drop node editing and multi-select
- **12 sub-node widget types** for composing OLED displays
- **6 node types** with color-coded headers and content badges
- **5 condition types** for flexible state transitions
- **Chunk library** with 20+ built-in and user-saved reusable templates
- **Module integration** — embed modules directly as flow nodes
- **Multi-profile** support with per-profile variable overrides
- **Emulator** for previewing flows with keyboard input
- **OLED preview** with real-time rendering of sub-node layouts
- **Undo/Redo** across all operations
- **Variable system** with global and per-node scopes, optional persistence
- **Complete GPC generation** from visual graph to working script
