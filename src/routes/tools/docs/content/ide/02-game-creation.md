# Game Creation {ide}

Games are created using the **Game Wizard**, accessible via the **New Game** button at the bottom of the sidebar.

## Wizard Steps

The wizard guides you through four steps:

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
- You can add or remove modules later from the config editor

### 3. Configure

Set initial parameters for the selected modules:

- **Quick toggle keys**: Assign controller buttons to toggle modules on/off
- **Module parameters**: Set default values for module options
- **Weapon names**: If using weapondata, define your weapon/loadout names

### 4. Review & Create

Review your configuration and create the game. The wizard generates:

- A `config.toml` file with your settings
- Module GPC files for each selected module
- A main GPC file that ties everything together
- Supporting files for menus, persistence, and data

## Game Types

GPC IDE has three built-in game types:

| Type  | Description                                     |
| ----- | ----------------------------------------------- |
| `fps` | First-person shooters (also used for TPS games) |
| `tps` | Third-person shooters (shares modules with FPS) |
| `fgs` | Fighting games                                  |

You can create custom game types in **Settings > Game Types**. Custom types have their own module pools — you can create modules that target your custom type specifically.

## Game Folder Structure

After creation, each game folder contains:

```
my-game/
  config.toml          # Main configuration
  main.gpc             # Entry point (generated)
  menu.gpc             # OLED menu system (generated)
  persistence.gpc      # Save/load system (generated)
  data.gpc             # Data definitions (generated)
  antirecoil.gpc       # Module files (generated)
  rapidfire.gpc        # ...
  custom_code.gpc      # User-created files (editable)
```

Generated files are protected and cannot be deleted through the IDE. They are regenerated on each build.
