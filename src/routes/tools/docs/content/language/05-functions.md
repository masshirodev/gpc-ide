# Functions

GPC provides built-in functions for controller I/O, math, combos, OLED display, and more, plus the ability to create your own.

## User-Defined Functions

Create reusable functions with the `function` keyword. Functions must be declared last in the script, after `main` and `combo` sections.

```gpc
function add(a, b) {
    return a + b;
}

// Call it from main, init, combo, or other functions
int result = add(10, 20);
```

Key rules:

- Parameters act as local variables — not accessible outside the function
- No type specification needed (all values are integers)
- `return` sends a value back (returns 0 if omitted)
- Multiple return points are allowed
- GPC does **not** support recursive function calls
- Functions can run any code valid in main

## Controller Input Functions

| Function                           | Description                                          |
| ---------------------------------- | ---------------------------------------------------- |
| `get_val(identifier)`              | Get current input value (-100 to 100)                |
| `set_val(identifier, value)`       | Overwrite output value sent to console               |
| `get_lval(identifier)`             | Get previous cycle's input value                     |
| `get_ptime(identifier)`            | Get press duration in ms (0–32,767)                  |
| `get_brtime(identifier)`           | Get time since last press in ms                      |
| `event_press(identifier)`          | TRUE when button changes from released to pressed    |
| `event_release(identifier)`        | TRUE when button changes from pressed to released    |
| `get_ival(identifier)`             | Get raw input value (before script modification)     |
| `block(identifier, ms)`            | Block button input for duration (20–4000ms)          |
| `block_all_inputs()`               | Block all output for this cycle of main              |
| `swap(id1, id2)`                   | Swap two input values temporarily                    |
| `sensitivity(id, midpoint, sens)`  | Adjust stick sensitivity (midpoint %, sensitivity %) |
| `deadzone(x_id, y_id, dz_x, dz_y)` | Set stick deadzone (square or circular)              |
| `stickize(x_id, y_id, radius)`     | Transform input to analog stick output               |

## Event Detection

```gpc
main {
    if (event_press(PS5_R2)) {
        // Fires once when R2 is first pressed
    }
    if (event_release(PS5_R2)) {
        // Fires once when R2 is released
    }
    if (get_ptime(PS5_R2) > 500) {
        // R2 has been held for more than 500ms
    }
}
```

## Math Functions

All math operates on signed 16-bit integers (-32,768 to 32,767). Be aware of overflow risks with `pow` and multiplication.

| Function             | Description                                   |
| -------------------- | --------------------------------------------- |
| `abs(x)`             | Absolute value                                |
| `inv(x)`             | Invert value (multiply by -1)                 |
| `pow(base, exp)`     | Raise base to power (risk of overflow)        |
| `isqrt(x)`           | Integer square root (fractions dropped)       |
| `clamp(x, min, max)` | Clamp value between min and max               |
| `random(min, max)`   | Random integer between min and max (Zen only) |

## Polar / Stick Functions

| Function                          | Description                                     |
| --------------------------------- | ----------------------------------------------- |
| `set_polar(stick, angle, radius)` | Set stick using polar coordinates (angle 0–359) |
| `get_polar(x_id, y_id)`           | Get polar angle from stick axes                 |
| `get_ipolar(x_id, y_id)`          | Get polar angle from raw (unmodified) inputs    |

## Remapping

Remapping is done via declarations (not function calls) before `main`:

```gpc
remap PS5_CROSS -> PS5_SQUARE;  // Redirect input
unmap PS5_TRIANGLE;              // Disconnect from output
unmap ALL_REMAPS;                // Remove all remaps
```

Remaps are applied after main finishes each cycle. Unmapped buttons don't send output but can still be read in script logic.

## Bit Operations

Operate on individual bits within 16-bit variables (bit index 0–15):

| Function                            | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `set_bit(var, bit)`                 | Set a specific bit to 1                     |
| `clear_bit(var, bit)`               | Clear a specific bit to 0                   |
| `test_bit(var, bit)`                | Returns TRUE if bit is set                  |
| `set_bits(var, value, index, mask)` | Store a value at bit index using bit mask   |
| `get_bits(var, index, mask)`        | Extract a value at bit index using bit mask |

