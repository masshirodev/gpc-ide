use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct GitFileStatus {
    /// Relative path from the game directory
    pub path: String,
    /// Status code: "M" (modified), "A" (added), "D" (deleted), "?" (untracked), "R" (renamed)
    pub status: String,
}

/// Check if a directory is inside a git repository
#[tauri::command]
pub fn git_is_repo(game_path: String) -> bool {
    let output = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&game_path)
        .output();
    matches!(output, Ok(o) if o.status.success())
}

/// Get git status for files in a game directory
#[tauri::command]
pub fn git_status(game_path: String) -> Result<Vec<GitFileStatus>, String> {
    let game_dir = Path::new(&game_path);
    if !game_dir.is_dir() {
        return Err(format!("Not a directory: {}", game_path));
    }

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall", "."])
        .current_dir(game_dir)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        // Not a git repo or git error — return empty
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        let index_status = line.chars().nth(0).unwrap_or(' ');
        let work_status = line.chars().nth(1).unwrap_or(' ');
        let file_path = line[3..].trim();

        // Handle renames: "R  old -> new"
        let file_path = if file_path.contains(" -> ") {
            file_path.split(" -> ").last().unwrap_or(file_path)
        } else {
            file_path
        };

        // Build absolute path
        let abs_path = game_dir.join(file_path).to_string_lossy().to_string();

        // Determine the most relevant status character
        let status = if index_status == '?' || work_status == '?' {
            "?"
        } else if index_status == 'A' || work_status == 'A' {
            "A"
        } else if index_status == 'D' || work_status == 'D' {
            "D"
        } else if index_status == 'R' || work_status == 'R' {
            "R"
        } else if index_status == 'M' || work_status == 'M' {
            "M"
        } else {
            "M" // fallback
        };

        results.push(GitFileStatus {
            path: abs_path,
            status: status.to_string(),
        });
    }

    Ok(results)
}

/// Get the diff for a specific file
#[tauri::command]
pub fn git_diff_file(game_path: String, file_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["diff", "--", &file_path])
        .current_dir(&game_path)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Stage files for commit
#[tauri::command]
pub fn git_stage(game_path: String, file_paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["add".to_string(), "--".to_string()];
    args.extend(file_paths);

    let output = Command::new("git")
        .args(&args)
        .current_dir(&game_path)
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Unstage files (reset HEAD)
#[tauri::command]
pub fn git_unstage(game_path: String, file_paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["reset".to_string(), "HEAD".to_string(), "--".to_string()];
    args.extend(file_paths);

    let output = Command::new("git")
        .args(&args)
        .current_dir(&game_path)
        .output()
        .map_err(|e| format!("Failed to run git reset: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Commit staged changes
#[tauri::command]
pub fn git_commit(game_path: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&game_path)
        .output()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get detailed status distinguishing staged vs unstaged
#[derive(Debug, Clone, Serialize)]
pub struct GitDetailedStatus {
    pub path: String,
    pub index_status: String,
    pub worktree_status: String,
}

#[tauri::command]
pub fn git_status_detailed(game_path: String) -> Result<Vec<GitDetailedStatus>, String> {
    let game_dir = Path::new(&game_path);
    if !game_dir.is_dir() {
        return Err(format!("Not a directory: {}", game_path));
    }

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall", "."])
        .current_dir(game_dir)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        let idx = line.chars().nth(0).unwrap_or(' ');
        let wt = line.chars().nth(1).unwrap_or(' ');
        let file_path = line[3..].trim();

        let file_path = if file_path.contains(" -> ") {
            file_path.split(" -> ").last().unwrap_or(file_path)
        } else {
            file_path
        };

        let abs_path = game_dir.join(file_path).to_string_lossy().to_string();

        results.push(GitDetailedStatus {
            path: abs_path,
            index_status: if idx == ' ' { String::new() } else { idx.to_string() },
            worktree_status: if wt == ' ' { String::new() } else { wt.to_string() },
        });
    }

    Ok(results)
}
