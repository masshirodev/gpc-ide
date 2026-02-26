# Flow Editor v2 -- Design Document

## Overview

The flow editor is the primary way users build OLED menu systems for Cronus Zen scripts. v2 replaces the flat state-machine model with a **compound node** architecture where each node (screen state) contains **sub-nodes** (visual/interactive elements).

The goal is to let users build complete menu systems **without writing GPC code**, while still allowing power users to drop into raw code when needed.

---

## Current State (v1)

- Flat state machine: each node = one screen state
- Nodes have: GPC code blocks (main/onEnter/onExit/combo), an OLED pixel scene (base64 bitmap), widget placements, variables
- Edges connect node-to-node with conditions (button_press, button_hold, timeout, variable, custom)
- Separate widget system (WidgetPlacement) with absolute x,y positioning, no interactivity
- SVG-based canvas editor (custom, not a library)
- Code generation produces complete GPC scripts with state functions, OLED drawing, transitions
- Chunk system for reusable node templates

### Key files (v1)

- `src/lib/types/flow.ts` -- FlowNode, FlowEdge, FlowCondition, FlowVariable, FlowGraph, FlowChunk, WidgetPlacement
- `src/lib/stores/flow.svelte.ts` -- Svelte 5 runes store, canvas state, undo/redo, CRUD operations
- `src/lib/flow/codegen.ts` -- GPC code generation from flow graph
- `src/lib/flow/chunks.ts` -- Built-in chunk definitions
- `src/lib/oled-widgets/types.ts` -- OledWidgetDef, widget param types, pixel buffer helpers
- `src/lib/oled-widgets/registry.ts` -- Built-in widget definitions (9 widgets)
- `src/lib/oled-widgets/widgets/` -- Individual widget implementations
- `src-tauri/src/models/flow.rs` -- Rust mirror of flow types
- `src/routes/tools/flow/+page.svelte` -- Main flow editor page
- `src/routes/tools/flow/FlowCanvas.svelte` -- SVG canvas with pan/zoom/grid
- `src/routes/tools/flow/FlowNode.svelte` -- Node rendering (220x100px SVG boxes)
- `src/routes/tools/flow/FlowEdge.svelte` -- Edge rendering (bezier curves)
- `src/routes/tools/flow/FlowPropertyPanel.svelte` -- Node/edge property editing
- `src/routes/tools/flow/ChunkLibrary.svelte` -- Reusable chunk sidebar
- `src/routes/tools/flow/ChunkSaveModal.svelte` -- Save node as chunk
- `src/routes/tools/oled-widgets/+page.svelte` -- Standalone widget browser/preview

---

## v2 Design Decisions

### 1. Sub-Node System (replaces widgets)

**Decision**: Sub-nodes replace the widget system entirely.

- Each container node holds an ordered list of **sub-nodes**
- Sub-nodes are typed elements from a registry
- Built-in types are **declarative** -- user configures via properties, codegen generates GPC automatically
- A **Custom** sub-node type allows raw GPC for power users
- Existing widget definitions (bars, indicators, etc.) migrate to become sub-node types

**Built-in sub-node types**:

| Type | Interactive? | Description |
|------|-------------|-------------|
| Header | No | Draws text at top, optional separator line |
| Menu Item | Yes | Selectable item, auto-tracks cursor, highlights when selected |
| Toggle Item | Yes | Menu item showing ON/OFF state, bound to a variable |
| Value Item | Yes | Menu item with adjustable numeric value (e.g. sensitivity 1-10) |
| Scroll Bar | No | Auto-renders based on item count vs visible items |
| Text Line | No | Static text at a position |
| Bar Widget | No | Progress/value bar (absorbs current bar widgets) |
| Indicator | No | Status indicator (absorbs current indicator widgets) |
| Pixel Art | No | Raw pixel scene (absorbs current OLED scene bitmap) |
| Separator | No | Horizontal line / spacing element |
| Custom | Configurable | Raw GPC code for rendering + optional interaction |

### 2. Code Ownership -- Hybrid Approach

**Decision**: Hybrid -- declarative built-ins + custom raw code.

- Built-in sub-node types generate their own GPC code automatically from configured properties
- Users who don't know GPC can build full menus by just adding and configuring sub-nodes
- The "Custom" sub-node type provides raw `render()` and `onInteract()` code blocks for power users
- Codegen composes all sub-node outputs into the state function

