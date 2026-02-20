# Snippet Library {ide}

The Snippet Library is a personal collection of reusable GPC code fragments. Access it from **Tools > Snippets** in the sidebar.

## Overview

Store frequently used code patterns — utility functions, combo templates, menu helpers — and quickly retrieve them when building scripts. Snippets are saved in your settings and persist across sessions.

## Interface

### Snippet List (Left)

- **Search**: Filter snippets by name, description, or tags
- **Snippet count**: Shown in the header
- Each entry shows name, description, and tags

### Detail Panel (Right)

View, edit, or create snippets with a full Monaco code editor.

## Managing Snippets

### Creating

1. Click **+ New Snippet**
2. Fill in **Name** (required), **Description**, **Tags** (comma-separated), and **Code**
3. Click **Create Snippet**

### Editing

1. Select a snippet from the list
2. Click **Edit** in the toolbar
3. Modify the name, description, tags, or code
4. Click **Save** to apply changes

### Copying

Click **Copy** to copy the snippet's code to your clipboard for pasting into your project.

### Deleting

Click **Delete** to remove a snippet permanently.

## Import / Export

- **Import**: Load snippets from a JSON file — supports single or array format
- **Export**: Download all snippets as a `gpc-snippets.json` file for backup or sharing

### JSON Format

```json
[
  {
    "name": "Rapid Fire",
    "description": "Basic rapid fire combo",
    "code": "combo RapidFire { ... }",
    "tags": ["combo", "fps"]
  }
]
```
