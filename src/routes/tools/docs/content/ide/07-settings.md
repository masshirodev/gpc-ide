# Settings {ide}

Access settings by clicking the **Settings** button in the bottom-left of the sidebar.

## General

| Setting  | Default   | Description                                 |
| -------- | --------- | ------------------------------------------- |
| Username | _(empty)_ | Your name, embedded in generated game files |

## Editor

| Setting     | Default        | Description                                                |
| ----------- | -------------- | ---------------------------------------------------------- |
| Font Size   | 13             | Editor font size in pixels                                 |
| Tab Size    | 4              | Number of spaces per tab                                   |
| Font Family | JetBrains Mono | Monospace font stack (fallbacks: Fira Code, Cascadia Code) |
| Theme       | gpc-dark       | Editor color theme                                         |

## LSP

| Setting            | Default   | Description                                                                     |
| ------------------ | --------- | ------------------------------------------------------------------------------- |
| Custom LSP Command | _(empty)_ | Override the default LSP server command. Leave blank to use the bundled server. |

The LSP (Language Server Protocol) provides real-time code intelligence. If you have a custom build of the GPC language server, you can point the IDE to it here.

## Workspaces {required}

Workspaces are directories where your game projects are stored. You can have multiple workspaces.

- **Add Workspace**: Browse and select a directory
- **Remove Workspace**: Remove a workspace from the IDE (does not delete files)

Games from all workspaces appear in the sidebar, and builds output to each workspace's `dist/` folder.

## Game Types

GPC IDE has three built-in game types: `fps`, `tps`, and `fgs`.

You can create **custom game types** for organizing modules for specific genres or use cases:

- Custom types get their own module pool
- Modules can target `all` to be available in every game type
- Custom types appear in the game creation wizard and module manager

To add a custom type, enter the type name and click **Add**. Custom types can be removed at any time.