### 3. Layout Model -- Stack with Overrides (Option C)

**Decision**: Vertical stack by default, with per-sub-node absolute positioning override.

**Default behavior (stack mode)**:
- Sub-nodes stack top-to-bottom automatically
- 8px per row (one text line height)
- Y positions are auto-calculated from order
- Reordering = drag up/down in the sub-node list

**Override (absolute mode)**:
- Any sub-node can be set to `position: absolute` with manual x, y coordinates
- Absolute sub-nodes float freely, independent of the stack

**Mixed mode**:
- Stack and absolute sub-nodes coexist in the same container
- Container has `stackOffsetX` / `stackOffsetY` to shift the entire stack (e.g. when a scroll bar occupies the left side)
- Example: scroll bar at absolute x=0, stack offset x=8, menu items auto-stack starting at x=8

**Example -- sidebar scroll bar layout**:
```
Container: stackOffsetX = 8
  [Scroll Bar]    -> absolute, x=0, y=0, w=6
  [Header]        -> stacked, auto y=0, x=8
  [Menu Item 1]   -> stacked, auto y=10, x=8
  [Menu Item 2]   -> stacked, auto y=18, x=8
  [Menu Item 3]   -> stacked, auto y=26, x=8
```

**Example -- fully manual layout**:
All sub-nodes set to absolute, user places each one manually with x, y coordinates. Full control over every pixel.

### 4. Transition Model -- Dual-Level Edges

**Decision**: Both node-level and sub-node-level edges coexist.

- **Node-level edges**: transition source is the container node
  - Use case: "if on this screen for 30s, go to screensaver"
  - `sourceSubNodeId` = null
- **Sub-node-level edges**: transition source is a specific interactive sub-node
  - Use case: "if BTN_CONFIRM on Menu Item 1, go to Rapid Fire"
  - `sourceSubNodeId` = the sub-node's ID
- Edge conditions remain the same: button_press, button_hold, timeout, variable, custom
- Visual editor shows connection ports on both the container node AND individual interactive sub-nodes

### 5. OLED Emulator -- Flow Graph Interpreter

**Decision**: Interpret the flow graph directly, no GPC compilation/execution.

- Runs against the flow graph data model in TypeScript
- Renders current state's sub-nodes at 128x64 pixel resolution
- Accepts input via keyboard-mapped controller buttons (D-pad, confirm, back, etc.)
- Evaluates transition conditions and walks the state machine
- Tracks and displays variable state as user navigates
- No GPC compiler needed -- avoids legal concerns around GPC intellectual property

### 6. Default Flow

**Decision**: Every new script gets a default flow graph.

- New scripts auto-generate a `.flow` file with a starter flow graph
- Default graph includes at minimum an intro/home state

---

## Sub-Node Property Details

### Header

```
label:       "Rapid Fire"        # text to display
align:       "center"            # left | center | right
font:        "default"           # default (5x7) | small (3x5) | bold (6x8)
separator:   true                # draw a horizontal line below
paddingTop:  0                   # pixels above text
```

Renders:
```
     Rapid Fire
──────────────────────
```

### Menu Item

```
label:       "Mode"              # display text
cursorStyle: "prefix"            # prefix | invert | bracket | custom-draw
prefixChar:  ">"                 # character when selected (cursorStyle = prefix)
prefixSpacing: 1                 # spaces between prefix and label
customCursor: null               # small pixel array (cursorStyle = custom-draw)
font:        "default"
```

Cursor style options:
- **prefix**: a character before the selected item (`> Mode`)
- **invert**: inverts the entire row (white bg, black text)
- **bracket**: wraps the selected item (`[Mode]`)
- **custom-draw**: user provides a small pixel sprite (e.g. 5x7) drawn next to selected item, opens a tiny pixel editor

Renders (prefix style):
```
> Mode           ← selected (prefix shown)
  Speed          ← not selected
  Hold Time      ← not selected
```

### Toggle Item

