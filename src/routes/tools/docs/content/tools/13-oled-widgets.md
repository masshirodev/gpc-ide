# OLED Widget Library {ide}

The OLED Widget Library provides a collection of pre-built display widgets with live preview and GPC code generation. Access it from **Tools > OLED Widgets** in the sidebar.

## Overview

Select from a library of reusable widgets like bars, sliders, indicators, and diagnostics. Configure their parameters, preview them on a simulated 128x64 OLED display, and copy the generated GPC code into your project.

## Interface

### Widget List (Left)

- **Category tabs** to filter: All, Bars & Sliders, Indicators, Diagnostics
- Each widget shows its name and a short description
- Click a widget to select it

### Preview (Center)

- **128x64 OLED canvas** at 3x magnification with grid overlay
- **Value slider** (0-100) to test the widget at different values
- Widget auto-centers on the display

### Configuration (Right)

- **Parameter controls** that vary per widget: numbers with min/max, checkboxes, dropdowns
- **Widget info**: dimensions (e.g. "60 x 8 px"), category, ID

### GPC Output (Bottom)

- **Monaco editor** (read-only) showing the generated GPC code
- **Copy GPC Code** button (auto-centered placement)
- **Copy at (0,0)** button for manual positioning

## Available Widgets

### Bars & Sliders

- **Recessed Bar** - inset 3D-style progress bar
- **Gradient Fill Bar** - stippled checkerboard fill pattern
- **Chunky Retro Bar** - large block segments (retro style)
- **Notched Bar** - segmented notch-style indicator
- **Equalizer Bar** - multi-column frequency display

### Indicators

- **Cell Signal** - mobile signal strength bars
- **LED Strip** - row of LED-style indicators

### Diagnostics

- **Diagnostic Bar** - single-direction diagnostic display
- **Bi-Directional Diagnostic Bar** - center-origin diagnostic with positive/negative range

## Features

- **Live preview** updates instantly as you change parameters or the value slider
- **Pixel-perfect rendering** matching the Cronus Zen OLED layout
- **Configurable parameters** per widget (size, segments, orientation, etc.)
- **Two copy modes**: auto-centered or at origin for custom placement
- **Expandable code editor** with maximize button for larger view
