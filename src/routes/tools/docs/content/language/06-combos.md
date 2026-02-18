# Combos

Combos are the core action mechanism in GPC. A combo is a sequence of pre-programmed instructions executed in order, ideal for setting button outputs for specific durations.

## Basic Combo

```gpc
combo RapidFire {
    set_val(PS5_R2, 100);   // Press R2
    wait(40);                // Hold for 40ms
    set_val(PS5_R2, 0);     // Release R2
    wait(40);                // Wait 40ms
}
```

## How Combos Execute

1. Start a combo with `combo_run(ComboName)` from `main` or another section
2. The combo executes its statements in order
3. `wait(ms)` instructs the VM how long the previous set of commands should be applied (10–4000ms)
4. When the combo reaches the end, it loops back to the beginning
5. Stop a combo with `combo_stop(ComboName)`

Combos can execute any code valid in main (function calls, variable assignments), but their primary strength is automating timed button sequences.

## Starting and Stopping

```gpc
main {
    // Run combo while R2 is held
    if (get_val(PS5_R2)) {
        combo_run(RapidFire);
    } else {
        combo_stop(RapidFire);
    }
}
```

`combo_run()` only starts the combo if it's not already running. Use `combo_restart()` to force it back to the beginning.

## Nesting Combos with call()

Combos can invoke other combos using `call()`. The current combo pauses, the called combo runs to completion, then the original resumes:

```gpc
combo MainSequence {
    set_val(PS5_CROSS, 100);
    wait(50);
    call(SubCombo);          // Pause, run SubCombo, then resume
    set_val(PS5_CIRCLE, 100);
    wait(50);
}

combo SubCombo {
    set_val(PS5_SQUARE, 100);
    wait(100);
    set_val(PS5_SQUARE, 0);
    wait(50);
}
```

## One-Shot Combos

To run a combo once without looping, check `combo_running` before starting:

```gpc
main {
    if (event_press(PS5_CROSS) && !combo_running(JumpShot)) {
        combo_run(JumpShot);
    }
}

combo JumpShot {
    set_val(PS5_CROSS, 100);
    wait(50);
    set_val(PS5_R2, 100);
    wait(100);
    set_val(PS5_R2, 0);
    set_val(PS5_CROSS, 0);
    wait(50);
}
```

## Using Variables in Combos

Combos can read and write global variables:

```gpc
int fireRate = 40;

combo RapidFire {
    set_val(PS5_R2, 100);
    wait(fireRate);
    set_val(PS5_R2, 0);
    wait(fireRate);
}
```

## Multiple Simultaneous Combos

You can run multiple combos at the same time:

```gpc
main {
    if (get_val(PS5_R2)) {
        combo_run(RapidFire);
        combo_run(AntiRecoil);
    }
}
```

## Combo with Calculations

Combos can include calculations and conditionals:

```gpc
combo AntiRecoil {
    if (Recoil_Vertical != 0) {
        set_val(PS5_RY, clamp(
            get_val(PS5_RY) + Recoil_Vertical,
            -100, 100
        ));
    }
}
```

## Combo Control Reference

| Function                     | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `combo_run(name)`            | Start a combo (no effect if already running)  |
| `combo_stop(name)`           | Stop a running combo                          |
| `combo_restart(name)`        | Restart from beginning (or start if inactive) |
| `combo_running(name)`        | Returns TRUE if combo is running              |
| `combo_suspended(name)`      | Returns TRUE if combo is suspended            |
| `combo_suspend(name)`        | Pause a running combo                         |
| `combo_resume(name)`         | Resume a suspended combo                      |
| `combo_stop_all()`           | Stop all running combos                       |
| `combo_suspend_all()`        | Suspend all running combos                    |
| `combo_resume_all()`         | Resume all suspended combos                   |
| `combo_current_step(name)`   | Get the current step number                   |
| `combo_step_time_left(name)` | Time remaining in current wait (ms)           |
| `wait(ms)`                   | Hold current outputs for duration (10–4000ms) |
| `call(name)`                 | Pause current combo, run another, then resume |

## Common Combo Patterns

### Rapid Fire

```gpc
combo RapidFire {
    set_val(PS5_R2, 100);
    wait(40);
    set_val(PS5_R2, 0);
    wait(40);
}
```

### Button Hold

```gpc
combo HoldBreath {
    set_val(PS5_L3, 100);
    wait(50);
    set_val(PS5_L3, 0);
}
```

### Multi-Button Sequence

```gpc
combo SlideCancel {
    set_val(PS5_CIRCLE, 100);  // Crouch/Slide
    wait(150);
    set_val(PS5_CIRCLE, 0);
    set_val(PS5_CROSS, 100);   // Jump
    wait(50);
    set_val(PS5_CROSS, 0);
    wait(100);
}
```

### Stick Movement

```gpc
combo Strafe {
    set_val(PS5_LX, 100);     // Move right
    wait(200);
    set_val(PS5_LX, -100);    // Move left
    wait(200);
}
```
