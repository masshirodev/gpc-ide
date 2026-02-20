# Module Manager {ide}

The Module Manager lets you browse, create, and edit module definitions used by the GPC generation pipeline. Access it from **Tools > Module Manager** in the sidebar.

## Overview

Modules are the building blocks of GPC game scripts. Each module defines a gameplay feature (e.g., rapid fire, anti-recoil) with its trigger code, combo logic, menu options, and metadata. The Module Manager provides a GUI for working with these TOML-based definitions.

## Interface

The tool uses a two-panel layout:

### Module List (Left)

Browse all available modules:

- **Search**: Filter modules by name, ID, or description
- **Filter tabs**: Show All, User-created, or Built-in modules
- **Module count**: Displayed in the footer
- User modules show a delete button on hover

### Detail / Form Panel (Right)

View module details or edit module definitions:

- **Browse mode**: Displays all module properties, options, code, and metadata
- **Create mode**: Form for defining a new module from scratch
- **Edit mode**: Modify an existing user module (built-in modules are read-only)

## Creating a Module

1. Click **+ New Module** in the top bar
2. Fill in the required fields:
   - **Module ID**: Lowercase identifier (e.g., `my_feature`) — cannot be changed after creation
   - **Display Name**: Human-readable name shown in menus
   - **Game Type**: Which game type this module applies to (FPS, TPS, FGS, or All)
3. Optionally configure:
   - **Description**: Brief explanation of what the module does
   - **State Display**: Short label shown on the OLED (e.g., "RF")
   - **Status Variable**: GPC variable name for tracking on/off state
   - **Quick Toggle**: Whether the module can be toggled with a button hold
4. Add **Menu Options** — toggles or value sliders that appear in the OLED menu
5. Write **Trigger Code** — GPC code that runs in the main loop
6. Write **Combo Code** — the GPC combo definition
7. Click **Create Module** to save

## Advanced Options

Expand the Advanced Options section for:

- **Flags**: Needs Weapondata, Needs Recoil Table, Requires Keyboard File
- **Menu Priority**: Controls ordering in the OLED menu (lower = earlier)
- **Conflicts**: List module IDs that cannot be enabled alongside this one
- **Extra Variables**: Additional GPC variables the module needs declared
- **Setup Parameters**: Values prompted during module setup (e.g., button selection)
- **Config Menu**: Custom OLED submenu with display, edit, and render functions

## Module Storage

- **Built-in modules**: Bundled with the application in the `modules/` directory
- **User modules**: Saved to `<workspace>/modules/` as TOML files
- Only user modules can be edited or deleted
