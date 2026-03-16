use tauri::Manager;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Monitor {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

#[tauri::command]
fn get_monitors(app: tauri::AppHandle) -> Result<Vec<Monitor>, String> {
    match app.available_monitors() {
        Ok(monitors) => Ok(monitors
            .iter()
            .map(|m| Monitor {
                name: m.name().unwrap_or("Unknown").to_string(),
                width: m.size().width,
                height: m.size().height,
                x: m.position().x,
                y: m.position().y,
            })
            .collect()),
        Err(e) => Err(format!("Failed to get monitors: {}", e)),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Create the output window on startup so it's ready
            // (It can also be opened on demand via JS)
            let _ = app; // suppress unused warning
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_monitors])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
