# Control Flow

GPC provides standard control flow statements similar to C.

## if / else

```gpc
if (condition) {
    // code
} else if (other_condition) {
    // code
} else {
    // code
}
```

Conditions evaluate to boolean values — `TRUE` (any non-zero value) or `FALSE` (0). Braces are optional for single statements, but recommended for clarity.

Comparison operators:

| Operator | Meaning               |
| -------- | --------------------- |
| `==`     | Equal to              |
| `!=`     | Not equal to          |
| `<`      | Less than             |
| `>`      | Greater than          |
| `<=`     | Less than or equal    |
| `>=`     | Greater than or equal |

Logical operators:

| Operator | Meaning |
| -------- | ------- |
| `&&`     | AND     |
| `\|\|`   | OR      |
| `!`      | NOT     |

## while

Executes a block of code as long as the condition is true:

```gpc
while (condition) {
    // code
    // Use break to exit early
}
```

## do...while

Executes the code block at least once, then continues while the condition is true:

```gpc
do {
    // code (runs at least once)
} while (condition);
```

## for

Runs a set number of times using an initializer, condition, and increment:

```gpc
for (a = 0; a < 10; a++) {
    // runs 10 times
}
```

## break

Exits the current loop early based on a condition:

```gpc
while (TRUE) {
    if (counter > 100) {
        break;  // Exit the loop
    }
    counter++;
}
```

> The official GPC documentation does not cover `switch/case` or `continue` statements, but the Cronus Zen compiler supports them.

## Operators

### Arithmetic

| Operator | Description        |
| -------- | ------------------ |
| `+`      | Addition           |
| `-`      | Subtraction        |
| `*`      | Multiplication     |
| `/`      | Integer division   |
| `%`      | Modulo (remainder) |
| `++`     | Increment          |
| `--`     | Decrement          |

> Be careful with multiplication and division — results exceeding the 16-bit range (-32,768 to 32,767) will overflow.

### Bitwise

| Operator | Description |
| -------- | ----------- |
| `&`      | Bitwise AND |
| `\|`     | Bitwise OR  |
| `^`      | Bitwise XOR |
| `~`      | Bitwise NOT |
| `<<`     | Left shift  |
| `>>`     | Right shift |

### Assignment

| Operator | Description         |
| -------- | ------------------- |
| `=`      | Assign              |
| `+=`     | Add and assign      |
| `-=`     | Subtract and assign |
| `*=`     | Multiply and assign |
| `/=`     | Divide and assign   |
| `%=`     | Modulo and assign   |
