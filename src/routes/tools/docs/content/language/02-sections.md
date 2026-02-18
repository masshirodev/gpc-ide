# Sections {language}

GPC programs are organized into named sections that must appear in a specific order.

## define {optional}

The definition section assigns values to named constants. Definitions must appear at the very beginning of the script and cannot be changed at runtime.

```gpc
define FIRE_RATE = 40;
define MAX_RECOIL = 100;
```

Definitions can be used inside the `data` section and anywhere else in the script.

## data {optional}

The data section stores static, read-only byte values at the beginning of the bytecode's virtual address space. Values are accessed via index-based retrieval.

```gpc
data(20, 42, 35, 255, 1, 100, 0, 86);
```

Access data with these functions:

| Function        | Description                            |
| --------------- | -------------------------------------- |
| `dbyte(index)`  | Get 8-bit unsigned value at index      |
| `dchar(index)`  | Get 8-bit signed value at index        |
| `dword(index)`  | Get 16-bit signed value from two bytes |
| `duint8(index)` | Alias for dbyte                        |
| `dint8(index)`  | Alias for dchar                        |
| `dint16(index)` | Alias for dword                        |

Definitions declared before the data section can be used within it:

```gpc
define myValue = 255;
data(20, 42, myValue, 100);
```

## remap {optional}

Remapping redirects controller inputs to different outputs. Remaps are defined before `main` and are applied after each main loop iteration completes.

```gpc
remap PS5_CROSS -> PS5_SQUARE;
```

Use `unmap` to disconnect an input from the output report (the button can still be read in script logic):

```gpc
unmap PS5_TRIANGLE;
```

> When scripting with remapped buttons, reference the original input identifiers — remaps don't apply until after main finishes.

## Variables {optional}

Variable declarations must appear before `init` and `main`. Variables are global and accessible from any section. They default to 0 if no value is specified.

```gpc
int myVar;
int counter = 10;
int values[5];
```

## init {optional}

The `init` section runs once when the script first loads. It's commonly used for console-specific setup and variable initialization.

```gpc
int FIRE_BTN;

init {
    if (get_console() == PIO_PS3) {
        FIRE_BTN = 3;
    } else {
        FIRE_BTN = 4;
    }
}
```

The init section can execute combos, call functions, and modify variables just like main — it simply runs once at startup rather than looping.

> You can have multiple `init` sections, the compiler will merge them together at runtime.

## main {required}

The `main` section is the heart of any GPC script. It is the only required section and runs in a continuous loop. Code executes sequentially from top to bottom — order directly affects outcomes.

```gpc
main {
    if (get_val(PS5_R2) > 50) {
        combo_run(RapidFire);
    }
}
```

Each cycle:

1. Code executes top-to-bottom
2. The console generates an output report
3. Remaps are applied
4. The report is sent to the console
5. The cycle restarts

> You can have multiple `main` sections, the compiler will merge them together at runtime.

## combo {optional}

`combo` blocks define timed action sequences. They are ideal for setting button outputs for specific durations.

```gpc
combo RapidFire {
    set_val(PS5_R2, 100);
    wait(40);
    set_val(PS5_R2, 0);
    wait(40);
}
```

Key points:

- Started with `combo_run(ComboName)`
- Can be stopped with `combo_stop(ComboName)`
- Run in parallel with main
- `wait(ms)` pauses the combo for the specified duration (10–4000ms)
- `call(ComboName)` pauses the current combo to run another, then resumes
- Combos can execute any code valid in main, but their primary strength is timed sequences
- Multiple combos can run simultaneously

### Combo Control Functions

| Function                     | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `combo_run(name)`            | Start a combo (no effect if already running)  |
| `combo_stop(name)`           | Stop a running combo                          |
| `combo_restart(name)`        | Restart from beginning (or start if inactive) |
| `combo_running(name)`        | Returns TRUE if combo is running              |
| `combo_suspended(name)`      | Returns TRUE if combo is suspended            |
| `combo_suspend(name)`        | Pause a combo                                 |
| `combo_resume(name)`         | Resume a suspended combo                      |
| `combo_stop_all()`           | Stop all running combos                       |
| `combo_suspend_all()`        | Suspend all running combos                    |
| `combo_resume_all()`         | Resume all suspended combos                   |
| `combo_current_step(name)`   | Get the current step number                   |
| `combo_step_time_left(name)` | Time remaining in current wait                |
| `wait(ms)`                   | Pause combo for duration (combo-only)         |
| `call(name)`                 | Run another combo, then resume (combo-only)   |

## function {optional}

User-defined functions for reusable logic. Functions must be declared last in the script, after main and combo sections.

```gpc
function clampValue(val, minVal, maxVal) {
    if (val < minVal) return minVal;
    if (val > maxVal) return maxVal;
    return val;
}
```

Key rules:

- Callable from `init`, `main`, `combo`, and other functions
- Parameters act as local variables (cannot be accessed outside the function)
- `return` sends a value back to the caller (returns 0 if omitted)
- GPC does **not** support recursive function calls
- No type specification needed for parameters (all values are integers)
