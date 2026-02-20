# Dependency Graph {ide}

The Dependency Graph visualizes relationships between modules — conflicts and dependencies — as an interactive node graph. Access it from **Tools > Dependency Graph** in the sidebar.

## Overview

When building a game configuration with multiple modules, it's important to understand which modules conflict with each other and which have dependencies. The Dependency Graph renders all modules as nodes arranged in a circle, with edges showing their relationships.

## Interface

### Graph Canvas

Modules are displayed as colored circular nodes arranged in a radial layout:

- **Node colors** indicate game type:
  - Green = FPS
  - Blue = TPS
  - Pink = FGS
  - Purple = All
- **Red dashed lines** = conflicts (modules that cannot be enabled together)
- **Green solid lines** = dependencies (e.g., modules that require weapon data)

### Interaction

- **Click a node** to select it and highlight its relationships
- Unrelated modules fade to 20% opacity, making the selected module's connections stand out
- Click the same node again to deselect
- **Click a connected module** in the detail panel to navigate to it

### Detail Panel (Right)

When a module is selected, the panel shows:

- Module name, ID, and type
- List of conflicting modules (clickable)
- Dependencies (clickable)
- Option and parameter counts

### Filter

Use the **Filter** dropdown in the header to show only modules of a specific game type, or select "All Types" to see everything.

## Legend

The legend in the detail panel explains the visual encoding:

| Visual | Meaning |
|--------|---------|
| Red dashed line | Conflict |
| Green solid line | Dependency |
| Green node | FPS module |
| Blue node | TPS module |
| Pink node | FGS module |
| Purple node | All-type module |
