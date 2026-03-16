use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::PathBuf;
use tauri::Listener;
use zip::read::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyAuthResponse {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibreOfficeStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Monitor {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PptxSlide {
    pub slide_number: u32,
    pub name: String,
    pub image_path: String, // Extracted slide image on disk
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PptxFile {
    pub name: String,
    pub slides: Vec<PptxSlide>,
}

/// Clean up PPTX temp files from previous sessions
fn cleanup_pptx_temp_files() {
    let mut temp_dir = std::env::temp_dir();
    temp_dir.push("openstage");
    temp_dir.push("pptx");

    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

/// Get LibreOffice installation status
fn find_libreoffice() -> Option<PathBuf> {
    // Check common installation paths
    let paths = [
        // Windows
        PathBuf::from("C:\\Program Files\\LibreOffice\\program\\soffice.exe"),
        PathBuf::from("C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"),
        // macOS
        PathBuf::from("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
        // Linux
        PathBuf::from("/usr/bin/soffice"),
        PathBuf::from("/usr/bin/libreoffice"),
        PathBuf::from("/snap/bin/libreoffice"),
    ];

    for path in &paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // Try PATH on Linux/macOS
    if let Ok(output) = std::process::Command::new("which")
        .arg("soffice")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    None
}

#[tauri::command]
fn check_libreoffice_installed() -> LibreOfficeStatus {
    if let Some(path) = find_libreoffice() {
        // Try to get version (without showing console window on Windows)
        let version = {
            let mut cmd = std::process::Command::new(&path);
            cmd.arg("--version");
            
            // Hide console window on Windows
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            cmd.output()
                .ok()
                .and_then(|output| {
                    String::from_utf8(output.stdout)
                        .ok()
                        .map(|v| v.trim().to_string())
                })
        };

        LibreOfficeStatus {
            installed: true,
            path: Some(path.to_string_lossy().to_string()),
            version,
        }
    } else {
        LibreOfficeStatus {
            installed: false,
            path: None,
            version: None,
        }
    }
}

#[tauri::command]
fn get_libreoffice_download_url() -> String {
    // Return the official download URL
    String::from("https://www.libreoffice.org/download/download/")
}

#[tauri::command]
fn import_pptx_with_libreoffice(
    _app: tauri::AppHandle,
    path: String,
) -> Result<PptxFile, String> {
    use std::process::Command;

    // Check if LibreOffice is installed
    let libreoffice_path = find_libreoffice()
        .ok_or_else(|| "LibreOffice ist nicht installiert. Bitte installieren Sie LibreOffice, um PowerPoint-Dateien zu importieren.".to_string())?;

    // Create output directory for slide images
    let out_dir = {
        let millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get time: {}", e))?
            .as_millis();
        let pid = std::process::id();
        let mut d = std::env::temp_dir();
        d.push("openstage");
        d.push("pptx");
        d.push(format!("{}-{}", millis, pid));
        std::fs::create_dir_all(&d).map_err(|e| format!("Failed to create temp dir: {}", e))?;
        d
    };

    // Convert PPTX to images using LibreOffice
    // soffice --headless --convert-to png --outdir /tmp/slides presentation.pptx
    let mut cmd = Command::new(&libreoffice_path);
    cmd.args([
        "--headless",
        "--convert-to", "png",
        "--outdir", out_dir.to_str().ok_or("Invalid output directory")?,
        &path,
    ]);
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to run LibreOffice: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("LibreOffice conversion failed: {}", stderr));
    }

    // Find all generated PNG files
    let mut slide_images: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&out_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "png") {
                slide_images.push(path);
            }
        }
    }

    // Sort by filename
    slide_images.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    // Get presentation name
    let file_name = path
        .split('\\')
        .last()
        .or_else(|| path.split('/').last())
        .unwrap_or("Presentation")
        .to_string();

    // Create slide objects
    let slides: Vec<PptxSlide> = slide_images
        .iter()
        .enumerate()
        .map(|(i, image_path)| PptxSlide {
            slide_number: (i + 1) as u32,
            name: format!("Folie {}", i + 1),
            image_path: image_path.to_string_lossy().to_string(),
        })
        .collect();

    if slides.is_empty() {
        return Err("Keine Folien konnten extrahiert werden. Die Datei könnte beschädigt sein oder ein unsupported Format haben.".to_string());
    }

    // Note: Temp directory will be cleaned up on next app startup by cleanup_pptx_temp_files()

    Ok(PptxFile {
        name: file_name,
        slides,
    })
}

