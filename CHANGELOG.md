# Changelog

Alle wesentlichen Änderungen an OpenStage werden in dieser Datei dokumentiert.

## [1.1.0] - 2026-03-18

### Hinzugefügt
- **Show Mode (Show Tab)** – Neuer Live-Control-View für Events
  - Show Queue mit allen Items (Images, Videos, Songs, Countdown, PDFs)
  - Vorschau-Fenster für aktuelles Item
  - Drag & Drop zum Sortieren der Queue
  - Keyboard-Controls: ←→ für Slides, ↑↓ für Items, Space für Next
  - Slide-Navigation für Songs und PDF-Präsentationen
  - "Add to Show" Modal zur einfachen Auswahl
  - Unterstützung für PDF-Präsentationen mit Seiten-Navigation
  - Live-Indicator für aktuelles Item
- **PDF Import** (PowerPoint als PDF exportieren)
  - Exportiere PowerPoint als PDF für perfekte Layout-Treue
  - Automatische Anleitung beim Import
  - Alle Seiten werden einzeln gerendert
  - HiDPI Rendering für gestochen scharfe Darstellung
  - Präsentationsmodus mit Tastatursteuerung (Pfeiltasten, ESC)
- **Song Import/Export**
  - Songs als JSON-Datei exportieren und importieren
  - Einfaches, menschenlesbares Format
  - Beispiel-Datei `example-song.json` enthalten
  - Import-Validierung für korrektes Format
- **Apple Silicon Support** (macOS ARM64/M1/M2/M3)
  - Separate Builds für Intel und Apple Silicon
  - Optimierte Performance auf M-Chips

### Geändert
- Preview im Show Tab vereinfacht (nur noch 1 Fenster)
- Output-System erweitert für Show-Item-Wiedergabe
- **Release Naming Scheme** normalisiert
  - Einheitliches Format: `openstage-v{version}-{platform}-{variant}.{ext}`
  - Klare Unterscheidung nach Plattform und Installationsart
  - Beispiel: `openstage-v1.1.0-windows-x64-setup.exe`

### Entfernt
- **PPTXjs Abhängigkeit** - Wechsel zu PDF-basiertem Import
- **LibreOffice Dependency** - Nicht mehr benötigt

## [1.0.0] - 2026-03-16

### Hinzugefügt
- **PowerPoint-Import mit LibreOffice-Integration**
  - Automatische Erkennung ob LibreOffice installiert ist
  - Installations-Prompt mit Download-Link wenn nicht vorhanden
  - Konvertiert PPTX-Folien zu Bildern (PNG)
  - Unterstützt Windows, macOS, Linux
- Drag & Drop für Folien-Reihenfolge
- Drag & Drop für Musik-Queue
- Fade-Transitionen (300ms) bei Output-Wechseln
- Error-Handling bei File-Operationen (Slides, Videos, Musik)
- Loading-States beim Laden von Dateien
- Video-Fehleranzeige bei ungültigen Formaten
- Einstellungen-Persistenz mit localStorage
  - Countdown-Dauer und Label
  - Ausgewählter Monitor
- Error-State im Store (wird über UI angezeigt)

### Geändert
- CSP-Richtlinie gestrafft (`script-src 'unsafe-inline'` entfernt)
- Monitor-API gibt jetzt `Result` statt `Vec` zurück (bessere Fehlerbehandlung)
- Video-Player setzt sich bei Fehler zurück auf blank

### Behoben
- Memory-Leak bei Intervalls (Countdown)
- Unwrap-Panic in der Monitor-API
- Terminal-Fenster beim LibreOffice-Aufruf (Windows)

---

## [0.3.0] - 2026-03-16

### Hinzugefügt
- Multi-Display Konfiguration (Operator-Ansicht + Beamer-Ausgabe)
- Folien / Bilder (PNG, JPG, GIF, WebP, BMP)
- Lieder mit Slides (Editor mit Strophe/Refrain-Struktur)
- Countdown-Timer mit einstellbarer Dauer und Label
- Video-Player (MP4, MOV, AVI, MKV, WebM)
- Musik-Player mit Queue (MP3, WAV, FLAC, AAC, OGG)
- Blackout-Funktion (Taste: B)
- Keyboard-Shortcuts
  - `B` – Blackout umschalten
  - `→` / `Space` – Nächste Folie
  - `←` – Vorherige Folie
- Live-Vorschau im Operator-Fenster
- Multi-Monitor-Support

### Tech Stack
- Tauri 2.x (Rust + TypeScript)
- React 18
- Zustand (State Management)
- Tailwind CSS
- Vite

---

## Versionierung

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/lang/de/):
- **MAJOR** – Inkompatible API-Änderungen
- **MINOR** – Neue Funktionen (abwärtskompatibel)
- **PATCH** – Bugfixes (abwärtskompatibel)

---

## Format

- `[Unreleased]` – Änderungen im aktuellen Development-Branch
- `[MAJOR.MINOR.PATCH]` – Datum des Releases
- Kategorien: `Hinzugefügt`, `Geändert`, `Behoben`, `Entfernt`