```
label:       "Anti-Recoil"
cursorStyle: "prefix"            # same cursor options as Menu Item
prefixChar:  ">"
onText:      "ON"                # text shown when variable = true
offText:     "OFF"
valueAlign:  "right"             # where ON/OFF appears: right | inline
boundVariable: "ar_enabled"      # which flow variable it toggles (see Variable Binding below)
font:        "default"
```

Renders:
```
> Anti-Recoil          ON
  Rapid Fire          OFF
```

### Value Item

```
label:       "Sensitivity"
cursorStyle: "prefix"            # same cursor options as Menu Item
prefixChar:  ">"
min:         1                   # minimum value
max:         20                  # maximum value
step:        1                   # increment per D-pad press
valueAlign:  "right"
format:      "{value}"           # display format, could be "{value}%" or "Lv.{value}"
boundVariable: "sensitivity"     # which flow variable it adjusts (see Variable Binding below)
adjustButtons: ["DPAD_LEFT", "DPAD_RIGHT"]  # buttons to change value
font:        "default"
```

Renders:
```
> Sensitivity          5
```

D-pad left/right adjusts the value in the emulator and in generated code.

### Scroll Bar

```
orientation: "vertical"          # vertical | horizontal
thickness:   3                   # pixels wide (vertical) or tall (horizontal)
style:       "bar"               # bar | dots | blocks
trackVisible: true               # show track background
autoSource:  true                # auto-detect from interactive sub-node count
totalItems:  null                # manual override if autoSource = false
visibleItems: null               # manual override
```

### Text Line

```
label:       "v1.2.3"           # text content
align:       "right"            # left | center | right
font:        "small"
```

### Bar Widget (absorbs current bar widgets)

```
style:       "recessed"          # recessed | gradient | chunky | notched | equalizer
width:       100                 # pixels
height:      8                   # pixels
boundVariable: "health"          # variable that drives the fill
min:         0
max:         100
showLabel:   false               # show value text on the bar
```

### Indicator (absorbs current indicators)

```
style:       "cell-signal"       # cell-signal | led-strip
segments:    4
boundVariable: "signal"
```

### Pixel Art

```
scene:       <base64 data>       # raw 128x64 bitmap (opens OLED pixel editor)
width:       128                 # crop width
height:      64                  # crop height
```

Escape hatch -- opens the existing OLED pixel editor for free-form drawing.

### Separator

```
style:       "line"              # line | dashed | space
thickness:   1                   # pixels
margin:      2                   # pixels above and below
```

### Custom

```
width:       128
height:      8
interactive: false               # does this sub-node accept input?
renderCode:  ""                  # raw GPC: draw calls
interactCode: ""                 # raw GPC: input handling (if interactive)
```

---

## Variable Binding

Toggle Item and Value Item sub-nodes need a variable to read/write.

**Default behavior**: When a Toggle or Value sub-node is added, it **auto-creates a variable on the container node** (e.g. `ar_enabled` for a toggle named "Anti-Recoil", `sensitivity` for a value named "Sensitivity"). Zero-config, just works.

**Override**: The variable field in the property panel is a **dropdown** showing all available variables:

```
Variable: [ar_enabled (this node)    ▾]
           ├── ar_enabled (this node)      ← auto-created default
           ├── rapid_fire_on (this node)   ← other node vars
           ├── global_sensitivity (global) ← global vars
           └── + Create new variable...
```

**Use cases**:
- **Default**: user adds a toggle, variable auto-created, done. No thinking required.
- **Shared state**: two different menu screens both toggle the same global variable (e.g. a settings menu and a quick-toggle menu both control `ar_enabled`)
- **Cross-node references**: a Value Item on the settings screen adjusts `sensitivity`, which a Bar Widget on the home screen displays -- both bound to the same global variable

---

## Cursor Management

The cursor system is **fully auto-managed** -- codegen generates all cursor tracking code, the user never writes it.

### Model

Each container node has an implicit `cursor_index` variable. It tracks which interactive sub-node is currently selected (0-based, only counting interactive sub-nodes).

**Example -- a menu with 5 interactive items**:

```
Container: "Settings Menu"
  [Header: "Settings"]           # not interactive, index N/A
  [Separator]                    # not interactive, index N/A
  [Toggle: "Anti-Recoil"]       # interactive, cursor index 0
  [Toggle: "Rapid Fire"]        # interactive, cursor index 1
  [Toggle: "Turbo"]             # interactive, cursor index 2
  [Value: "Sensitivity"]        # interactive, cursor index 3
  [Menu Item: "Back"]           # interactive, cursor index 4
  [Scroll Bar]                  # not interactive, index N/A
```

