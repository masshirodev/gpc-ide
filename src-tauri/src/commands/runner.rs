use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncBufReadExt;

pub struct RunnerState {
    pub pid: Arc<AtomicU32>,
}

impl Default for RunnerState {
    fn default() -> Self {
        Self {
            pid: Arc::new(AtomicU32::new(0)),
        }
    }
}

fn kill_pid(pid: u32) {
    if pid == 0 {
        return;
    }
    #[cfg(unix)]
    {
        let _ = std::process::Command::new("kill")
            .arg(pid.to_string())
            .status();
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F", "/T"])
            .status();
    }
}

#[tauri::command]
pub async fn run_command(
    app: AppHandle,
    state: State<'_, RunnerState>,
    cwd: String,
    command: String,
) -> Result<(), String> {
    // Kill any existing running command
    let old_pid = state.pid.swap(0, Ordering::SeqCst);
    if old_pid > 0 {
        kill_pid(old_pid);
    }

    let (shell, args): (&str, Vec<&str>) = if cfg!(target_os = "windows") {
        ("cmd", vec!["/C", &command])
    } else {
        ("sh", vec!["-c", &command])
    };

    let mut child = tokio::process::Command::new(shell)
        .args(&args)
        .current_dir(&cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let pid = child.id().unwrap_or(0);
    state.pid.store(pid, Ordering::SeqCst);

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout in background
    if let Some(stdout) = stdout {
        let app_c = app.clone();
        tokio::spawn(async move {
            let mut reader = tokio::io::BufReader::new(stdout);
            let mut line = String::new();
            while reader.read_line(&mut line).await.unwrap_or(0) > 0 {
                let _ = app_c.emit("runner:stdout", &line);
                line.clear();
            }
        });
    }

    // Stream stderr in background
    if let Some(stderr) = stderr {
        let app_c = app.clone();
        tokio::spawn(async move {
            let mut reader = tokio::io::BufReader::new(stderr);
            let mut line = String::new();
            while reader.read_line(&mut line).await.unwrap_or(0) > 0 {
                let _ = app_c.emit("runner:stderr", &line);
                line.clear();
            }
        });
    }

    // Wait for process exit in background
    let pid_arc = Arc::clone(&state.pid);
    tokio::spawn(async move {
        let status = child.wait().await;
        let exit_code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);

        // Clear PID only if it's still ours
        pid_arc
            .compare_exchange(pid, 0, Ordering::SeqCst, Ordering::SeqCst)
            .ok();

        let _ = app.emit("runner:exit", exit_code);
    });

    Ok(())
}

#[tauri::command]
pub async fn kill_command(state: State<'_, RunnerState>) -> Result<(), String> {
    let pid = state.pid.swap(0, Ordering::SeqCst);
    if pid > 0 {
        kill_pid(pid);
    }
    Ok(())
}
