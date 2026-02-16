use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
pub struct SearchMatch {
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct SearchFileResult {
    pub path: String,
    pub matches: Vec<SearchMatch>,
}

const SEARCHABLE_EXTENSIONS: &[&str] = &["gpc", "gph", "toml", "cfg", "txt", "h", "c"];

fn is_searchable(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SEARCHABLE_EXTENSIONS.contains(&ext))
        .unwrap_or(false)
}

fn walk_files(dir: &Path, files: &mut Vec<String>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            walk_files(&path, files);
        } else if is_searchable(&path) {
            if let Some(p) = path.to_str() {
                files.push(p.to_string());
            }
        }
    }
}

fn find_matches_literal(content: &str, query: &str, case_sensitive: bool) -> Vec<SearchMatch> {
    let mut matches = Vec::new();
    let query_lower = if case_sensitive {
        String::new()
    } else {
        query.to_lowercase()
    };

    for (line_idx, line) in content.lines().enumerate() {
        let search_line = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        let search_query = if case_sensitive { query } else { &query_lower };

        let mut start = 0;
        while let Some(pos) = search_line[start..].find(search_query) {
            let abs_pos = start + pos;
            matches.push(SearchMatch {
                line_number: line_idx + 1,
                line_content: line.to_string(),
                match_start: abs_pos,
                match_end: abs_pos + query.len(),
            });
            start = abs_pos + 1;
        }
    }
    matches
}

fn find_matches_regex(
    content: &str,
    pattern: &regex::Regex,
) -> Vec<SearchMatch> {
    let mut matches = Vec::new();
    for (line_idx, line) in content.lines().enumerate() {
        for mat in pattern.find_iter(line) {
            matches.push(SearchMatch {
                line_number: line_idx + 1,
                line_content: line.to_string(),
                match_start: mat.start(),
                match_end: mat.end(),
            });
        }
    }
    matches
}

#[tauri::command]
pub fn search_in_files(
    directory: String,
    query: String,
    case_sensitive: bool,
    use_regex: bool,
) -> Result<Vec<SearchFileResult>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let dir = Path::new(&directory);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", directory));
    }

    let mut files = Vec::new();
    walk_files(dir, &mut files);
    files.sort();

    let regex_pattern = if use_regex {
        let pattern = if case_sensitive {
            regex::Regex::new(&query)
        } else {
            regex::RegexBuilder::new(&query)
                .case_insensitive(true)
                .build()
        };
        Some(pattern.map_err(|e| format!("Invalid regex: {}", e))?)
    } else {
        None
    };

    let mut results = Vec::new();
    for file_path in &files {
        let content = match fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let matches = if let Some(ref re) = regex_pattern {
            find_matches_regex(&content, re)
        } else {
            find_matches_literal(&content, &query, case_sensitive)
        };

        if !matches.is_empty() {
            results.push(SearchFileResult {
                path: file_path.clone(),
                matches,
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn replace_in_file(
    path: String,
    query: String,
    replacement: String,
    case_sensitive: bool,
    use_regex: bool,
) -> Result<u32, String> {
    if query.is_empty() {
        return Ok(0);
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    let (new_content, count) = if use_regex {
        let re = if case_sensitive {
            regex::Regex::new(&query)
        } else {
            regex::RegexBuilder::new(&query)
                .case_insensitive(true)
                .build()
        }
        .map_err(|e| format!("Invalid regex: {}", e))?;

        let count = re.find_iter(&content).count() as u32;
        let new_content = re.replace_all(&content, replacement.as_str()).to_string();
        (new_content, count)
    } else {
        if case_sensitive {
            let count = content.matches(&query).count() as u32;
            let new_content = content.replace(&query, &replacement);
            (new_content, count)
        } else {
            // Case-insensitive literal replace
            let query_lower = query.to_lowercase();
            let mut result = String::with_capacity(content.len());
            let mut count = 0u32;
            let content_lower = content.to_lowercase();
            let mut last_end = 0;

            while let Some(pos) = content_lower[last_end..].find(&query_lower) {
                let abs_pos = last_end + pos;
                result.push_str(&content[last_end..abs_pos]);
                result.push_str(&replacement);
                last_end = abs_pos + query.len();
                count += 1;
            }
            result.push_str(&content[last_end..]);
            (result, count)
        }
    };

    if count > 0 {
        fs::write(&path, &new_content).map_err(|e| format!("Failed to write file: {}", e))?;
    }

    Ok(count)
}
