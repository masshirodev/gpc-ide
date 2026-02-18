# Diagnostics

The GPC language server performs real-time error checking and reports problems as you type.

## How Diagnostics Work

The server analyzes your code on every change and reports:

- **Errors**: Code that will fail to compile (red squiggles)
- **Warnings**: Potential issues that may cause unexpected behavior (yellow squiggles)

Diagnostics appear as:

- Inline squiggly underlines in the editor
- Entries in the **Problems** tab of the bottom panel
- Hover over a squiggle to see the full error message

## Common Errors

### Undeclared Variables

```gpc
main {
    myVar = 10;  // Error: 'myVar' is not declared
}
```

Fix by declaring the variable:

```gpc
int myVar;
main {
    myVar = 10;  // OK
}
```

### Undeclared Functions

```gpc
main {
    myFunc();  // Error: 'myFunc' is not defined
}
```

### Type Mismatches

```gpc
int x = "hello";  // Error: cannot assign string to int
```

### Missing Imports

```gpc
import nonexistent.gpc  // Error: file not found
```

### Duplicate Declarations

```gpc
int myVar;
int myVar;  // Error: 'myVar' is already declared
```

## Cross-File Diagnostics

The language server understands `import` directives and can:

- Report errors in imported files
- Detect duplicate symbols across files
- Validate that imported files exist
- Track symbol dependencies across the project

## Diagnostic Tags

Some diagnostics import additional tags:

- **Unnecessary**: Code that has no effect (e.g., unused variables) — shown with faded text
- **Deprecated**: Features that should be avoided — shown with strikethrough

## Viewing Problems

The **Problems** panel at the bottom of the IDE lists all current diagnostics:

- Filter by severity (errors, warnings)
- Click a problem to jump to its location in the code
- Problems update in real-time as you edit

## Fixing Issues

When you see diagnostics:

1. Hover over the squiggle to read the error message
2. The message describes what's wrong and often suggests a fix
3. Make the correction in your code
4. The diagnostic disappears once the issue is resolved
