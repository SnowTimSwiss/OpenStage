use serde::{Deserialize, Serialize};
use std::io::{Read, Seek};
use std::path::PathBuf;
use tauri::{Manager, WindowEvent};
use zip::read::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyAuthResponse {
    pub code: String,
    pub state: Option<String>,
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
    pub notes: Option<String>, // Presenter notes from the slide
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

fn collect_slide_numbers_from_archive<R: Read + Seek>(archive: &mut ZipArchive<R>) -> Vec<u32> {
    let mut numbers = Vec::new();
    for idx in 0..archive.len() {
        if let Ok(file) = archive.by_index(idx) {
            let name = file.name().replace("\\", "/");
            if let Some(rest) = name.strip_prefix("ppt/slides/slide") {
                if let Some(num_str) = rest.strip_suffix(".xml") {
                    if let Ok(n) = num_str.parse::<u32>() {
                        numbers.push(n);
                    }
                }
            }
        }
    }
    numbers.sort_unstable();
    numbers.dedup();
    numbers
}

#[cfg(any())]
fn count_pptx_slides(path: &str) -> usize {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return 0,
    };
    let mut archive = match ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return 0,
    };

    let numbers = collect_slide_numbers_from_archive(&mut archive);
    if !numbers.is_empty() {
        return numbers.len();
    }

    archive
        .by_name("ppt/presentation.xml")
        .ok()
        .and_then(|mut f| {
            let mut content = String::new();
            f.read_to_string(&mut content).ok()?;
            let count = content.matches("<p:sldId").count();
            if count > 0 {
                Some(count)
            } else {
                Some(content.matches("<p:slideId").count())
            }
        })
        .unwrap_or(0)
}

#[cfg(any())]
fn path_to_file_url(path: &std::path::Path) -> String {
    let mut raw = path.to_string_lossy().replace('\\', "/");
    if !raw.starts_with('/') {
        raw = format!("/{}", raw);
    }
    let encoded = raw.replace(' ', "%20");
    format!("file://{}", encoded)
}

/// Get LibreOffice installation status
#[cfg(any())]
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