#[tauri::command]
fn get_monitors(app: tauri::AppHandle) -> Result<Vec<Monitor>, String> {
    match app.available_monitors() {
        Ok(monitors) => Ok(monitors
            .iter()
            .map(|m| Monitor {
                name: m.name().map_or(String::from("Unknown"), |n| n.to_string()),
                width: m.size().width,
                height: m.size().height,
                x: m.position().x,
                y: m.position().y,
            })
            .collect()),
        Err(e) => Err(format!("Failed to get monitors: {}", e)),
    }
}

#[tauri::command]
fn start_spotify_auth_server(app: tauri::AppHandle, port: u16) -> Result<String, String> {
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;
    use tauri::Emitter;
    
    let server_running = Arc::new(AtomicBool::new(true));
    let server_running_clone = server_running.clone();
    let app_handle_clone = app.clone();

    fn percent_decode(input: &str) -> String {
        let mut out = String::with_capacity(input.len());
        let bytes = input.as_bytes();
        let mut i = 0usize;
        while i < bytes.len() {
            match bytes[i] {
                b'%' if i + 2 < bytes.len() => {
                    let h1 = bytes[i + 1];
                    let h2 = bytes[i + 2];
                    let to_val = |h: u8| -> Option<u8> {
                        match h {
                            b'0'..=b'9' => Some(h - b'0'),
                            b'a'..=b'f' => Some(h - b'a' + 10),
                            b'A'..=b'F' => Some(h - b'A' + 10),
                            _ => None,
                        }
                    };
                    if let (Some(v1), Some(v2)) = (to_val(h1), to_val(h2)) {
                        out.push((v1 * 16 + v2) as char);
                        i += 3;
                        continue;
                    }
                    out.push('%');
                    i += 1;
                }
                b'+' => {
                    out.push(' ');
                    i += 1;
                }
                b => {
                    out.push(b as char);
                    i += 1;
                }
            }
        }
        out
    }
    
    // Bind once and move the listener into the server thread.
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .map_err(|e| format!("Port {} already in use: {}", port, e))?;

    thread::spawn(move || {
        listener.set_nonblocking(true).ok();
        
        // Wait for callback (timeout after 5 minutes)
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(300);
        
        while start.elapsed() < timeout && server_running_clone.load(Ordering::SeqCst) {
            if let Ok((mut stream, _)) = listener.accept() {
                use std::io::{Read, Write};
                let mut buffer = [0; 4096];
                if let Ok(n) = stream.read(&mut buffer) {
                    let request = String::from_utf8_lossy(&buffer[..n]);

                    // Parse request line: "GET /callback?code=... HTTP/1.1"
                    let request_line = request.lines().next().unwrap_or("");
                    let path = request_line.split_whitespace().nth(1).unwrap_or("");

                    if let Some(query) = path.strip_prefix("/callback?") {
                        let mut code: Option<String> = None;
                        for part in query.split('&') {
                            let mut it = part.splitn(2, '=');
                            let key = it.next().unwrap_or("");
                            let val = it.next().unwrap_or("");
                            if key == "code" {
                                code = Some(percent_decode(val));
                                break;
                            }
                        }

                        if let Some(code) = code {
                            // Send success response
                            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                                <!DOCTYPE html><html><head><title>Success</title>\
                                <script>window.close();</script></head>\
                                <body><h1>✅ Erfolgreich mit Spotify verbunden!</h1>\
                                <p>Dieses Fenster kann geschlossen werden.</p></body></html>";
                            let _ = stream.write_all(response.as_bytes());

                            // Emit event to frontend with the code
                            let _ = app_handle_clone.emit("spotify-auth-callback", code);

                            server_running_clone.store(false, Ordering::SeqCst);
                            break;
                        }
                    }
                    
                    // Send error response for other requests
                    let response = "HTTP/1.1 400 Bad Request\r\n\r\n";
                    let _ = stream.write_all(response.as_bytes());
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
        
        server_running_clone.store(false, Ordering::SeqCst);
    });
    
    // Wait a moment for server to start
    thread::sleep(Duration::from_millis(100));
    
    if !server_running.load(Ordering::SeqCst) {
        return Err("Failed to start auth server".to_string());
    }
    
    Ok(format!("http://127.0.0.1:{}/callback", port))
}

#[tauri::command]
fn import_pptx(path: String) -> Result<PptxFile, String> {
    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read PPTX: {}", e))?;

    let file_name = path
        .split('\\')
        .last()
        .or_else(|| path.split('/').last())
        .unwrap_or("Presentation")
        .to_string();

    let mut slides: Vec<PptxSlide> = Vec::new();

    let out_dir = {
        let millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get time: {}", e))?
            .as_millis();
        let pid = std::process::id();
        let mut d = std::env::temp_dir();
        d.push("openstage");
        d.push("pptx");
        d.push(format!("{}-{}", millis, pid));
        std::fs::create_dir_all(&d).map_err(|e| format!("Failed to create temp dir: {}", e))?;
        d
    };

    // Get slide count from presentation.xml
    let slide_count = archive
        .by_name("ppt/presentation.xml")
        .ok()
        .and_then(|mut f| {
            let mut content = String::new();
            f.read_to_string(&mut content).ok()?;
            // Count slide relationships
            Some(content.matches("<p:slideId").count())
        })
        .unwrap_or(0);

    // Extract slide images using slide relationship files (more reliable than guessing).
    for slide_num in 1..=(slide_count as u32) {
        let rels_path = format!("ppt/slides/_rels/slide{}.xml.rels", slide_num);
        let mut rels_xml = String::new();
        if let Ok(mut rels_file) = archive.by_name(&rels_path) {
            let _ = rels_file.read_to_string(&mut rels_xml);
        } else {
            continue;
        }

        // Naive extraction of the first image target in the rels file.
        // Example: Target="../media/image1.png"
        let mut target: Option<String> = None;
        let mut search_from = 0usize;
        while let Some(pos) = rels_xml[search_from..].find("Target=\"") {
            let start = search_from + pos + "Target=\"".len();
            if let Some(end_rel) = rels_xml[start..].find('"') {
                let raw = &rels_xml[start..start + end_rel];
                let raw = raw.replace("\\", "/");
                let lower = raw.to_lowercase();
                if lower.contains("media/")
                    && (lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".jpeg"))
                {
                    target = Some(raw);
                    break;
                }
                search_from = start + end_rel + 1;
            } else {
                break;
            }
        }

        let Some(target) = target else { continue };

        let zip_image_path = if target.starts_with("../") {
            format!("ppt/{}", target.trim_start_matches("../"))
        } else if target.starts_with("media/") {
            format!("ppt/{}", target)
        } else if target.starts_with("ppt/") {
            target
        } else {
            // Best-effort fallback (most PPTX use ../media/...)
            format!("ppt/{}", target.trim_start_matches('/'))
        };

        let mut buffer = Vec::new();
        if let Ok(mut image_file) = archive.by_name(&zip_image_path) {
            if image_file.read_to_end(&mut buffer).is_err() {
                continue;
            }
        } else {
            continue;
        }

        let ext = zip_image_path
            .rsplit('.')
            .next()
            .unwrap_or("png")
            .to_lowercase();

        let mut out_path: PathBuf = out_dir.clone();
        out_path.push(format!("slide-{:03}.{}", slide_num, ext));
        std::fs::write(&out_path, &buffer)
            .map_err(|e| format!("Failed to write slide image: {}", e))?;

        slides.push(PptxSlide {
            slide_number: slide_num,
            name: format!("Folie {}", slide_num),
            image_path: out_path.to_string_lossy().to_string(),
        });
    }

    // If no slide relations were found, extract all images from ppt/media/ as a fallback.
    if slides.is_empty() {
        let mut media_entries: Vec<String> = Vec::new();
        for idx in 0..archive.len() {
            if let Ok(f) = archive.by_index(idx) {
                let name = f.name().replace("\\", "/");
                let lower = name.to_lowercase();
                if lower.starts_with("ppt/media/")
                    && (lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".jpeg"))
                {
                    media_entries.push(name);
                }
            }
        }
        media_entries.sort();

        for (i, zip_path) in media_entries.iter().enumerate() {
            let mut buffer = Vec::new();
            if let Ok(mut f) = archive.by_name(zip_path) {
                if f.read_to_end(&mut buffer).is_err() {
                    continue;
                }
            } else {
                continue;
            }

            let slide_num = (i as u32) + 1;
            let ext = zip_path.rsplit('.').next().unwrap_or("png").to_lowercase();
            let mut out_path: PathBuf = out_dir.clone();
            out_path.push(format!("slide-{:03}.{}", slide_num, ext));
            std::fs::write(&out_path, &buffer)
                .map_err(|e| format!("Failed to write slide image: {}", e))?;

            slides.push(PptxSlide {
                slide_number: slide_num,
                name: format!("Folie {}", slide_num),
                image_path: out_path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(PptxFile {
        name: file_name,
        slides,
    })
}

pub fn run() {
    // Clean up temp files from previous sessions on startup
    cleanup_pptx_temp_files();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Clean up temp files on exit
            let app_handle = app.handle().clone();
            app_handle.listen("tauri://before-close", move |_| {
                cleanup_pptx_temp_files();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_monitors,
            import_pptx,
            import_pptx_with_libreoffice,
            check_libreoffice_installed,
            get_libreoffice_download_url,
            start_spotify_auth_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
