# Spray Pattern Tool

The Spray Pattern tool lets you visually design recoil compensation patterns by drawing directly on a canvas. Access it from **Tools > Spray Pattern** in the sidebar.

## Overview

Instead of manually entering recoil values, you can draw the weapon's spray pattern on a canvas. The tool then computes the per-phase vertical and horizontal compensation values needed to counteract that spray.

## How to Use

### Drawing a Pattern

1. Open the Spray Pattern tool
2. Click and drag on the canvas to draw the weapon's spray path
3. The path represents where bullets land — the tool calculates inverse values for compensation
4. Each point on the path corresponds to a bullet/phase in the recoil timeline

### Phases

The spray pattern is divided into **phases** — discrete time segments during which specific recoil values are applied:

- Each phase has a **vertical** and **horizontal** compensation value
- Phases are computed automatically from your drawn pattern
- You can manually adjust individual phase values in the Phase Panel
- The number of phases corresponds to the number of sampled points

### Configuration

Use the Config Panel to adjust:

- **Sensitivity**: How strongly the tool maps canvas movement to recoil values
- **Sample rate**: How many phases to generate from the drawn path
- **Smoothing**: Apply smoothing to the generated values

### Exporting

The Output Panel shows the computed recoil values as an array. You can:

- **Copy values** to clipboard
- **Return to editor** — sends the values directly back to the Recoil Table Editor

## Integration with Editor

The Spray Pattern tool integrates with the Recoil Table Editor:

1. In the editor, open a game with per-weapon recoil (antirecoil_timeline module)
2. Click the spray tool icon next to a weapon in the recoil table
3. Draw the spray pattern
4. Click "Return" — the values are transferred back to the table automatically