#[allow(dead_code)]
#[cfg(any())]
fn import_pptx_with_libreoffice(
    _app: tauri::AppHandle,
    path: String,
) -> Result<PptxFile, String> {
    use std::process::Command;
    use zip::read::ZipArchive;

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

    let expected_slide_count = count_pptx_slides(&path);

    let work_dir = out_dir.join("lo-work");
    std::fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Failed to create LibreOffice work dir: {}", e))?;
    let rendered_dir = out_dir.join("rendered");
    std::fs::create_dir_all(&rendered_dir)
        .map_err(|e| format!("Failed to create rendered dir: {}", e))?;
    let profile_dir = out_dir.join("lo-profile");
    std::fs::create_dir_all(&profile_dir)
        .map_err(|e| format!("Failed to create LibreOffice profile dir: {}", e))?;
    let profile_url = path_to_file_url(&profile_dir);

    let read_pngs = |dir: &PathBuf| -> Vec<PathBuf> {
        let mut result: Vec<PathBuf> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("png"))
                    .unwrap_or(false)
                {
                    result.push(path);
                }
            }
        }
        result.sort_by(|a, b| a.file_name().cmp(&b.file_name()));
        result
    };

    let clear_pngs = |dir: &PathBuf| {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let is_png = path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("png"))
                    .unwrap_or(false);
                if is_png {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    };

    let run_convert = |filter: &str| -> Result<std::process::Output, String> {
        let mut cmd = Command::new(&libreoffice_path);
        cmd.args([
            &format!("-env:UserInstallation={}", profile_url),
            "--headless",
            "--nologo",
            "--nolockcheck",
            "--norestore",
            "--nodefault",
            "--convert-to", filter,
            "--outdir", work_dir.to_str().ok_or("Invalid output directory")?,
            &path,
        ]);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
            .map_err(|e| format!("Failed to run LibreOffice: {}", e))
    };

    let mut slide_images: Vec<PathBuf> = Vec::new();
    let mut last_stderr = String::new();
    let all_images_identical = |paths: &[PathBuf]| -> bool {
        if paths.len() <= 1 {
            return false;
        }
        let first = std::fs::read(&paths[0]).ok();
        let Some(first_bytes) = first else { return false };
        paths
            .iter()
            .skip(1)
            .all(|p| std::fs::read(p).map(|b| b == first_bytes).unwrap_or(false))
    };

    // Prefer deterministic per-slide export so multi-slide decks don't collapse to a single image.
    if expected_slide_count > 0 {
        for slide_num in 1..=expected_slide_count {
            clear_pngs(&work_dir);

            let per_slide_filters = [
                format!(
                    "png:impress_png_Export:{{\"PageNumber\":{{\"type\":\"long\",\"value\":\"{}\"}}}}",
                    slide_num
                ),
                format!(
                    "png:draw_png_Export:{{\"PageNumber\":{{\"type\":\"long\",\"value\":\"{}\"}}}}",
                    slide_num
                ),
                format!("png:impress_png_Export:PageNumber={}", slide_num),
                format!("png:draw_png_Export:PageNumber={}", slide_num),
                format!(
                    "png:impress_png_Export:{{\"PageRange\":{{\"type\":\"string\",\"value\":\"{}-{}\"}}}}",
                    slide_num, slide_num
                ),
                format!(
                    "png:draw_png_Export:{{\"PageRange\":{{\"type\":\"string\",\"value\":\"{}-{}\"}}}}",
                    slide_num, slide_num
                ),
                format!("png:impress_png_Export:PageRange={}-{}", slide_num, slide_num),
                format!("png:draw_png_Export:PageRange={}-{}", slide_num, slide_num),
                format!(
                    "png:impress_png_Export:{{\"PageNumber\":{{\"type\":\"long\",\"value\":\"{}\"}}}}",
                    slide_num.saturating_sub(1)
                ),
                format!(
                    "png:draw_png_Export:{{\"PageNumber\":{{\"type\":\"long\",\"value\":\"{}\"}}}}",
                    slide_num.saturating_sub(1)
                ),
            ];

            let mut exported: Option<PathBuf> = None;
            for filter in per_slide_filters {
                let output = run_convert(&filter)?;
                if !output.status.success() {
                    last_stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    continue;
                }

                let images = read_pngs(&work_dir);
                let Some(image_path) = images.first() else { continue };

                let ext = image_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("png")
                    .to_ascii_lowercase();
                let mut stable_path = rendered_dir.clone();
                stable_path.push(format!("slide-{:03}.{}", slide_num, ext));
                std::fs::copy(image_path, &stable_path)
                    .map_err(|e| format!("Failed to persist rendered slide: {}", e))?;
                exported = Some(stable_path);
                break;
            }

            if let Some(image_path) = exported {
                slide_images.push(image_path);
            } else {
                slide_images.clear();
                break;
            }
        }
    }

    // If filter options were ignored and every rendered file is identical,
    // force fallback path instead of importing duplicated slide 1.
    if slide_images.len() > 1 && all_images_identical(&slide_images) {
        slide_images.clear();
    }

    if slide_images.is_empty() {
        let filters = ["png", "png:impress_png_Export", "png:draw_png_Export"];
        let mut best_images: Vec<PathBuf> = Vec::new();

        for filter in filters {
            clear_pngs(&work_dir);
            let output = run_convert(filter)?;

            if !output.status.success() {
                last_stderr = String::from_utf8_lossy(&output.stderr).to_string();
                continue;
            }

            let images = read_pngs(&work_dir);
            if images.len() > best_images.len() {
                best_images = images;
            }

            if expected_slide_count > 0 && best_images.len() >= expected_slide_count {
                break;
            }
        }

        if best_images.is_empty() {
            if let Ok(parsed) = import_pptx(path.clone()) {
                if !parsed.slides.is_empty() {
                    return Ok(parsed);
                }
            }
            return Err(format!("LibreOffice conversion failed: {}", last_stderr));
        }

        // LibreOffice can export only one image for some decks/settings.
        // Prefer internal importer only when it actually yields better results.
        if expected_slide_count > 1 && best_images.len() <= 1 {
            if let Ok(parsed) = import_pptx(path.clone()) {
                if !parsed.slides.is_empty() {
                    return Ok(parsed);
                }
            }
        }

        slide_images = best_images;
    }

    // Extract presenter notes from the PPTX file (ZIP archive)
    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read PPTX: {}", e))?;

    // Get presentation name
    let file_name = path
        .split('\\')
        .last()
        .or_else(|| path.split('/').last())
        .unwrap_or("Presentation")
        .to_string();

    // Create slide objects with notes
    let slides: Vec<PptxSlide> = slide_images
        .iter()
        .enumerate()
        .map(|(i, image_path)| {
            let slide_num = (i + 1) as u32;
            
            // Extract presenter notes from notesSlide XML
            let notes_path = format!("ppt/notesSlides/notesSlide{}.xml", slide_num);
            let notes = archive
                .by_name(&notes_path)
                .ok()
                .and_then(|mut f| {
                    let mut content = String::new();
                    f.read_to_string(&mut content).ok()?;
                    extract_notes_from_xml(&content)
                });

            PptxSlide {
                slide_number: slide_num,
                name: format!("Folie {}", slide_num),
                image_path: image_path.to_string_lossy().to_string(),
                notes,
            }
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

/// Extract presenter notes from a slide's notesSlide XML
fn extract_notes_from_xml(xml_content: &str) -> Option<String> {
    // Look for <p:txBody><a:p> elements containing the notes text
    // PowerPoint stores notes in ppt/notesSlides/notesSlideX.xml
    
    // Simple extraction: find text inside <a:t> tags within the notes body
    let mut notes = String::new();
    let mut in_text = false;
    let mut chars = xml_content.chars().peekable();
    let mut tag_buffer = String::new();
    
    while let Some(c) = chars.next() {
        if c == '<' {
            tag_buffer.clear();
            while let Some(&next_c) = chars.peek() {
                if next_c == '>' {
                    chars.next();
                    break;
                }
                tag_buffer.push(chars.next()?);
            }
            
            let tag_lower = tag_buffer.to_lowercase();
            if tag_lower.starts_with("a:t") || tag_lower.starts_with("a:t ") {
                in_text = true;
            } else if tag_lower.starts_with("/a:t") {
                in_text = false;
                if !notes.is_empty() && !notes.ends_with(' ') {
                    notes.push(' ');
                }
            }
        } else if in_text {
            notes.push(c);
        }
    }
    
    let notes = notes.trim().to_string();
    if notes.is_empty() {
        None
    } else {
        Some(notes)
    }
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

    let slide_numbers = collect_slide_numbers_from_archive(&mut archive);

    // Extract slide images using slide relationship files (more reliable than guessing).
    for slide_num in slide_numbers {
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

        // Extract presenter notes from notesSlide XML
        let notes_path = format!("ppt/notesSlides/notesSlide{}.xml", slide_num);
        let notes = archive
            .by_name(&notes_path)
            .ok()
            .and_then(|mut f| {
                let mut content = String::new();
                f.read_to_string(&mut content).ok()?;
                extract_notes_from_xml(&content)
            });

        slides.push(PptxSlide {
            slide_number: slide_num,
            name: format!("Folie {}", slide_num),
            image_path: out_path.to_string_lossy().to_string(),
            notes,
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

            // Extract presenter notes from notesSlide XML (fallback)
            let notes_path = format!("ppt/notesSlides/notesSlide{}.xml", slide_num);
            let notes = archive
                .by_name(&notes_path)
                .ok()
                .and_then(|mut f| {
                    let mut content = String::new();
                    f.read_to_string(&mut content).ok()?;
                    extract_notes_from_xml(&content)
                });

            slides.push(PptxSlide {
                slide_number: slide_num,
                name: format!("Folie {}", slide_num),
                image_path: out_path.to_string_lossy().to_string(),
                notes,
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
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    if let Some(output) = window.app_handle().get_webview_window("output") {
                        let _ = output.close();
                    }
                    cleanup_pptx_temp_files();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_monitors,
            import_pptx,
            start_spotify_auth_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
