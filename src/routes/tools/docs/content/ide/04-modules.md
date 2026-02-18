# Modules {ide}

Modules are reusable, self-contained features that can be added to any game. They define their own GPC code, OLED menu entries, configuration options, and persistence variables.

## How Modules Work

Each module is defined in a TOML file and contains:

- **Metadata**: Name, description, game type compatibility, conflict declarations
- **Code**: Trigger logic (runs in `main`) and combo blocks
- **Options**: User-configurable parameters shown in the OLED menu
- **Extra variables**: Additional runtime variables the module needs

When you add a module to a game, the build pipeline generates:

1. A dedicated `.gpc` file with the module's code
2. OLED menu entries for the module's options
3. Persistence entries so settings are saved to the device
4. Data declarations for module variables

## Module TOML Format

Here's the structure of a module definition:

```toml
[module_id]
display_name = "My Module"
id = "my_module"
type = "fps"
description = "What this module does."
state_display = "MM"        # 2-char label on OLED
status_var = "MyModStatus"  # Toggle variable name
has_quick_toggle = true
conflicts = ["other_module"]

# Trigger code — runs in main { } every cycle
trigger = "if (MyModStatus && condition) { combo_run(MyCombo); }"

# Combo definition — the actual feature logic
combo = "combo MyCombo { /* ... */ }"
```

### Options

Options define user-configurable values that appear in the OLED menu:

```toml
[[module_id.options]]
name = "Status"
var = "MyModStatus"
type = "toggle"        # toggle, value, button, key
default = 0

[[module_id.options]]
name = "Strength"
var = "MyModStrength"
type = "value"
min = 0
max = 100
default = 50
```

**Option types:**

- `toggle` — On/Off switch (0 or 1)
- `value` — Numeric value with min/max range
- `button` — Controller button selector
- `key` — Keyboard key selector

### Extra Variables

Additional variables the module needs at runtime:

```toml
[module_id.extra_vars]
my_counter = "int"
my_timer = "int"
```

### Conflicts

Modules can declare conflicts with other modules. The IDE warns users when conflicting modules are selected together:

```toml
conflicts = ["antirecoil_decay", "antirecoil_timeline"]
```

## Built-in Modules

GPC IDE ships with a library of built-in modules for common game features:

| Module                 | Type | Description                               |
| ---------------------- | ---- | ----------------------------------------- |
| Anti Recoil            | FPS  | Basic recoil compensation                 |
| Anti Recoil (Decay)    | FPS  | Recoil compensation with decay over time  |
| Anti Recoil (Timeline) | FPS  | Per-weapon recoil with phase-based values |
| Aim Assist (Circular)  | FPS  | Circular aim assist pattern               |
| Aim Assist (Polar)     | FPS  | Polar coordinate aim assist               |
| Rapid Fire             | FPS  | Automatic rapid fire on trigger           |
| Drop Shot              | FPS  | Auto-crouch while shooting                |
| Slide Cancel           | FPS  | Automated slide cancel                    |
| Turbo                  | FGS  | Rapid button press for fighting games     |
| Auto Block             | FGS  | Automatic blocking                        |
| Easy Motion            | FGS  | Simplified motion inputs                  |
| Anti AFK               | All  | Prevents idle disconnection               |
| Auto Run               | All  | Automatic sprint                          |

## User Modules

You can create your own modules using the **Module Manager** tool. User modules are stored in your workspace and can be shared between games.

## Module Manager

Access via **Tools > Module Manager** in the sidebar. The Module Manager lets you:

- Browse all available modules (built-in and user-created)
- Search and filter by name or type
- View module details and code
- Create new modules with the form-based editor
- Edit existing user modules
- Delete user modules
