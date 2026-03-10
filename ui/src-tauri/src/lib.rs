use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the sidecar child process so it can be killed on app exit.
struct SidecarState(Mutex<Option<CommandChild>>);

fn log_path() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| String::from("."));
    let dir = PathBuf::from(home).join(".solar-ai");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("sidecar.log")
}

fn write_log(path: &PathBuf, msg: &str) {
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{}", msg);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            let lp = log_path();
            // Truncate log on each fresh start so it doesn't grow forever.
            let _ = std::fs::write(&lp, "");
            write_log(&lp, "[sidecar] Starting solar-agent…");

            // Kill any stale solar-agent from a previous session that didn't exit cleanly.
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/IM", "solar-agent.exe", "/T"])
                .output();

            let sidecar_command = app.shell().sidecar("solar-agent").map_err(|e| {
                write_log(&lp, &format!("[sidecar] Failed to create command: {e}"));
                e
            })?;

            let (rx, child) = sidecar_command.spawn().map_err(|e| {
                write_log(&lp, &format!("[sidecar] Failed to spawn: {e}"));
                e
            })?;

            write_log(&lp, &format!("[sidecar] Spawned (pid: {})", child.pid()));

            // Stream stdout/stderr to the log file in a background task.
            let lp2 = lp.clone();
            tauri::async_runtime::spawn(async move {
                let mut rx = rx;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            write_log(&lp2, &format!("[stdout] {}", String::from_utf8_lossy(&line)));
                        }
                        CommandEvent::Stderr(line) => {
                            write_log(&lp2, &format!("[stderr] {}", String::from_utf8_lossy(&line)));
                        }
                        CommandEvent::Error(e) => {
                            write_log(&lp2, &format!("[error] {e}"));
                        }
                        CommandEvent::Terminated(status) => {
                            write_log(&lp2, &format!("[terminated] code={:?}", status.code));
                            break;
                        }
                        _ => {}
                    }
                }
            });

            // Store handle so we can kill it on exit.
            let state = app.state::<SidecarState>();
            *state.0.lock().unwrap() = Some(child);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<SidecarState>();
                let child = state.0.lock().unwrap().take();
                if let Some(child) = child {
                    let lp = log_path();
                    write_log(&lp, &format!("[sidecar] Stopping (pid: {})…", child.pid()));
                    if let Err(e) = child.kill() {
                        write_log(&lp, &format!("[sidecar] Failed to kill: {e}"));
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
