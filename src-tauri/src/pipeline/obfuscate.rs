use std::collections::{HashMap, HashSet};

// ============================================================
// Public API
// ============================================================

#[derive(Debug, Clone, serde::Serialize)]
pub struct ObfuscateStats {
    pub identifiers_renamed: usize,
    pub comments_removed: usize,
    pub strings_encoded: usize,
    pub dead_code_blocks: usize,
    pub lines_before: usize,
    pub lines_after: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ObfuscateResult {
    pub output: String,
    pub stats: ObfuscateStats,
}

/// Obfuscate GPC source code with the given level (1-5).
///
/// Each level includes all previous levels:
/// 1. Strip comments & minify whitespace
/// 2. Rename user-defined identifiers
/// 3. Encode string constants
/// 4. Inject dead code
/// 5. Control flow obfuscation
pub fn obfuscate(source: &str, level: u8) -> ObfuscateResult {
    let level = level.clamp(1, 5);
    let lines_before = source.lines().count();

    let mut tokens = tokenize(source);
    let mut stats = ObfuscateStats {
        identifiers_renamed: 0,
        comments_removed: 0,
        strings_encoded: 0,
        dead_code_blocks: 0,
        lines_before,
        lines_after: 0,
    };

    // Level 1: Strip comments & minify
    if level >= 1 {
        stats.comments_removed = tokens.iter().filter(|t| matches!(t.kind, TokenKind::LineComment | TokenKind::BlockComment)).count();
        strip_and_minify(&mut tokens);
    }

    // Level 2: Identifier renaming
    if level >= 2 {
        stats.identifiers_renamed = rename_identifiers(&mut tokens);
    }

    // Level 3: String encoding
    if level >= 3 {
        stats.strings_encoded = encode_strings(&mut tokens);
    }

    // Reconstruct source from tokens
    let mut output = tokens_to_string(&tokens);

    // Level 4: Dead code injection (operates on text)
    if level >= 4 {
        let (injected, count) = inject_dead_code(&output);
        output = injected;
        stats.dead_code_blocks = count;
    }

    // Level 5: Control flow obfuscation (operates on text)
    if level >= 5 {
        output = obfuscate_control_flow(&output);
    }

    stats.lines_after = output.lines().count();

    ObfuscateResult { output, stats }
}

// ============================================================
// GPC Lexer
// ============================================================

#[derive(Debug, Clone, PartialEq)]
enum TokenKind {
    LineComment,
    BlockComment,
    StringLiteral,
    CharLiteral,
    Identifier,
    Number,
    Preprocessor,
    Operator,
    Punctuation,
    Whitespace,
    Newline,
}

#[derive(Debug, Clone)]
struct Token {
    kind: TokenKind,
    text: String,
}

fn tokenize(source: &str) -> Vec<Token> {
    let bytes = source.as_bytes();
    let len = bytes.len();
    let mut tokens = Vec::new();
    let mut i = 0;

    while i < len {
        let b = bytes[i];

        // Line comment
        if b == b'/' && i + 1 < len && bytes[i + 1] == b'/' {
            let start = i;
            while i < len && bytes[i] != b'\n' {
                i += 1;
            }
            tokens.push(Token {
                kind: TokenKind::LineComment,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // Block comment
        if b == b'/' && i + 1 < len && bytes[i + 1] == b'*' {
            let start = i;
            i += 2;
            while i + 1 < len && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            if i + 1 < len {
                i += 2; // skip */
            }
            tokens.push(Token {
                kind: TokenKind::BlockComment,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // String literal
        if b == b'"' {
            let start = i;
            i += 1;
            while i < len && bytes[i] != b'"' {
                if bytes[i] == b'\\' && i + 1 < len {
                    i += 1; // skip escaped char
                }
                i += 1;
            }
            if i < len {
                i += 1; // skip closing "
            }
            tokens.push(Token {
                kind: TokenKind::StringLiteral,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // Char literal
        if b == b'\'' {
            let start = i;
            i += 1;
            while i < len && bytes[i] != b'\'' {
                if bytes[i] == b'\\' && i + 1 < len {
                    i += 1;
                }
                i += 1;
            }
            if i < len {
                i += 1;
            }
            tokens.push(Token {
                kind: TokenKind::CharLiteral,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // Preprocessor directive (# at start of line or after whitespace)
        if b == b'#' {
            let line_start = if i == 0 {
                true
            } else {
                let before = &source[source[..i].rfind('\n').map(|p| p + 1).unwrap_or(0)..i];
                before.trim().is_empty()
            };
            if line_start {
                let start = i;
                while i < len && bytes[i] != b'\n' {
                    i += 1;
                }
                tokens.push(Token {
                    kind: TokenKind::Preprocessor,
                    text: source[start..i].to_string(),
                });
                continue;
            }
        }

        // Newline
        if b == b'\n' {
            tokens.push(Token {
                kind: TokenKind::Newline,
                text: "\n".to_string(),
            });
            i += 1;
            continue;
        }

        // Whitespace
        if b.is_ascii_whitespace() {
            let start = i;
            while i < len && bytes[i].is_ascii_whitespace() && bytes[i] != b'\n' {
                i += 1;
            }
            tokens.push(Token {
                kind: TokenKind::Whitespace,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // Number (decimal or hex)
        if b.is_ascii_digit() || (b == b'0' && i + 1 < len && (bytes[i + 1] == b'x' || bytes[i + 1] == b'X')) {
            let start = i;
            if b == b'0' && i + 1 < len && (bytes[i + 1] == b'x' || bytes[i + 1] == b'X') {
                i += 2;
                while i < len && bytes[i].is_ascii_hexdigit() {
                    i += 1;
                }
            } else {
                while i < len && bytes[i].is_ascii_digit() {
                    i += 1;
                }
            }
            tokens.push(Token {
                kind: TokenKind::Number,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // Identifier
        if b.is_ascii_alphabetic() || b == b'_' {
            let start = i;
            while i < len && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
                i += 1;
            }
            tokens.push(Token {
                kind: TokenKind::Identifier,
                text: source[start..i].to_string(),
            });
            continue;
        }

        // Multi-char operators
        if i + 1 < len {
            let two = &source[i..i + 2];
            if matches!(two, "+=" | "-=" | "*=" | "/=" | "%=" | "==" | "!=" | "<=" | ">=" | "&&" | "||" | "<<" | ">>" | "++" | "--") {
                tokens.push(Token {
                    kind: TokenKind::Operator,
                    text: two.to_string(),
                });
                i += 2;
                continue;
            }
        }

        // Single-char operators and punctuation
        if matches!(b, b'+' | b'-' | b'*' | b'/' | b'%' | b'&' | b'|' | b'^' | b'~' | b'!' | b'<' | b'>' | b'=') {
            tokens.push(Token {
                kind: TokenKind::Operator,
                text: (b as char).to_string(),
            });
            i += 1;
            continue;
        }

        // Punctuation (braces, parens, brackets, semicolons, commas, dots)
        tokens.push(Token {
            kind: TokenKind::Punctuation,
            text: (b as char).to_string(),
        });
        i += 1;
    }

    tokens
}

fn tokens_to_string(tokens: &[Token]) -> String {
    let mut out = String::with_capacity(tokens.iter().map(|t| t.text.len()).sum());
    for t in tokens {
        out.push_str(&t.text);
    }
    out
}

// ============================================================
// Reserved names
// ============================================================

fn reserved_names() -> HashSet<&'static str> {
    let mut set = HashSet::new();

    // Keywords
    for kw in &[
        "if", "while", "else", "switch", "case", "default", "for", "do",
        "return", "break", "continue", "function", "combo", "init", "main",
        "enum", "define", "const", "local", "use", "import", "not",
    ] {
        set.insert(*kw);
    }

    // Type keywords
    for tk in &[
        "int", "int8", "int16", "int32", "uint8", "uint16", "uint32",
        "string", "data", "image", "ps5adt",
    ] {
        set.insert(*tk);
    }

    // Built-in functions
    for bf in &[
        "duint8", "duint16", "dint32", "dint8", "dint16",
        "get_val", "get_lval", "get_ptime", "get_controller", "get_battery",
        "event_press", "event_release", "get_ival", "get_brtime",
        "swap", "block", "sensitivity", "deadzone", "stickize",
        "ps4_touchpad", "ps4_set_touchpad", "turn_off", "wii_offscreen",
        "get_adt", "set_adt", "adt_off", "adt_cmp", "adt_setx", "addr",
        "get_rumble", "set_rumble", "block_rumble", "reset_rumble",
        "set_led", "get_led", "set_ledx", "get_ledx", "reset_leds",
        "get_ps4_lbar", "set_ps4_lbar",
        "get_keyboard", "get_modifiers", "get_rtime", "get_slot", "load_slot",
        "get_ctrlbutton", "vm_tctrl", "set_polar", "set_rgb", "set_hsb",
        "clamp", "get_polar", "get_ipolar", "remap", "unmap",
        "combo_run", "combo_running", "combo_stop", "combo_restart",
        "combo_suspend", "combo_suspended", "combo_current_step",
        "combo_step_time_left", "combo_stop_all", "combo_suspend_all",
        "combo_resume", "combo_resume_all",
        "wait", "call", "set_bit", "clear_bit", "test_bit", "set_bits", "get_bits",
        "abs", "inv", "pow", "isqrt", "random", "min", "max",
        "pixel_oled", "line_oled", "rect_oled", "circle_oled",
        "putc_oled", "puts_oled", "print", "cls_oled",
        "get_console", "set_val", "block_all_inputs", "get_info",
        "set_polar2", "sizeof", "get_pvar", "set_pvar", "image_oled",
    ] {
        set.insert(*bf);
    }

    // Booleans
    set.insert("TRUE");
    set.insert("FALSE");
    set.insert("NULL");

    set
}

/// Check if an identifier matches a known constant pattern (PS5_*, OLED_*, etc.)
fn is_constant_pattern(name: &str) -> bool {
    let prefixes = [
        "PS5_", "PS4_", "PS3_", "XB1_", "XB360_", "SWI_",
        "KEY_", "MOD_", "OLED_", "SPVAR_", "PVAR_", "ASCII_",
        "POLAR_", "ANALOG_", "TRACE_", "RUMBLE_", "LED_",
        "PLAYER_", "BITMASK_",
    ];
    prefixes.iter().any(|p| name.starts_with(p))
}

fn is_reserved(name: &str, reserved: &HashSet<&str>) -> bool {
    reserved.contains(name) || is_constant_pattern(name)
}

// ============================================================
// Level 1: Strip comments & minify
// ============================================================

fn strip_and_minify(tokens: &mut Vec<Token>) {
    // Remove comments
    tokens.retain(|t| !matches!(t.kind, TokenKind::LineComment | TokenKind::BlockComment));

    // Collapse consecutive whitespace/newline sequences
    let mut result: Vec<Token> = Vec::with_capacity(tokens.len());
    for token in tokens.drain(..) {
        match token.kind {
            TokenKind::Whitespace => {
                // Replace any whitespace with a single space
                match result.last() {
                    Some(last) if matches!(last.kind, TokenKind::Whitespace | TokenKind::Newline) => {
                        // Skip - already have whitespace
                    }
                    _ => {
                        result.push(Token {
                            kind: TokenKind::Whitespace,
                            text: " ".to_string(),
                        });
                    }
                }
            }
            TokenKind::Newline => {
                // Collapse multiple newlines into one
                match result.last() {
                    Some(last) if last.kind == TokenKind::Newline => {
                        // Skip duplicate newline
                    }
                    Some(last) if last.kind == TokenKind::Whitespace => {
                        // Replace trailing whitespace with newline
                        let len = result.len();
                        result[len - 1] = Token {
                            kind: TokenKind::Newline,
                            text: "\n".to_string(),
                        };
                    }
                    _ => {
                        result.push(Token {
                            kind: TokenKind::Newline,
                            text: "\n".to_string(),
                        });
                    }
                }
            }
            _ => {
                result.push(token);
            }
        }
    }

    // Remove leading/trailing whitespace
    while result.first().map_or(false, |t| matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline)) {
        result.remove(0);
    }
    while result.last().map_or(false, |t| matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline)) {
        result.pop();
    }

    *tokens = result;
}

// ============================================================
// Level 2: Identifier renaming
// ============================================================

/// Context for tracking what kind of declaration an identifier is in.
#[derive(Debug, Clone, Copy, PartialEq)]
enum DeclContext {
    Function,
    Combo,
    Variable,
}

fn rename_identifiers(tokens: &mut Vec<Token>) -> usize {
    let reserved = reserved_names();

    // First pass: collect user-defined identifiers and their declaration context
    let mut user_idents: HashMap<String, DeclContext> = HashMap::new();
    let mut i = 0;
    while i < tokens.len() {
        if tokens[i].kind == TokenKind::Identifier {
            let name = &tokens[i].text;

            // Check declaration context by looking at preceding keyword
            if !is_reserved(name, &reserved) && !user_idents.contains_key(name.as_str()) {
                let ctx = find_decl_context(tokens, i);
                user_idents.insert(name.clone(), ctx);
            }
        }
        i += 1;
    }

    if user_idents.is_empty() {
        return 0;
    }

    // Build rename map
    let mut rename_map: HashMap<String, String> = HashMap::new();
    let mut var_counter = 0usize;
    let mut func_counter = 0usize;
    let mut combo_counter = 0usize;

    // Sort for deterministic output
    let mut sorted_idents: Vec<_> = user_idents.into_iter().collect();
    sorted_idents.sort_by(|a, b| a.0.cmp(&b.0));

    for (name, ctx) in &sorted_idents {
        let new_name = match ctx {
            DeclContext::Function => {
                let n = format!("_f{}", func_counter);
                func_counter += 1;
                n
            }
            DeclContext::Combo => {
                let n = format!("_c{}", combo_counter);
                combo_counter += 1;
                n
            }
            DeclContext::Variable => {
                let n = format!("_v{}", var_counter);
                var_counter += 1;
                n
            }
        };
        rename_map.insert(name.clone(), new_name);
    }

    let count = rename_map.len();

    // Second pass: apply renames
    for token in tokens.iter_mut() {
        if token.kind == TokenKind::Identifier {
            if let Some(new_name) = rename_map.get(&token.text) {
                token.text = new_name.clone();
            }
        }
    }

    count
}

/// Look backwards from position `pos` to find the declaration keyword context.
fn find_decl_context(tokens: &[Token], pos: usize) -> DeclContext {
    // Walk backwards skipping whitespace/newlines to find the nearest keyword
    let mut j = pos;
    while j > 0 {
        j -= 1;
        match tokens[j].kind {
            TokenKind::Whitespace | TokenKind::Newline => continue,
            TokenKind::Identifier => {
                match tokens[j].text.as_str() {
                    "function" => return DeclContext::Function,
                    "combo" => return DeclContext::Combo,
                    // Type keywords indicate variable declaration
                    "int" | "int8" | "int16" | "int32" | "uint8" | "uint16" | "uint32"
                    | "string" | "data" | "const" | "local" => return DeclContext::Variable,
                    _ => return DeclContext::Variable,
                }
            }
            // If we hit a comma, this might be a variable list: int a, b, c
            TokenKind::Punctuation if tokens[j].text == "," => {
                // Keep scanning backwards for the type keyword
                continue;
            }
            _ => return DeclContext::Variable,
        }
    }
    DeclContext::Variable
}

// ============================================================
// Level 3: String encoding
// ============================================================

fn encode_strings(tokens: &mut Vec<Token>) -> usize {
    // We look for patterns like: const string NAME[] = {"text"};
    // And replace them with: const int NAME[] = {t, e, x, t};
    // This operates on the token stream by finding string literals inside array initializers.

    let mut count = 0;

    // Find string literal tokens that are inside array initializers (after = {)
    // and preceded by `const string ... [] =`
    let mut i = 0;
    while i < tokens.len() {
        if tokens[i].kind == TokenKind::StringLiteral && tokens[i].text.len() > 4 {
            // Check if this looks like it's in an array initializer context
            if is_in_string_array_init(tokens, i) {
                // Extract the string content (without quotes)
                let content = &tokens[i].text[1..tokens[i].text.len() - 1];
                if content.len() >= 3 {
                    // Convert to char code array
                    let codes: Vec<String> = content
                        .chars()
                        .map(|c| (c as u32).to_string())
                        .collect();
                    tokens[i].text = codes.join(", ");
                    tokens[i].kind = TokenKind::Number; // Treat as numeric data now

                    // Also need to change the `string` type to `int` in the declaration
                    change_string_type_to_int(tokens, i);
                    count += 1;
                }
            }
        }
        i += 1;
    }

    count
}

fn is_in_string_array_init(tokens: &[Token], pos: usize) -> bool {
    // Walk backwards looking for { = [] identifier string const pattern
    let mut j = pos;
    let mut found_brace = false;

    while j > 0 {
        j -= 1;
        match tokens[j].kind {
            TokenKind::Whitespace | TokenKind::Newline => continue,
            TokenKind::Punctuation if tokens[j].text == "{" => {
                found_brace = true;
                continue;
            }
            TokenKind::Operator if tokens[j].text == "=" && found_brace => {
                return true;
            }
            _ => {
                if found_brace {
                    return false;
                }
                // Not a simple pattern
                return false;
            }
        }
    }
    false
}

fn change_string_type_to_int(tokens: &mut [Token], string_pos: usize) {
    // Walk backwards from string_pos to find the `string` type keyword
    let mut j = string_pos;
    while j > 0 {
        j -= 1;
        if tokens[j].kind == TokenKind::Identifier && tokens[j].text == "string" {
            tokens[j].text = "int".to_string();
            return;
        }
        // Don't look too far back
        if tokens[j].kind == TokenKind::Newline {
            return;
        }
    }
}

// ============================================================
// Level 4: Dead code injection
// ============================================================

fn inject_dead_code(source: &str) -> (String, usize) {
    let mut output = String::with_capacity(source.len() * 2);
    let mut count = 0usize;
    let mut dead_var_counter = 0usize;
    let mut dead_func_counter = 0usize;

    // Simple approach: after every top-level declaration block (function/combo closing brace),
    // insert a dummy function or variable declaration.
    // We track brace depth to find top-level closing braces.

    let lines: Vec<&str> = source.lines().collect();
    let mut brace_depth = 0i32;
    let mut line_idx = 0;

    // Insert a few dummy global variables at the start
    output.push_str(&format!("int _d{} = 0;\n", dead_var_counter));
    dead_var_counter += 1;
    output.push_str(&format!("int _d{} = 1;\n", dead_var_counter));
    dead_var_counter += 1;
    count += 2;

    while line_idx < lines.len() {
        let line = lines[line_idx];
        let trimmed = line.trim();

        // Track brace depth
        for ch in trimmed.chars() {
            match ch {
                '{' => brace_depth += 1,
                '}' => brace_depth -= 1,
                _ => {}
            }
        }

        output.push_str(line);
        output.push('\n');

        // After a top-level closing brace, potentially inject dead code
        if brace_depth == 0 && trimmed.ends_with('}') && dead_func_counter < 8 {
            // Inject a dummy function every 3rd top-level block
            if dead_func_counter % 3 == 0 {
                output.push_str(&format!(
                    "function _df{}() {{\n    int _dt = {};\n    if (FALSE) {{ set_val(0, _dt); }}\n}}\n",
                    dead_func_counter,
                    dead_func_counter * 17 + 3
                ));
                count += 1;
            }
            dead_func_counter += 1;

            // Inject a dummy variable
            if dead_var_counter < 12 {
                output.push_str(&format!(
                    "int _d{} = {};\n",
                    dead_var_counter,
                    dead_var_counter * 31 + 7
                ));
                dead_var_counter += 1;
                count += 1;
            }
        }

        // Inside function/combo bodies, inject dead branches
        if brace_depth > 0 && trimmed.ends_with(';') && !trimmed.starts_with("//") && count < 30 {
            // Every ~5 statements, inject a dead branch
            if line_idx % 5 == 0 {
                let indent = &line[..line.len() - trimmed.len()];
                output.push_str(&format!(
                    "{}if (FALSE) {{ int _dd = {}; }}\n",
                    indent,
                    line_idx * 13 + 1
                ));
                count += 1;
            }
        }

        line_idx += 1;
    }

    (output, count)
}

// ============================================================
// Level 5: Control flow obfuscation
// ============================================================

fn obfuscate_control_flow(source: &str) -> String {
    let mut output = String::with_capacity(source.len() * 2);

    for line in source.lines() {
        let trimmed = line.trim();

        // Obfuscate if-conditions: wrap with opaque predicate
        if trimmed.starts_with("if (") || trimmed.starts_with("if(") {
            let indent = &line[..line.len() - trimmed.len()];
            // Find the condition inside the if (...)
            if let Some((cond, rest)) = extract_if_condition(trimmed) {
                // Wrap condition: if (cond) → if (((cond)) && (TRUE || (0 == 1)))
                output.push_str(&format!(
                    "{}if ((({})) && (TRUE || (0 == 1))) {}\n",
                    indent, cond, rest
                ));
                continue;
            }
        }

        // Obfuscate simple assignments: x = val; → x = ((val) + 0);
        if trimmed.contains(" = ") && trimmed.ends_with(';') && !trimmed.starts_with("if")
            && !trimmed.starts_with("for") && !trimmed.starts_with("//")
            && !trimmed.contains("==") && !trimmed.contains("!=")
            && !trimmed.contains("<=") && !trimmed.contains(">=")
        {
            if let Some(eq_pos) = trimmed.find(" = ") {
                let lhs = &trimmed[..eq_pos];
                let rhs = &trimmed[eq_pos + 3..trimmed.len() - 1]; // strip trailing ;

                // Only obfuscate simple numeric-looking RHS or short expressions
                let rhs_trimmed = rhs.trim();
                if rhs_trimmed.len() < 40 && !rhs_trimmed.contains('{') && !rhs_trimmed.contains('"') {
                    let indent = &line[..line.len() - trimmed.len()];
                    output.push_str(&format!(
                        "{}{} = (({})) + 0;\n",
                        indent, lhs, rhs_trimmed
                    ));
                    continue;
                }
            }
        }

        // Obfuscate while loops: while (cond) → while (((cond)) && TRUE)
        if trimmed.starts_with("while (") || trimmed.starts_with("while(") {
            let indent = &line[..line.len() - trimmed.len()];
            if let Some((cond, rest)) = extract_while_condition(trimmed) {
                output.push_str(&format!(
                    "{}while ((({})) && TRUE) {}\n",
                    indent, cond, rest
                ));
                continue;
            }
        }

        output.push_str(line);
        output.push('\n');
    }

    // Remove trailing newline if source didn't have one
    if !source.ends_with('\n') && output.ends_with('\n') {
        output.pop();
    }

    output
}

/// Extract condition and remaining text from an if statement.
/// e.g., "if (x > 5) {" → Some(("x > 5", "{"))
fn extract_if_condition(line: &str) -> Option<(&str, &str)> {
    let start = line.find('(')?;
    let mut depth = 0;
    let bytes = line.as_bytes();
    for i in start..bytes.len() {
        match bytes[i] {
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    let cond = &line[start + 1..i];
                    let rest = line[i + 1..].trim();
                    return Some((cond, rest));
                }
            }
            _ => {}
        }
    }
    None
}

/// Extract condition from a while statement.
fn extract_while_condition(line: &str) -> Option<(&str, &str)> {
    extract_if_condition(line) // Same parsing logic
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_basic() {
        let tokens = tokenize("int x = 5;");
        // int, " ", x, " ", =, " ", 5, ;
        assert_eq!(tokens.len(), 8);
        assert_eq!(tokens[0].text, "int");
        assert_eq!(tokens[0].kind, TokenKind::Identifier);
    }

    #[test]
    fn test_tokenize_comments() {
        let tokens = tokenize("int x; // comment\nint y;");
        let comments: Vec<_> = tokens.iter().filter(|t| t.kind == TokenKind::LineComment).collect();
        assert_eq!(comments.len(), 1);
        assert!(comments[0].text.contains("comment"));
    }

    #[test]
    fn test_tokenize_block_comment() {
        let tokens = tokenize("int x; /* block\ncomment */ int y;");
        let comments: Vec<_> = tokens.iter().filter(|t| t.kind == TokenKind::BlockComment).collect();
        assert_eq!(comments.len(), 1);
    }

    #[test]
    fn test_tokenize_string() {
        let tokens = tokenize("const string s[] = {\"hello world\"};");
        let strings: Vec<_> = tokens.iter().filter(|t| t.kind == TokenKind::StringLiteral).collect();
        assert_eq!(strings.len(), 1);
        assert_eq!(strings[0].text, "\"hello world\"");
    }

    #[test]
    fn test_tokenize_hex_number() {
        let tokens = tokenize("int x = 0xFF;");
        let nums: Vec<_> = tokens.iter().filter(|t| t.kind == TokenKind::Number).collect();
        assert_eq!(nums.len(), 1);
        assert_eq!(nums[0].text, "0xFF");
    }

    #[test]
    fn test_level1_strip_comments() {
        let result = obfuscate("int x = 5; // my variable\n/* block */\nint y = 10;", 1);
        assert!(!result.output.contains("//"));
        assert!(!result.output.contains("/*"));
        assert!(result.output.contains("int x = 5;"));
        assert!(result.output.contains("int y = 10;"));
        assert_eq!(result.stats.comments_removed, 2);
    }

    #[test]
    fn test_level1_minify_whitespace() {
        let result = obfuscate("int    x   =   5;\n\n\nint y = 10;", 1);
        // Multiple spaces should be collapsed
        assert!(!result.output.contains("   "));
        // Multiple newlines should be collapsed
        assert!(!result.output.contains("\n\n"));
    }

    #[test]
    fn test_level2_rename_identifiers() {
        let result = obfuscate("function myFunc() {\n    int myVar = 5;\n    set_val(0, myVar);\n}\n", 2);
        // Built-in set_val should NOT be renamed
        assert!(result.output.contains("set_val"));
        // User identifiers should be renamed
        assert!(!result.output.contains("myFunc"));
        assert!(!result.output.contains("myVar"));
        // Should contain renamed identifiers
        assert!(result.output.contains("_f"));
        assert!(result.output.contains("_v"));
        assert!(result.stats.identifiers_renamed > 0);
    }

    #[test]
    fn test_level2_preserves_builtins() {
        let result = obfuscate("function test() {\n    set_val(PS5_RY, clamp(get_val(PS5_RY) + 5, -100, 100));\n}\n", 2);
        assert!(result.output.contains("set_val"));
        assert!(result.output.contains("PS5_RY"));
        assert!(result.output.contains("clamp"));
        assert!(result.output.contains("get_val"));
    }

    #[test]
    fn test_level2_preserves_keywords() {
        let result = obfuscate("function test() {\n    if (TRUE) {\n        return;\n    }\n}\n", 2);
        assert!(result.output.contains("if"));
        assert!(result.output.contains("TRUE"));
        assert!(result.output.contains("return"));
    }

    #[test]
    fn test_level3_string_encoding() {
        let result = obfuscate("const string label[] = {\"Hello\"};\n", 3);
        // Should not contain the original string
        assert!(!result.output.contains("\"Hello\""));
        // Should contain char codes (H=72, e=101, l=108, l=108, o=111)
        assert!(result.output.contains("72"));
        assert!(result.output.contains("101"));
        assert!(result.stats.strings_encoded > 0);
    }

    #[test]
    fn test_level4_dead_code() {
        let result = obfuscate("function test() {\n    int x = 5;\n}\n", 4);
        // Should contain dead code markers
        assert!(result.output.contains("_d"));
        assert!(result.output.contains("FALSE"));
        assert!(result.stats.dead_code_blocks > 0);
    }

    #[test]
    fn test_level5_control_flow() {
        let result = obfuscate("function test() {\n    if (x > 5) {\n        set_val(0, 100);\n    }\n}\n", 5);
        // Should contain opaque predicates
        assert!(result.output.contains("TRUE"));
    }

    #[test]
    fn test_obfuscate_preserves_functionality() {
        // A minimal GPC program
        let source = r#"int MyStatus = 0;

function MyPress(button) {
    set_val(button, 100);
}

combo MyCombo {
    set_val(PS5_R2, 100);
    wait(50);
    set_val(PS5_R2, 0);
}

main {
    if (event_press(PS5_R1)) {
        combo_run(MyCombo);
    }
}
"#;
        let result = obfuscate(source, 2);
        // Structure should be preserved
        assert!(result.output.contains("function"));
        assert!(result.output.contains("combo"));
        assert!(result.output.contains("main"));
        assert!(result.output.contains("set_val"));
        assert!(result.output.contains("wait"));
        assert!(result.output.contains("event_press"));
        assert!(result.output.contains("combo_run"));
        // User names should be gone
        assert!(!result.output.contains("MyStatus"));
        assert!(!result.output.contains("MyPress"));
        assert!(!result.output.contains("MyCombo"));
    }
}
