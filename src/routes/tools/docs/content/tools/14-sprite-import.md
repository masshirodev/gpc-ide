# Sprite Import {ide}

The Sprite Import tool lets you import sprite sheets from images, extract individual frames, edit them, and save sprite collections for use in OLED displays. Access it from **Tools > Sprite Import** in the sidebar.

## Overview

Sprites are small pixel art graphics used on the Cronus Zen OLED display — icons, animations, status indicators, etc. This tool takes a sprite sheet image, slices it into individual frames based on a grid, and provides a pixel editor for fine-tuning.

## Interface

### Import

- Click the file input to load a sprite sheet image (PNG, JPG, etc.)
- The image is displayed with a grid overlay showing the cell boundaries

### Grid Settings

- **Cell Width / Height**: Set the pixel dimensions of each sprite frame
- **Threshold**: Brightness threshold (0-255) for converting color pixels to black/white OLED format

The tool automatically calculates columns, rows, and total frame count from the image dimensions and cell size.

### Grid Preview

- The loaded image is shown with grid lines at cell boundaries
- Each cell represents one sprite frame
- Statistics show: columns, rows, and total frame count

### Frame Extraction

- Click **Extract Frames** to slice the sprite sheet into individual frames
- Each frame is converted to 1-bit (black/white) pixel data using the threshold setting

### Sprite Editor

After extraction, click **Edit Sprites** to open the built-in sprite editor:

- **Frame list** with thumbnail previews
- **Pixel editor** — click to toggle individual pixels
- **Drawing tools** for editing sprite frames
- Navigate between frames to edit each one

### Saving

- **Collection Name**: Name for the sprite collection
- **Workspace**: Select which workspace to save to
- **Save** — saves the collection to `<workspace>/sprites/<name>/`

## Workflow

1. Load a sprite sheet image
2. Set cell width and height to match your sprite grid
3. Adjust the threshold for black/white conversion
4. Click **Extract Frames** to generate individual sprites
5. Optionally **Edit Sprites** to fine-tune frames in the pixel editor
6. Set a collection name and workspace, then **Save**

## Features

- **Automatic grid detection** from image dimensions and cell size
- **Threshold-based conversion** from color images to 1-bit OLED format
- **Built-in pixel editor** for per-frame touch-ups
- **Collection management** — save and organize sprite sets by workspace
- **Integration** with the Flow Editor's pixel-art sub-node widget
