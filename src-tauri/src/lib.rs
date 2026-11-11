mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    commands::run();
}
