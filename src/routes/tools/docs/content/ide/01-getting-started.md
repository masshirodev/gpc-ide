# Getting Started {ide}

GPC IDE is a desktop application for creating, editing, and building Cronus Zen game scripts. It provides a complete workflow from game creation through to compiled `.gpc` output files.

## First Launch

When you first open GPC IDE, you'll see the **Dashboard** — a home screen with your games listed in the sidebar and an empty editor area. Before you can start working, you'll want to set up at least one workspace.

## Workspaces

A workspace is a directory on your computer where GPC IDE stores your game projects. Each game is a subfolder within a workspace.

To add a workspace:

1. Click **Settings** in the bottom-left corner of the sidebar
2. Under **Workspaces**, click **Add Workspace**
3. Select a directory on your system

You can add multiple workspaces. Games from all workspaces appear together in the sidebar, grouped by game type.

## Interface Overview

The IDE has several main areas:

- **Sidebar** (left): Lists your games grouped by type, plus links to all tools
- **Editor area** (center): Tab-based code editor with file tree
- **Bottom panel**: Shows build output, problems, and logs
- **Status bar** (bottom): Displays LSP status and other info

## Quick Start

1. Add a workspace in Settings
2. Click **New Game** to open the game creation wizard
3. Configure your game (name, type, modules)
4. Edit your game files in the editor
5. Build your game to generate the final `.gpc` file

## Keyboard Shortcuts

| Shortcut       | Action                |
| -------------- | --------------------- |
| `Ctrl+S`       | Save current file     |
| `Ctrl+W`       | Close current tab     |
| `Ctrl+B`       | Build current game    |
| `Ctrl+Shift+B` | Build & copy output   |
| `Escape`       | Close modals / cancel |
