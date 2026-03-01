# Font Import {ide}

The Font Import tool lets you import BDF bitmap fonts for use in OLED displays. Access it from **Tools > Font Import** in the sidebar.

## Overview

The Cronus Zen OLED display supports custom fonts for text rendering. This tool imports BDF (Bitmap Distribution Format) font files, previews them on a simulated OLED display, generates GPC font code, and can send imported fonts directly to the OLED Creator.

## Interface

### Import

- Click **Import BDF Font** to select a `.bdf` file from your system
- The tool parses all glyphs and converts them to a bitmap font

### Font Settings

- **Font Name**: Customize the name used in generated GPC code (default: derived from the BDF file)

### Preview

- **Preview Text** input field — type any text to see it rendered
- **OLED Canvas** — a simulated 128x64 OLED display showing the rendered text
- Displays font metadata: glyph count, character dimensions

### GPC Output

- Read-only Monaco editor showing the generated GPC font code
- **Copy GPC** button to copy the code to clipboard

## Workflow

1. Click **Import BDF Font** and select a font file
2. Preview the font by typing text in the preview field
3. Adjust the font name if needed
4. Either:
   - **Copy GPC** to use the font code directly in your scripts
   - **Send to OLED Creator** to use the font in the OLED Creator tool

## Integration

The Font Import tool integrates with the OLED Creator via a transfer store. When you click "Send to OLED Creator", the imported font data is made available as a custom font in the OLED Creator's text rendering tools.
