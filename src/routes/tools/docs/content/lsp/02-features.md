# LSP Features

The GPC language server provides a comprehensive set of code intelligence features.

## Autocompletion

As you type, the server suggests completions for:

- **Variables**: Global and local variables in scope
- **Functions**: User-defined and built-in functions
- **Constants**: Named constants and preprocessor defines
- **Controller buttons**: Platform-specific button constants (PS5_R2, XB1_RT, etc.)
- **Keywords**: Language keywords (if, while, combo, function, etc.)
- **Snippets**: Code templates for common patterns

Trigger autocompletion with `Ctrl+Space` or by typing.

## Hover Information

Hover over any symbol to see:

- **Variables**: Type information and declaration location
- **Functions**: Full signature with parameter names and documentation
- **Built-in functions**: Detailed description of what the function does, parameters, and return values
- **Constants**: Value and description
- **Controller buttons**: Which physical button it refers to

## Go to Definition

Navigate to where a symbol is defined:

- `Ctrl+Click` on a symbol to jump to its definition
- `F12` to go to definition of the symbol under the cursor
- Works across files — follows `imported` references
- For built-in symbols, shows the documentation

## Find References

Find all usages of a symbol across your project:

- `Shift+F12` to find all references
- Shows results from all files in the project
- Imports references in imported files

## Document Symbols

Get an outline of the current file:

- Shows all functions, combos, variables, and constants
- Use `Ctrl+Shift+O` to open the symbol outline
- Click a symbol to jump to it

## Signature Help

When calling a function, see its parameter information:

- Automatically appears when you type `(`
- Shows parameter names and types
- Highlights the current parameter as you type
- Works for both user-defined and built-in functions

## Semantic Highlighting

The LSP provides enhanced syntax highlighting beyond basic keyword coloring:

- **Variables** are colored differently from functions
- **Parameters** are distinguished from local variables
- **Constants** have their own color
- **Built-in functions** are highlighted differently from user functions
- **Symbols from imports** are visually distinct

## Code Folding

Collapse code sections for easier navigation:

- Fold function bodies, combo blocks, and control structures
- Click the fold icon in the gutter, or use `Ctrl+Shift+[` / `Ctrl+Shift+]`
- Line-based folding for all block structures

## Document Formatting

Format your code for consistent style:

- `Shift+Alt+F` to format the entire document
- Applies consistent indentation and spacing
