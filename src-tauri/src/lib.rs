use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::PathBuf;
use tauri::Listener;
use zip::read::ZipArchive;

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
        .setup(|app| {
            // Clean up temp files on exit
            let app_handle = app.handle().clone();
            app_handle.listen("tauri://before-close", move |_| {
                cleanup_pptx_temp_files();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_monitors, import_pptx])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