### Navigation

D-pad up/down moves cursor_index. Codegen generates:

```c
// Auto-generated cursor logic
if (event_press(BUTTON_8)) {  // DPAD_UP
    if (FlowMenu_cursor > 0) FlowMenu_cursor = FlowMenu_cursor - 1;
}
if (event_press(BUTTON_5)) {  // DPAD_DOWN
    if (FlowMenu_cursor < 4) FlowMenu_cursor = FlowMenu_cursor + 1;
}
```

### Rendering

Each interactive sub-node checks if it's the current cursor position:

```c
// Auto-generated for Toggle "Anti-Recoil" (index 0)
if (FlowMenu_cursor == 0) {
    // draw inverted row (highlight) -- depends on cursorStyle
    pixel_oled_rect(0, 16, 128, 8, 1);
    pixel_oled_string(2, 16, "Anti-Recoil", 0);  // inverted text
} else {
    pixel_oled_string(2, 16, "Anti-Recoil", 1);  // normal text
}
```

### Scrolling / Pagination

When interactive items exceed visible area, the container gets additional properties:

```
visibleCount:  3                 # how many interactive items visible at once
scrollMode:    "window"          # window | wrap
```

- **window**: sliding window of items. If cursor moves past the bottom, the window scrolls down. Scroll bar auto-updates.
- **wrap**: cursor wraps from last item to first (and vice versa).

Codegen adds a `scroll_offset` variable and only draws items within the visible window:

```c
// Auto-generated scroll logic
if (FlowMenu_cursor < FlowMenu_scroll) FlowMenu_scroll = FlowMenu_cursor;
if (FlowMenu_cursor >= FlowMenu_scroll + 3) FlowMenu_scroll = FlowMenu_cursor - 2;

// Only draw items [scroll_offset .. scroll_offset + visibleCount - 1]
```

### Transition Binding

When the user draws an edge from a sub-node, the generated condition includes the cursor check:

```c
// Edge: Menu Item "Back" (index 4) --BTN_CONFIRM--> Home
if (FlowMenu_cursor == 4 && event_press(BUTTON_1)) {
    FlowCurrentState = FLOW_STATE_HOME;
}
```

**The user never writes any of this.** They just:
1. Add interactive sub-nodes
2. Optionally customize cursor style (prefix char, invert, bracket, custom sprite)
3. Draw edges from sub-nodes to targets
4. Set `visibleCount` if they want pagination

---

## Data Model (v2)

### SubNode

```typescript
interface SubNode {
  id: string;
  type: string;                    // 'header' | 'menu-item' | 'toggle-item' | 'value-item' | 'scroll-bar' | 'text-line' | 'bar' | 'indicator' | 'pixel-art' | 'separator' | 'custom'
  label: string;
  position: 'stack' | 'absolute';  // default: 'stack'
  x?: number;                      // only when position = 'absolute'
  y?: number;                      // only when position = 'absolute'
  order: number;                   // stack order (for stacked sub-nodes)
  interactive: boolean;            // can this be a transition source?
  config: Record<string, unknown>; // type-specific configuration (see Sub-Node Property Details)
  // Custom sub-node fields:
  renderCode?: string;             // raw GPC for rendering (custom type only)
  interactCode?: string;           // raw GPC for interaction (custom type only)
  boundVariable?: string;          // variable binding (for toggle/value items, bar, indicator)
}
```

### FlowNode (modified)

```typescript
interface FlowNode {
  // ... existing fields (id, type, label, position, gpcCode, onEnter, onExit, comboCode, variables, isInitialState, chunkRef) ...
  subNodes: SubNode[];             // NEW: replaces oledScene + oledWidgets
  stackOffsetX: number;            // NEW: horizontal offset for stacked sub-nodes
  stackOffsetY: number;            // NEW: vertical offset for stacked sub-nodes
  visibleCount?: number;           // NEW: how many interactive items visible at once (for scrolling)
  scrollMode?: 'window' | 'wrap'; // NEW: scroll behavior
  // REMOVED: oledScene, oledWidgets (absorbed by sub-nodes)
}
```

