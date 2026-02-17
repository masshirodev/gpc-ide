use crate::models::config::GameConfig;
use crate::pipeline::config_gen::resolve_config_template;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Result of a build operation
#[derive(Debug, Clone, serde::Serialize)]
pub struct BuildResult {
    pub output_path: String,
    pub success: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Build log entry emitted during preprocessing
#[derive(Debug, Clone, serde::Serialize)]
pub struct BuildLogEntry {
    pub level: String, // "info", "warn", "error"
    pub message: String,
}

/// Preprocess a GPC file by recursively expanding #include directives.
///
/// Returns (processed_content, log_entries, success).
pub fn preprocess(
    file_path: &Path,
    verbose: bool,
) -> (String, Vec<BuildLogEntry>, bool) {
    let mut processed_files: HashSet<PathBuf> = HashSet::new();
    let mut logs = Vec::new();
    let mut success = true;

    let content = preprocess_recursive(
        file_path,
        &mut processed_files,
        &mut Vec::new(),
        &mut logs,
        &mut success,
        verbose,
    );

    (content, logs, success)
}

fn preprocess_recursive(
    file_path: &Path,
    processed_files: &mut HashSet<PathBuf>,
    include_stack: &mut Vec<PathBuf>,
    logs: &mut Vec<BuildLogEntry>,
    success: &mut bool,
    verbose: bool,
) -> String {
    let abs_path = match file_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            // File doesn't exist - try the raw absolute path for error reporting
            let abs = if file_path.is_absolute() {
                file_path.to_path_buf()
            } else {
                std::env::current_dir()
                    .unwrap_or_default()
                    .join(file_path)
            };
            logs.push(BuildLogEntry {
                level: "error".to_string(),
                message: format!("File not found: {}", abs.display()),
            });
            *success = false;
            return format!("// Error: Missing file {}\n", file_path.display());
        }
    };

    // Skip already processed files (prevents double-inclusion)
    if processed_files.contains(&abs_path) || include_stack.contains(&abs_path) {
        if verbose {
            logs.push(BuildLogEntry {
                level: "info".to_string(),
                message: format!("Skipping (already included): {}", file_path.display()),
            });
        }
        return String::new();
    }

    if verbose {
        let indent = "  ".repeat(include_stack.len());
        logs.push(BuildLogEntry {
            level: "info".to_string(),
            message: format!("{}Processing: {}", indent, file_path.display()),
        });
    }

    processed_files.insert(abs_path.clone());
    include_stack.push(abs_path.clone());

    let content = match std::fs::read_to_string(&abs_path) {
        Ok(c) => c,
        Err(e) => {
            logs.push(BuildLogEntry {
                level: "error".to_string(),
                message: format!("Could not read {}: {}", abs_path.display(), e),
            });
            *success = false;
            include_stack.pop();
            return format!("// Error: Could not read {}\n", file_path.display());
        }
    };

    let base_dir = abs_path.parent().unwrap_or(Path::new("."));
    let mut output = String::with_capacity(content.len() * 2);

    for (line_num, line) in content.lines().enumerate() {
        let line_num = line_num + 1; // 1-indexed

        // Skip commented lines - don't process their #include directives
        let trimmed = line.trim_start();
        if trimmed.starts_with("//") {
            output.push_str(line);
            output.push('\n');
            continue;
        }

        // Check for #include "filename"
        if let Some(include_path) = parse_include(trimmed) {
            let full_include_path = normalize_path(&base_dir.join(include_path));

            let included_content = preprocess_recursive(
                &full_include_path,
                processed_files,
                include_stack,
                logs,
                success,
                verbose,
            );

            if !*success {
                logs.push(BuildLogEntry {
                    level: "error".to_string(),
                    message: format!("  Referenced from: {}:{}", abs_path.display(), line_num),
                });
            }

            output.push_str(&included_content);
        } else {
            output.push_str(line);
            output.push('\n');
        }
    }

    include_stack.pop();
    output
}

/// Parse a #include directive and return the included filename.
fn parse_include(line: &str) -> Option<&str> {
    let trimmed = line.trim();
    if !trimmed.starts_with("#include") {
        return None;
    }
    let rest = trimmed["#include".len()..].trim();
    if rest.starts_with('"') && rest.ends_with('"') && rest.len() > 2 {
        Some(&rest[1..rest.len() - 1])
    } else {
        None
    }
}

/// Normalize a path (resolve ../ and ./ components) without requiring the file to exist.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                components.pop();
            }
            std::path::Component::CurDir => {}
            _ => {
                components.push(component);
            }
        }
    }
    components.iter().collect()
}

