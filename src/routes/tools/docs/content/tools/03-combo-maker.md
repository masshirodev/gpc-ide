# Combo Maker

The Combo Maker is a visual sequencer for creating button combo sequences. Access it from **Tools > Combo Maker** in the sidebar.

## Overview

Fighting games and action games often require precise button sequences. The Combo Maker provides a timeline-based interface for designing these combos without writing code manually.

## Interface

### Timeline

The main view shows your combo as a horizontal timeline:

- Each column represents a **step** in the combo
- Each row represents a controller button
- Click cells to toggle button presses at each step
- Drag the timeline to scroll through long combos

### Step Editor

Select a step to edit its properties:

- **Duration**: How long this step lasts (in milliseconds)
- **Buttons**: Which buttons are pressed during this step
- **Wait**: Optional delay before the next step

### Stick Inputs

For combos that require analog stick movement:

- Visual stick input editor with directional controls
- Set exact X/Y values for precise stick positioning
- Support for both left and right analog sticks

### Export Panel

Export your combo in several formats:

- **GPC Combo Block**: Ready-to-use `combo { }` code
- **Copy to clipboard**: Quick copy for pasting into your code

## Creating a Combo

1. Click **Add Step** to add steps to the timeline
2. For each step, click the buttons that should be pressed
3. Set the duration for each step
4. Add wait times between steps if needed
5. Use the stick input editor for directional inputs
6. Export the combo when finished

## Features

- **Undo/Redo**: Full history support for all changes
- **Step reordering**: Drag steps to rearrange the sequence
- **Duration editing**: Click duration labels to edit timing
- **Preview**: See the complete button sequence at a glance
