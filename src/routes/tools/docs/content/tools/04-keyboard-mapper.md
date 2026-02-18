# Keyboard Mapper

The Keyboard Mapper lets you visually assign keyboard keys to controller inputs for PC gaming with a Cronus Zen. Access it from **Tools > Keyboard Mapper** in the sidebar.

## Overview

When gaming on PC, you may want to use keyboard and mouse inputs mapped to controller buttons. The Keyboard Mapper provides a visual interface for creating these mappings.

## Interface

The tool uses a three-panel layout:

### Source Panel (Left)

Shows available keyboard keys and mouse buttons:

- Standard keyboard keys (A-Z, 0-9, function keys, etc.)
- Mouse buttons (left, right, middle, scroll)
- Modifier keys (Ctrl, Shift, Alt)

### Controller Diagram (Center)

A visual representation of the target controller:

- Shows all buttons, triggers, and stick axes
- Highlights buttons that have mappings assigned
- Click a controller input to select it for mapping

### Mapping List (Right)

Shows all current key-to-button assignments:

- Each row shows a keyboard key mapped to a controller input
- Remove mappings by clicking the delete button
- Clear all mappings with the reset button

## Creating Mappings

1. Click a controller input on the diagram (or select from the list)
2. Press a keyboard key or click a mouse button
3. The mapping appears in the mapping list
4. Repeat for all desired mappings

## Axis Mappings

Analog stick axes use directional suffixes:

| Mapping   | Description       |
| --------- | ----------------- |
| `PS5_LX-` | Left stick left   |
| `PS5_LX+` | Left stick right  |
| `PS5_LY-` | Left stick up     |
| `PS5_LY+` | Left stick down   |
| `PS5_RX-` | Right stick left  |
| `PS5_RX+` | Right stick right |
| `PS5_RY-` | Right stick up    |
| `PS5_RY+` | Right stick down  |

## Integration with Editor

The Keyboard Mapper integrates with the main editor:

- Mappings are stored in the `[keyboard]` section of `config.toml`
- Opening a game's keyboard configuration launches the mapper with existing mappings
- Changes are saved back to the config automatically
