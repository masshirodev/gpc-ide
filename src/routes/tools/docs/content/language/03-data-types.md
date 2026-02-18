# Data Types {language} {zen}

GPC uses integer-only arithmetic. There are no floating-point types — decimal values are truncated (e.g., 3.4 becomes 3).

## Variable Type

The core GPC variable type is a **16-bit signed integer** with a range of -32,768 to 32,767.

| Type     | Size            | Range                           |
| -------- | --------------- | ------------------------------- |
| `int`    | 16-bit signed   | -32,768 to 32,767               |
| `int8`   | 8-bit signed    | -128 to 127                     |
| `int16`  | 16-bit signed   | Same as `int`                   |
| `int32`  | 32-bit signed   | -2,147,483,648 to 2,147,483,647 |
| `uint8`  | 8-bit unsigned  | 0 to 255                        |
| `uint16` | 16-bit unsigned | 0 to 65,535                     |
| `uint32` | 32-bit unsigned | 0 to 4,294,967,295              |

> The extended types (`int8`, `int32`, `uint8`, etc.) are Cronus Zen extensions. Classic GPC only supports `int` (16-bit signed).

## Variable Declarations

Variables must be declared before `init` and `main` sections — they cannot be declared inside those sections or inside functions.

```gpc
int myVar;                          // Defaults to 0
int myVar = 10;                     // With initialization
int myArray[5];                     // Array of 5 elements (all 0)
const int myArray[2] = {1, 2, 3};   // Constant array
```

Variables are **global** — they can be accessed and modified from `init`, `main`, combo, and function sections.

**Naming rules:**

- Must start with an underscore (`_`) or letter
- Can contain letters, digits, and underscores
- Case-sensitive (`cronuszen` ≠ `CronusZen` ≠ `CRONUSZEN`)

## Constants

Constants are compile-time values that cannot be changed during runtime:

```gpc
define FIRE_RATE = 40;              // Preprocessor constant (text substitution)
const int myArray[2] = {1, 2, 3};   // Constant array
```

`define` creates a named constant via text substitution. It must appear at the top of the script before other sections.

## Data Section

The `data` section stores static, read-only byte values. All values are expressed as 8-bit unsigned integers (0–255).

```gpc
data(20, 42, 35, 255, 1, 100, 0, 86);
```

Access data values using these functions:

| Function        | Description                         |
| --------------- | ----------------------------------- |
| `dbyte(index)`  | Get 8-bit unsigned value at index   |
| `dchar(index)`  | Get 8-bit signed value at index     |
| `dword(index)`  | Get 16-bit signed value (two bytes) |
| `duint8(index)` | Alias for dbyte                     |
| `dint8(index)`  | Alias for dchar                     |
| `dint16(index)` | Alias for dword                     |

The same byte data returns different values depending on which function reads it — `dbyte` treats it as unsigned, `dchar` as signed, and `dword` combines two consecutive bytes into a 16-bit value.

## Special Types

### string

Strings are used primarily for OLED display output:

```gpc
string myString = "Hello";
```

### image

The `image` type stores OLED bitmap data:

```gpc
image myIcon = {/* pixel data */};
```

### ps5adt

Adaptive trigger data type for PS5 DualSense controller:

```gpc
ps5adt triggerData;
```

## Number Formats

```gpc
int decimal = 42;           // Decimal
int hex = 0x2A;             // Hexadecimal
```

## Boolean Values

GPC integrates boolean logic into integers — there is no separate boolean type:

- `TRUE` = 1
- `FALSE` = 0

Any non-zero value is considered true in conditions. This allows variables to serve as toggle switches.

## Arrays

Arrays are zero-indexed, fixed-size collections:

```gpc
int scores[5];              // 5-element array (indexes 0-4)
scores[0] = 100;            // Set first element
int val = scores[3];        // Read fourth element
```

Key points:

- Default to 0 if uninitialized
- Can only be assigned values starting from the `init` section (not at declaration time for non-const arrays)
- Global scope — accessible from any section
- Any global variable can be accessed via array notation based on its declaration order
