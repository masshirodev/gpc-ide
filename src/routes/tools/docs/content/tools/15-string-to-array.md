# String To Array {ide}

The String to Array tool converts text into GPC array declarations. Access it from **Tools > String to Array** in the sidebar.

## Overview

Enter a text string and get a formatted GPC array declaration with configurable byte or word format, null termination, and padding. Useful for embedding text data in scripts.

## Interface

### Input (Left)

- **Input String** textarea for entering text
- **Array Name** text field (default: `my_string`)
- **Type** dropdown: `int8` (byte array) or `int16` (word array)
- **Null-terminate** checkbox to append a `0x00` terminator
- **Show as decimal** checkbox to switch from hex to decimal output
- **Pad to length** number input (0-1024) to pad the array with zeros

### Statistics

- Character count
- UTF-8 byte count
- Total array elements (including null terminator and padding)

### Output (Right)

- **GPC Output** read-only Monaco editor with the generated array declaration
- **Copy** button
- **Byte View** hex dump with color-coded printable ASCII characters

## Output Format

For `int8`, the tool generates a byte array with 16 values per line:

```
const int8 my_string[] = {
    0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00,
};
define my_string_LEN = 6;
```

For `int16`, values are packed into 16-bit words in a single line.

## Features

- **UTF-8 encoding** support for all Unicode characters
- **Hex or decimal** display toggle
- **Null termination** and **padding** options
- **Length macro** automatically generated as a `define`
- **Hex dump** visualization with printable character highlighting
- **Real-time** statistics and output update