### FlowEdge (modified)

```typescript
interface FlowEdge {
  // ... existing fields (id, sourceNodeId, targetNodeId, sourcePort, targetPort, label, condition) ...
  sourceSubNodeId?: string | null; // NEW: null = node-level edge, string = sub-node edge
  targetSubNodeId?: string | null; // NEW: for future use (targeting specific sub-node on arrival)
}
```

### SubNodeDef (registry definition)

```typescript
interface SubNodeDef {
  id: string;
  name: string;
  category: string;
  description: string;
  interactive: boolean;            // default interactivity
  defaultConfig: Record<string, unknown>;
  params: SubNodeParam[];          // configurable parameters
  width?: number;                  // pixel width (for absolute positioning)
  height?: number;                 // pixel height
  render: (config, ctx) => void;   // preview rendering function
  generateGpc: (config, ctx) => string; // GPC code generation
}
```

---

## Visual Editor Changes

### Container node rendering (FlowNode.svelte)

- Nodes expand vertically to show their sub-nodes
- Each sub-node rendered as a labeled row inside the container
- Interactive sub-nodes show a connection port (right side circle)
- Container still has its own output port for node-level edges
- Node header shows type + label, body shows sub-node list

**Canvas node sizing**: Dynamic height with a max cap (~250px / ~8 sub-node rows).
- Nodes grow to fit their sub-nodes up to the cap
- When capped, show "... +N more" and an expand button [▼]
- Clicking expand grows the node to full height, click again to collapse
- Hidden sub-node connection ports stack at the bottom edge so edges can still be drawn when collapsed

Visual representation on canvas (normal):

```
┌──────────────────┐
│   Menu Label     │  ← header (type-colored)
├──────────────────┤
│ > [Menu Item 1] ○│  ← interactive, has port
│   [Menu Item 2] ○│  ← interactive, has port
│   [Menu Item 3] ○│  ← interactive, has port
│   [Scroll Bar]   │  ← non-interactive, no port
├──────────────────┤
│ ○ node-level    ○│  ← input/output ports for container
└──────────────────┘
```

Visual representation on canvas (collapsed, exceeds max):

```
┌──────────────────┐
│   Settings       │
├──────────────────┤
│ [Header]         │
│ [Toggle 1]      ○│
│ [Toggle 2]      ○│
│ [Toggle 3]      ○│
│ [Value 1]       ○│
│ ... +3 more      │
│            [▼]   │  ← expand button
├──────────────────┤
│ ○           ○○○ ○│  ← hidden sub-node ports stacked at bottom
└──────────────────┘
```

### Edge rendering (FlowEdge.svelte)

- Edges from sub-node ports route from the sub-node's Y position within the parent
- Edges from node-level ports route from the container's bottom port
- Different visual style for sub-node edges vs node-level edges (optional)
- When a node is collapsed, edges to hidden sub-nodes route from the stacked ports at the bottom

### Property panel (FlowPropertyPanel.svelte)

- When a container node is selected: shows sub-node list with add/remove/reorder
- When a sub-node is selected: shows its type-specific configuration (see Sub-Node Property Details above)
- Sub-node config includes: label, position mode, coordinates (if absolute), type-specific params, cursor style, variable binding
- Existing code tabs (Main/Enter/Exit/Combo) remain on the container node

---

## OLED Emulator Design

### Core

- TypeScript-based flow graph interpreter
- Maintains: currentState, variables, cursor position per state, timer
- On each "frame": renders sub-nodes for current state, checks transition conditions

### Rendering

- HTML Canvas at 128x64, scaled up for display (4x = 512x256)
- Each sub-node type has a `render()` that draws to the pixel buffer
- Stacked sub-nodes auto-position, absolute sub-nodes use their x,y
- Cursor highlight on interactive sub-nodes based on cursorStyle

### Input

Default keyboard mappings (configurable in flow settings):

```
Controller          Keyboard
─────────────────────────────
D-pad Up            Arrow Up
D-pad Down          Arrow Down
D-pad Left          Arrow Left
D-pad Right         Arrow Right
Cross / A           Enter
Circle / B          Backspace
Triangle / Y        T
Square / X          X
L1 / LB             Q
R1 / RB             E
L2 / LT             Z
R2 / RT             C
Share / Back        Tab
Options / Start     Space
```

