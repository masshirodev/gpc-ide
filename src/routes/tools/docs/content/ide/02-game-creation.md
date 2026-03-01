# Game Creation {ide}

Games are created using the **Game Wizard**, accessible via the **New Game** button at the bottom of the sidebar. You can also create games from templates using **New from Template**.

## Wizard Steps

The wizard guides you through configuring a new game:

### 1. Game Info

Configure the basic properties of your game:

- **Game Name**: Internal identifier used for the folder name (e.g., `warzone`)
- **Display Name**: Human-readable name shown in menus and the OLED display
- **Game Type**: Category of the game — determines which modules are available
- **Console Type**: Target console platform (PS5, PS4, Xbox, Switch, etc.)
- **Version**: Starting version number for the game
- **Profiles**: Number of weapon/loadout profiles (0 for none)

### 2. Module Selection

Browse and select modules to include in your game. Modules are pre-built features like anti-recoil, rapid fire, and aim assist. They are filtered by your selected game type.

- Modules marked with conflicts will warn you if incompatible modules are selected together
- Some modules require the **Weapondata** module (for per-weapon settings)
- You can add or remove modules later

### 3. Configure

Set initial parameters for the selected modules:

- **Quick toggle keys**: Assign controller buttons to toggle modules on/off
- **Module parameters**: Set default values for module options
- **Weapon names**: If using weapondata, define your weapon/loadout names

### 4. Review & Create

Review your configuration and create the game. The wizard generates the project files based on your chosen generation mode.

## Generation Modes

### Flow-Based (Default)

The modern approach. Games use:

- `game.json` — Game metadata (name, filename, version, generation mode, tags)
- `flows.json` — Flow graph data (nodes, edges, variables, sub-nodes)
- Additional user-created `.gpc` files

Design your OLED menus and game logic in the **Flow Editor**. Code is generated from the visual state machine.

### Config-Based (Legacy)

The traditional approach. Games use:

- `config.toml` — Full game configuration (buttons, modules, menu items, variables)
- Generated `.gpc` files (main, menu, persistence, data, per-module)
- User-created `.gpc` files

Configure via the GUI config editor or raw TOML editing.

## Game Types

GPC IDE has three built-in game types:

| Type  | Description                                     |
| ----- | ----------------------------------------------- |
| `fps` | First-person shooters (also used for TPS games) |
| `tps` | Third-person shooters (shares modules with FPS) |
| `fgs` | Fighting games                                  |

You can create custom game types in **Settings > Game Types**. Custom types have their own module pools — you can create modules that target your custom type specifically.

## Project Templates

Save any game as a template to reuse its configuration:

- **Save as Template**: From the game context menu, save the current game as a reusable template
- **New from Template**: Create a new game pre-configured with a template's settings
- **Import Template**: Load templates shared by other users

## Game Import/Export

- **Export as ZIP**: Package a complete game project for sharing
- **Import ZIP**: Load a shared game project into your workspace

## Sidebar Features

Games appear in the sidebar grouped by type. Additional features:

- **Pin games**: Star frequently used games for quick access at the top
- **Recent files**: Quick access to recently opened files
- **Tags**: Filter games by custom tags
- **Delete**: Remove games from the context menu
