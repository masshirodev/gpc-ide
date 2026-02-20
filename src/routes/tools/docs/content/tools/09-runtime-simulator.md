# Runtime Simulator {ide}

The Runtime Simulator steps through GPC combo code and visualizes button/axis output over time. Access it from **Tools > Simulator** in the sidebar.

## Overview

When designing combos, it's useful to see exactly what controller outputs are produced and when. The Runtime Simulator parses a `combo` block, breaks it into discrete steps, and lets you step through or play back the execution — showing which buttons are pressed and their values at each point in the timeline.

## Interface

### Code Editor (Left)

A Monaco editor pre-loaded with a sample combo. Paste or write any GPC combo block here:

```gpc
combo RapidFire {
    set_val(PS5_R2, 100);
    wait(40);
    set_val(PS5_R2, 0);
    wait(40);
}
```

The simulator understands `set_val()` and `wait()` statements.

### Controls

- **Simulate**: Parse the code and generate the step timeline
- **Play / Stop**: Automatically advance through steps with timing
- **Step Forward / Back**: Move one step at a time
- **Speed**: Playback speed multiplier (0.25x to 4x)
- **Loops**: Number of times to repeat the combo (1–10)

### Timeline (Right)

After simulating, the timeline shows:

- Each step with its line number, action, and timestamp
- The current step is highlighted
- Active button/axis values are displayed for each step
- Wait durations are shown between actions

### Output Display

A visual representation of active controller outputs:

- Buttons with non-zero values are highlighted
- Shows the exact value being sent (0–100 for buttons, -100 to 100 for axes)
- Updates in real-time during playback

## Supported Statements

| Statement | Description |
|-----------|-------------|
| `set_val(BUTTON, value)` | Set a button/axis to a specific value |
| `wait(ms)` | Pause execution for the specified milliseconds |

The simulator recognizes all standard GPC button and axis constants (PS5, XB1, and generic BUTTON/STICK names).

## Tips

- Use the simulator to verify combo timing before flashing to device
- Adjust the loop count to see how repeating combos behave over multiple cycles
- Slow down playback speed to observe rapid sequences in detail