### State Machine

- Evaluate node-level conditions every frame (timeouts, variable checks)
- Evaluate sub-node conditions on input (button press on specific item)
- On transition: run onExit of current state, switch state, run onEnter of new state
- Track FlowStateTimer for timeout conditions
- D-pad up/down auto-moves cursor between interactive sub-nodes

### UI -- Fullscreen Emulator

Dedicated fullscreen view for testing:

```
┌──────────────────────────────────────────────┐
│            OLED Emulator                [x]  │
├──────────────────────────────────────────────┤
│                                              │
│         ┌────────────────────────┐           │
│         │                        │           │
│         │    128x64 display      │           │
│         │    (scaled 4x)         │           │
│         │                        │           │
│         └────────────────────────┘           │
│                                              │
│  State: Settings > Rapid Fire                │
│  Path: Home -> Settings -> Rapid Fire        │
│                                              │
│  ┌─ Variables ─────┐  ┌─ Input Log ────────┐ │
│  │ ar_enabled: 1   │  │ > BTN_CONFIRM      │ │
│  │ sensitivity: 5  │  │ > DPAD_DOWN        │ │
│  │ cursor: 2       │  │ > DPAD_DOWN        │ │
│  │ scroll: 0       │  │ > BTN_CONFIRM      │ │
│  └─────────────────┘  └────────────────────┘ │
│                                              │
│        [Reset]  [Step]  [Key Map]            │
└──────────────────────────────────────────────┘
```

Features:
- **State path breadcrumb**: shows how you got to the current state
- **Input log**: history of button presses
- **Variable inspector**: current state + all variable values
- **Reset button**: go back to initial state
- **Step mode**: advance one frame at a time (useful for debugging timeouts)

---

## Migration Path

1. Add SubNode type and update FlowNode to include `subNodes` array
2. Keep `oledScene` and `oledWidgets` as deprecated fields for backwards compat
3. Migration function: convert existing WidgetPlacements to SubNodes with absolute positioning
4. Convert existing oledScene to a Pixel Art sub-node
5. Update FlowEdge with optional `sourceSubNodeId`
6. Build sub-node registry (migrate existing widget defs)
7. Update FlowNode.svelte to render sub-nodes inside container
8. Update FlowPropertyPanel.svelte for sub-node editing
9. Update codegen to compose sub-node outputs
10. Build OLED emulator
11. Remove old widget system once migration is complete

---

## Resolved: Chunk System

**Decision**: Full templates only, no partial/layout templates.

Chunks are complete container templates with pre-configured sub-nodes. Example:

```
Chunk: "Menu Page (3 Items)"
  Container: type=menu
    [Header: "Menu Title"]           ← param: title text
    [Menu Item: "Item 1"]            ← param: label
    [Menu Item: "Item 2"]            ← param: label
    [Menu Item: "Item 3"]            ← param: label
  Edge templates:
    - Each menu item → (unlinked, user connects)
    - Container → screensaver (timeout 30s)
```

User drops a chunk, gets the full thing, deletes/adds sub-nodes as needed. Simple, no extra concepts.

---

## All Design Decisions -- Summary

All questions have been resolved. This document is the complete spec for Flow Editor v2.

| # | Topic | Decision |
|---|-------|----------|
| 1 | Sub-nodes vs widgets | Sub-nodes replace widgets entirely |
| 2 | Code ownership | Hybrid: declarative built-ins + custom raw code |
| 3 | Layout model | Stack with per-sub-node absolute override + container offsets |
| 4 | Transition sources | Both node-level and sub-node-level edges coexist |
| 5 | Emulator approach | Interpret flow graph directly, no GPC compilation |
| 6 | Variable binding | Auto-create on node by default, dropdown to pick any variable |
| 7 | Cursor management | Fully auto-managed by codegen, user configures style only |
| 8 | Cursor styling | prefix / invert / bracket / custom-draw (small pixel sprite) |
| 9 | Emulator UI | Fullscreen dedicated view with variable inspector + input log |
| 10 | Chunk system | Full templates only, no partial/layout templates |
| 11 | Canvas node sizing | Dynamic height with max cap (~250px), expand/collapse button |
