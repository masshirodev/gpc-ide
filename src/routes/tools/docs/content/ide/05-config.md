# Configuration {ide} {required}

Each game's behavior is defined by its `config.toml` file. This file controls everything from button mappings to OLED menu layout to module parameters.

## Config Structure

A `config.toml` file contains these sections:

### Top-Level Properties

```toml
filename = "my_game"
name = "My Game"
version = 1
type = "fps"
console_type = "ps5"
username = "Player"
profile_count = 4
weapons = ["AR", "SMG", "Sniper", "Shotgun"]
```

| Field           | Description                                    |
| --------------- | ---------------------------------------------- |
| `filename`      | Output filename (without extension)            |
| `name`          | Display name for the game                      |
| `version`       | Version number                                 |
| `type`          | Game type (fps, tps, fgs, or custom)           |
| `console_type`  | Target console (ps5, ps4, xbox, switch, etc.)  |
| `username`      | Creator name shown on OLED                     |
| `profile_count` | Number of weapon/loadout profiles (0 for none) |
| `weapons`       | List of weapon/profile names                   |

### State Screen

Controls the OLED title screen:

```toml
[state_screen]
title = "MY GAME"
profile_labels = ["AR", "SMG", "SNP", "SG"]
```

### Buttons

Maps controller buttons for menu navigation and core functions:

```toml
[buttons]
menu_mod = "PS5_L1"
menu_btn = "PS5_OPTIONS"
confirm = "PS5_R1"
cancel = "PS5_L1"
up = "PS5_UP"
down = "PS5_DOWN"
left = "PS5_LEFT"
right = "PS5_RIGHT"
fire = "PS5_R2"
ads = "PS5_L2"
```

### Keyboard Mappings

Map keyboard keys to controller inputs:

```toml
[keyboard]
"K_A" = "PS5_LX-"
"K_D" = "PS5_LX+"
"K_W" = "PS5_LY-"
"K_S" = "PS5_LY+"
```

### Custom Includes

Include additional GPC files in specific sections of the generated code:

```toml
[custom_includes]
data = ["my_data.gpc"]
menu = ["custom_menu.gpc"]
persistence = ["extra_persistence.gpc"]
```

### Menu Items

Define OLED menu entries. Each item appears as a page in the on-device menu:

```toml
[[menu]]
name = "Anti Recoil"
type = "clickable"
module = "antirecoil"
state_display = "AR"
status_var = "AntiRecoilStatus"
```

**Menu item types:**

- `clickable` — Opens a submenu with editable options
- `toggle` — Simple on/off toggle
- `value` — Numeric value editor
- `selector` — Choose from a list of options
- `dependent_selector` — Selector whose options depend on another value

### Extra Variables & Defines

Add custom variables or preprocessor defines:

```toml
[extra_vars]
my_var = "int"

[extra_defines]
MY_CONSTANT = "42"
```

### Module Parameters

Override default module option values:

```toml
[module_params.antirecoil]
Recoil_Vertical = "20"
Recoil_Horizontal = "5"
```

## Config Editor (GUI)

The GUI config editor provides a visual interface for editing `config.toml` without manual TOML editing:

- **General tab**: Edit top-level properties and buttons
- **Menu tab**: Drag-and-drop menu item ordering, add/remove items
- **Modules tab**: View and configure installed modules
- **Advanced tab**: Extra variables, defines, and custom includes

You can switch between GUI and raw TOML editing at any time. Changes in one mode are reflected in the other.
