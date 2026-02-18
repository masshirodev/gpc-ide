# LSP Overview

GPC IDE includes a Language Server Protocol (LSP) integration that provides real-time code intelligence for the GPC language.

## What is the LSP?

The Language Server Protocol is a standard that allows editors to communicate with a language server for features like autocompletion, error checking, and navigation. GPC IDE bridges the LSP server with the Monaco editor to bring IDE-level features to GPC scripting.

## How It Works

1. When GPC IDE starts, it launches the GPC language server as a background process
2. The editor communicates with the server via the LSP protocol
3. As you type, the server analyzes your code and provides real-time feedback
4. The server understands `import` directives and analyzes your entire project

## Connection Status

The status bar at the bottom of the IDE shows the LSP connection status:

- **Connected**: The language server is running and responsive
- **Disconnected**: The server is not running — code intelligence features are unavailable
- **Connecting**: The server is starting up

## Custom LSP Server

By default, GPC IDE uses the bundled language server. If you have a custom build or a different version:

1. Go to **Settings**
2. Under **LSP**, enter the command to run your custom server in **Custom LSP Command**
3. The IDE will use your custom server on the next restart

Leave the field blank to use the default bundled server.

## Include Resolution

The LSP server resolves `import` directives to provide cross-file intelligence:

- Symbols defined in imported files are available for autocompletion
- Hover info works across file boundaries
- Go-to-definition navigates to the original source file
- Errors in imported files are reported in the including file
