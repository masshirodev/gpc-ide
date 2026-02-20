# Script Templates {ide}

Script Templates generate boilerplate code and flow graphs for common GPC scripting patterns. Access it from **Tools > Templates** in the sidebar.

## Overview

Choose from parameterized templates for state machines, menus, persistence, animations, and utilities. Configure the parameters, generate the output, and either open the result in the Flow Editor or copy the GPC code to your clipboard.

## Interface

### Template List (Left)

- **Category tabs**: All, State Machines, Menus, Persistence, Display, Utilities
- Each card shows name, description, output type (Flow or Code), and tags
- Click a template to select it

### Configuration (Center)

- **Parameter controls** that vary per template: text, numbers, booleans, dropdowns
- **Generate** button to produce the output
- Template description and parameter hints

### Output Preview (Right)

- **Flow output**: node list with type colors, edge connections with labels, node count
  - **Open in Flow Editor** button to transfer the generated graph
- **Code output**: Monaco editor with GPC syntax highlighting
  - **Copy Code** button

## Available Templates

### State Machine

Generates a linear state machine flow graph with configurable states.

- **Parameters**: flow name, number of states (2-10), include intro screen, transition type (button/timeout)

### OLED Menu Navigation

Creates a cyclic menu flow with home screen, pages, and optional settings submenu.

- **Parameters**: menu name, page count (2-8), include submenu, navigation button

### Save/Load via SPVAR

Generates LoadSettings, SaveSettings, and UpdateSetting functions for SPVAR persistence.

- **Parameters**: variable count (1-16), auto-save toggle

### Screensaver Flow

Creates an active-to-screensaver state machine with configurable idle timeout.

- **Parameters**: flow name, idle timeout (5s-300s), wake button

### Quick Toggle

Generates feature toggle functions with rumble feedback.

- **Parameters**: feature count (1-8), modifier button (L3/R3/Share/Options)

### Digital Clock Display

Generates ClockTick and DrawClock functions for OLED time display.

- **Parameters**: blink colon, X/Y position, include date

## Features

- **Two output types**: Flow Graph (opens in Flow Editor) or GPC Code (copy to clipboard)
- **Parameterized generation** with descriptions for each setting
- **Flow preview** with color-coded nodes and edge labels
- **Live regeneration** when parameters change
