use serde::{Deserialize, Serialize};
use std::io::Read;
use zip::read::ZipArchive;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

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
    pub image_data: String, // Base64-encoded PNG
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PptxFile {
    pub name: String,
    pub slides: Vec<PptxSlide>,
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
    
    let mut slides = Vec::new();
    
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
    
    // Extract slide images
    for i in 0..slide_count {
        let slide_num = i + 1;
        
        // Try to find slide image in ppt/slides/_rels/slide{i+1}.xml.rels
        // Or look for embedded images in ppt/media/
        
        // For now, try common image patterns
        let mut image_data = String::new();
        let mut found_image = false;
        
        // Try slide-specific images first (slide1/image1.png, etc.)
        for j in 1..=5 {
            let image_path = format!("ppt/media/image{}.png", (i * 5) + j);
            if let Ok(mut slide_file) = archive.by_name(&image_path) {
                let mut buffer = Vec::new();
                if slide_file.read_to_end(&mut buffer).is_ok() {
                    image_data = BASE64.encode(&buffer);
                    found_image = true;
                    break;
                }
            }
        }
        
        // Fallback: search for any image for this slide
        if !found_image {
            for idx in 0..archive.len() {
                if let Ok(mut f) = archive.by_index(idx) {
                    let name = f.name().to_string();
                    if name.contains("media/image") && name.ends_with(".png") {
                        let mut buffer = Vec::new();
                        if f.read_to_end(&mut buffer).is_ok() {
                            image_data = BASE64.encode(&buffer);
                            found_image = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if found_image {
            slides.push(PptxSlide {
                slide_number: slide_num as u32,
                name: format!("Folie {}", slide_num),
                image_data,
            });
        }
    }
    
    // If no slides found, try to extract all images as fallback
    if slides.is_empty() {
        for idx in 0..archive.len() {
            if let Ok(mut f) = archive.by_index(idx) {
                let name = f.name().to_string();
                if name.contains("media/") && (name.ends_with(".png") || name.ends_with(".jpg") || name.ends_with(".jpeg")) {
                    let mut buffer = Vec::new();
                    if f.read_to_end(&mut buffer).is_ok() {
                        slides.push(PptxSlide {
                            slide_number: slides.len() as u32 + 1,
                            name: format!("Bild {}", slides.len() + 1),
                            image_data: BASE64.encode(&buffer),
                        });
                    }
                }
            }
        }
    }
    
    Ok(PptxFile {
        name: file_name,
        slides,
    })
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
        .invoke_handler(tauri::generate_handler![get_monitors, import_pptx])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
