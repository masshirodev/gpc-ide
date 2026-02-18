# GPC Language Overview

GPC (GamePack Composer) is the scripting language used by Cronus Zen devices. It is a C-like language designed for real-time game controller input processing. Anyone from a novice to expert programmer can pick it up quickly, while its C-based syntax makes it familiar to experienced developers.

## Key Characteristics

- **C-like syntax**: Familiar syntax with braces, semicolons, and standard operators
- **Real-time execution**: Code runs in a continuous loop on the device
- **Integer-only arithmetic**: No floating-point numbers — all values are 16-bit signed integers (-32,768 to 32,767)
- **Controller-centric**: Built-in constants and functions for reading/writing controller inputs
- **Event-driven**: Detect button presses, releases, and hold durations
- **Compiled**: Scripts are compiled to bytecode in the IDE before being sent to the device

## Script Structure

A GPC script must follow this section ordering:

1. **Definitions** (optional) — Named constants via `define`
2. **Data** (optional) — Read-only byte arrays
3. **Remapping** (optional) — Input-to-output remaps
4. **Variables** (optional) — Mutable variable declarations
5. **Init** (optional) — One-time setup code
6. **Main** (required) — Continuous execution loop
7. **Combos** (optional) — Timed action sequences
8. **Functions** (optional) — Reusable code blocks

```gpc
// Definitions
define MY_CONSTANT = 42;

// Variables
int myVar;
int myArray[10];

// Initialization (runs once on startup)
init {
    myVar = 0;
}

// Main loop (runs every cycle, ~10ms)
main {
    if (get_val(PS5_R2)) {
        combo_run(MyCombo);
    }
}

// Combo blocks
combo MyCombo {
    set_val(PS5_R2, 100);
    wait(50);
    set_val(PS5_R2, 0);
    wait(50);
}

// User-defined functions (must be declared last)
function myFunction(x, y) {
    return x + y;
}
```

## Execution Model

GPC scripts are compiled to bytecode and executed on a stack-based virtual machine (VM):

1. Controller inputs reach the VM
2. **init** runs once when the script loads
3. **main** runs every cycle (~10ms interval)
4. Code executes top-to-bottom within main — order matters
5. After main completes, remaps are applied and the output report is sent to the console
6. **Combos** run asynchronously when activated

The VM is optimized for speed with minimal error checking, so understanding the language fundamentals is important for writing correct scripts.

## Comments

```gpc
// Single-line comment

/* Multi-line
   comment */
```

Multi-line comments cannot be nested.

## Imports

Include other GPC files with the `import` statement:

```gpc
import filename.gpc;     // Include another file, .gpc extension is optional
```