## System / Device Functions

| Function           | Description                                    |
| ------------------ | ---------------------------------------------- |
| `get_rtime()`      | Elapsed time between main iterations (ms)      |
| `get_slot()`       | Get active memory slot number                  |
| `load_slot(slot)`  | Load a different slot (0–8 on Zen)             |
| `get_console()`    | Get connected console type                     |
| `get_controller()` | Get controller type                            |
| `get_battery()`    | Get battery level (0–10, or 11 = charging)     |
| `get_ctrlbutton()` | Get current control button setting             |
| `vm_tctrl(value)`  | Adjust VM timing for next iteration (-9 to 10) |
| `turn_off()`       | Turn off connected wireless controller         |

## OLED Display Functions

| Function                                      | Description                      |
| --------------------------------------------- | -------------------------------- |
| `cls_oled(color)`                             | Clear screen (0=black, 1=white)  |
| `pixel_oled(x, y, color)`                     | Draw a pixel                     |
| `line_oled(x, y, tox, toy, thickness, color)` | Draw a line                      |
| `rect_oled(x, y, w, h, fill, color)`          | Draw a rectangle                 |
| `circle_oled(x, y, r, fill, color)`           | Draw a circle                    |
| `putc_oled(position, ascii)`                  | Put character into string buffer |
| `puts_oled(x, y, font, length, color)`        | Draw buffered string             |
| `printf(x, y, font, color, stringaddr)`       | Draw a string from data offset   |
| `image_oled(x, y, image)`                     | Draw an image                    |

## Persistence Functions

| Function                 | Description                 |
| ------------------------ | --------------------------- |
| `get_pvar(index)`        | Read a persistent variable  |
| `set_pvar(index, value)` | Write a persistent variable |

Persistent variables (PVARs) survive device reboots. They are used to save user settings. Available as `PVAR_1` through `PVAR_64` and `SPVAR_1` through `SPVAR_64`.

## Rumble / LED Functions

| Function                            | Description                                       |
| ----------------------------------- | ------------------------------------------------- |
| `get_rumble(motor)`                 | Get rumble motor speed (0–100%)                   |
| `set_rumble(motor, value)`          | Set rumble motor speed                            |
| `block_rumble()`                    | Block rumble output                               |
| `reset_rumble()`                    | Reset rumble to default                           |
| `get_led(led)`                      | Get LED state (0=off, 1=on, 2=fast blink, 3=slow) |
| `set_led(led, state)`               | Set LED state                                     |
| `set_ledx(led, blinks)`             | Blink LED a number of times (0–255, 0=on)         |
| `get_ledx()`                        | Check if LED is being blinked by set_ledx         |
| `reset_leds()`                      | Return LED control to the console                 |
| `get_ps4_lbar(state, range, color)` | Get PS4 lightbar LED state                        |
| `set_ps4_lbar(r, g, b)`             | Set PS4 lightbar color (0–255 each)               |
| `set_rgb(r, g, b)`                  | Set Zen RGB LED color (0–255 each)                |
| `set_hsb(h, s, b)`                  | Set Zen LED via HSB (hue 0–359, sat/bright 0–100) |

## Keyboard Functions

| Function            | Description                      |
| ------------------- | -------------------------------- |
| `get_keyboard(key)` | Check if keyboard key is pressed |
| `get_modifiers()`   | Get active modifier keys         |

## PS4 Touchpad Functions

| Function                 | Description                                 |
| ------------------------ | ------------------------------------------- |
| `ps4_touchpad(constant)` | Get touchpad state (P1/P2 position, active) |
| `ps4_set_touchpad(x, y)` | Simulate finger contact at coordinates      |

## Data Access Functions

| Function       | Description                        |
| -------------- | ---------------------------------- |
| `dbyte(index)` | Get 8-bit unsigned value from data |
| `dchar(index)` | Get 8-bit signed value from data   |
| `dword(index)` | Get 16-bit signed value from data  |