/// Build a game: preprocess main.gpc and write the output to dist/.
///
/// - `game_dir`: path to the game directory (e.g., Games/Shooter/R6S)
/// - `project_root`: path to the project root (for resolving bundled resources)
/// - `dist_base`: base directory for dist/ output (typically workspace path)
/// - `verbose`: enable verbose logging
pub fn build_game(
    game_dir: &Path,
    _project_root: &Path,
    dist_base: &Path,
    verbose: bool,
) -> BuildResult {
    let config_path = game_dir.join("config.toml");
    let main_path = game_dir.join("main.gpc");

    // Read config for filename and version
    let config_content = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) => {
            return BuildResult {
                output_path: String::new(),
                success: false,
                errors: vec![format!("Could not read config.toml: {}", e)],
                warnings: Vec::new(),
            };
        }
    };

    let config: GameConfig = match toml::from_str(&config_content) {
        Ok(c) => c,
        Err(e) => {
            return BuildResult {
                output_path: String::new(),
                success: false,
                errors: vec![format!("Could not parse config.toml: {}", e)],
                warnings: Vec::new(),
            };
        }
    };

    let resolved_filename = resolve_config_template(&config.filename, &config);
    let output_filename = format!("{}.gpc", resolved_filename);
    let dist_dir = dist_base.join("dist");

    // Ensure dist directory exists
    if let Err(e) = std::fs::create_dir_all(&dist_dir) {
        return BuildResult {
            output_path: String::new(),
            success: false,
            errors: vec![format!("Could not create dist directory: {}", e)],
            warnings: Vec::new(),
        };
    }

    let output_path = dist_dir.join(&output_filename);

    // Check main.gpc exists
    if !main_path.exists() {
        return BuildResult {
            output_path: output_path.to_string_lossy().to_string(),
            success: false,
            errors: vec![format!(
                "main.gpc not found at {}",
                main_path.display()
            )],
            warnings: Vec::new(),
        };
    }

    // Run preprocessor
    let (processed, logs, preprocess_success) = preprocess(&main_path, verbose);

    let mut errors: Vec<String> = logs
        .iter()
        .filter(|l| l.level == "error")
        .map(|l| l.message.clone())
        .collect();
    let warnings: Vec<String> = logs
        .iter()
        .filter(|l| l.level == "warn")
        .map(|l| l.message.clone())
        .collect();

    // Write output
    let header = format!(
        "// GENERATED FILE - DO NOT EDIT\n// Source: {}\n\n",
        main_path.display()
    );
    let final_content = format!("{}{}", header, processed);

    if let Err(e) = std::fs::write(&output_path, &final_content) {
        errors.push(format!("Could not write output file: {}", e));
        return BuildResult {
            output_path: output_path.to_string_lossy().to_string(),
            success: false,
            errors,
            warnings,
        };
    }

    BuildResult {
        output_path: output_path.to_string_lossy().to_string(),
        success: preprocess_success && errors.is_empty(),
        errors,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_parse_include() {
        assert_eq!(parse_include("#include \"foo.gpc\""), Some("foo.gpc"));
        assert_eq!(parse_include("  #include \"bar.gpc\""), Some("bar.gpc"));
        assert_eq!(parse_include("#include \"../Common/helper.gpc\""), Some("../Common/helper.gpc"));
        assert_eq!(parse_include("// #include \"foo.gpc\""), None);
        assert_eq!(parse_include("int x = 5;"), None);
        assert_eq!(parse_include("#include"), None);
    }

    #[test]
    fn test_normalize_path() {
        let p = normalize_path(Path::new("/a/b/../c/./d"));
        assert_eq!(p, PathBuf::from("/a/c/d"));
    }

    #[test]
    fn test_preprocess_simple() {
        let dir = tempfile::tempdir().unwrap();
        let main_path = dir.path().join("main.gpc");
        let helper_path = dir.path().join("helper.gpc");

        std::fs::write(&helper_path, "int helper_var;\n").unwrap();
        std::fs::write(&main_path, "#include \"helper.gpc\"\nint main_var;\n").unwrap();

        let (content, _logs, success) = preprocess(&main_path, false);
        assert!(success);
        assert!(content.contains("int helper_var;"));
        assert!(content.contains("int main_var;"));
    }

    #[test]
    fn test_preprocess_no_double_include() {
        let dir = tempfile::tempdir().unwrap();
        let main_path = dir.path().join("main.gpc");
        let shared_path = dir.path().join("shared.gpc");

        std::fs::write(&shared_path, "int shared;\n").unwrap();
        std::fs::write(
            &main_path,
            "#include \"shared.gpc\"\n#include \"shared.gpc\"\nint main;\n",
        )
        .unwrap();

        let (content, _logs, success) = preprocess(&main_path, false);
        assert!(success);
        // "int shared;" should appear only once
        assert_eq!(content.matches("int shared;").count(), 1);
    }

    #[test]
    fn test_preprocess_commented_include_skipped() {
        let dir = tempfile::tempdir().unwrap();
        let main_path = dir.path().join("main.gpc");

        // commented include should NOT be expanded (file doesn't even exist)
        std::fs::write(&main_path, "// #include \"nonexistent.gpc\"\nint x;\n").unwrap();

        let (content, _logs, success) = preprocess(&main_path, false);
        assert!(success);
        assert!(content.contains("// #include \"nonexistent.gpc\""));
        assert!(content.contains("int x;"));
    }

    #[test]
    fn test_preprocess_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let main_path = dir.path().join("main.gpc");

        std::fs::write(&main_path, "#include \"missing.gpc\"\nint x;\n").unwrap();

        let (_content, _logs, success) = preprocess(&main_path, false);
        assert!(!success);
    }

    #[test]
    fn test_build_real_game() {
        let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        let r6s_dir = project_root.join("Games/Shooter/R6S");

        if !r6s_dir.exists() {
            eprintln!("Skipping real game build test - R6S not found");
            return;
        }

        let result = build_game(&r6s_dir, &project_root, &project_root, false);
        eprintln!("Build result: success={}, output={}", result.success, result.output_path);
        for e in &result.errors {
            eprintln!("  Error: {}", e);
        }

        assert!(result.success, "Build failed: {:?}", result.errors);
        assert!(result.output_path.contains("Mash-R6S-v2.gpc"));

        // Verify output file exists and contains expected content
        let output_content = std::fs::read_to_string(&result.output_path).unwrap();
        assert!(output_content.contains("GENERATED FILE"));
        assert!(output_content.contains("function _CoreMainMenu()"));
        assert!(output_content.contains("function _CoreSave()"));
    }
}
