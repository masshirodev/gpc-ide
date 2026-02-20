# OLED Creator {ide}

The OLED Creator is a pixel art editor for designing custom graphics that display on the Cronus Zen's OLED screen. Access it from **Tools > OLED Creator** in the sidebar.

## Overview

The Cronus Zen has a small OLED display that can show custom graphics during gameplay. The OLED Creator lets you design these graphics pixel by pixel, with support for multiple scenes and animation.

## Interface

The tool has several panels:

### Canvas

The main drawing area where you create your pixel art:

- Click or drag to draw pixels
- The canvas dimensions match the Cronus Zen OLED resolution
- Zoom in/out for precision work

### Tool Panel

Select your drawing tool:

- **Pencil**: Draw individual pixels
- **Eraser**: Remove pixels
- **Line**: Draw straight lines
- **Rectangle**: Draw rectangles (outline or filled)
- **Fill**: Flood-fill an area

### Scene Panel

Manage multiple scenes (frames) for your design:

- **Add Scene**: Create a new blank scene
- **Duplicate Scene**: Copy the current scene
- **Delete Scene**: Remove a scene
- **Reorder**: Drag scenes to rearrange them

Each scene is an independent drawing that can be displayed at different times during gameplay.

### Preview Panel

See a real-time preview of your design at actual OLED size. If you have multiple scenes, the preview can cycle through them as an animation.

### Export Panel

Export your artwork:

- **Export as GPC**: Generate GPC code with OLED draw commands
- **Export as image**: Save as PNG for reference
- **Import**: Load an existing image to trace or convert

## Animation Presets

Open the **Animation Presets** modal to generate multi-frame animations from built-in generators:

- Select a preset (e.g. Starfield, Rain)
- Configure parameters (speed, density, etc.)
- Preview the generated frames with next/prev navigation
- Click **Insert Scenes** to add all frames to your project

## Custom Font Editor

The **Font Editor** lets you create custom vector fonts for OLED text rendering:

- Set font name, character width (3-16), and height (4-16)
- Select characters from preset buttons (A-Z, 0-9) or type custom characters
- Draw line segments on a pixel grid by clicking start and end points
- **Undo** removes the last segment, **Clear** deletes the entire glyph
- Live text preview on a simulated OLED display
- **Copy GPC** generates `line_oled()` calls for the rendered text

## Animation Sequencer

The **Sequencer Panel** arranges scenes into a timed animation sequence:

- Add scenes to a timeline from your project's scene list
- Set per-entry **duration** (50-10000 ms)
- Reorder entries with up/down arrows, or remove them
- **Play/Stop** to preview the animation with looping playback
- **Export GPC** copies the sequence as GPC code with timed OLED draw calls
- Displays total duration and current entry during playback

## Features

- **Undo/Redo**: Full history per scene — `Ctrl+Z` to undo, `Ctrl+Shift+Z` to redo
- **Multi-scene editing**: Each scene maintains its own undo/redo history
- **Grid overlay**: Toggle grid lines for precise pixel placement
- **Import images**: Load PNG/JPG images and convert them to OLED-compatible pixel art
- **Animation presets**: Generate multi-frame animations from built-in generators
- **Custom fonts**: Design vector fonts character by character
- **Sequencer**: Compose timed animation sequences from your scenes
