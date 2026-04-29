# Changelog

Alle wesentlichen Änderungen an OpenStage werden in dieser Datei dokumentiert.

## [1.3.1] - 2026-03-22

### Hinzugefügt
- **Ganzes Lied anzeigen** – Alle Folien eines Liedes auf einmal
  - Toggle "Ganzes Lied" im Songs-Tab (global für alle Lieder)
  - Alle Folien werden kombiniert angezeigt (mit \n\n getrennt)
  - Intelligente 2-Spalten-Ansicht für bessere Lesbarkeit
  - Automatische Schriftgrößen-Anpassung bei aktiviertem Modus
  - Navigation springt bei "Ganzes Lied" direkt zwischen Items
  - Vorschau im Songs-Tab zeigt gleiches Layout wie Output
  - Hintergrundbild-Unterstützung auch für ganze Lieder
  - Funktioniert im Songs-Tab und Show-Modus

## [1.3.0] - 2026-03-22

### Hinzugefügt
- **GitHub Songs Repository** – Zentrale Song-Bibliothek zum Teilen
  - Songs aus GitHub Repository herunterladen (ohne Login)
  - Eigene Songs ins Repository hochladen (mit GitHub Token)
  - Repository Modal mit Übersicht aller verfügbarer Songs
  - Download-Status Anzeige (lokal verfügbar / nicht heruntergeladen)
  - GitHub Authentication mit Personal Access Token (PAT)
  - Upload-Validierung (Titel, Folien, Textlänge)
  - CC0-1.0 Lizenz (Public Domain)
  - Link zum Repository: https://github.com/SnowTimSwiss/OpenStage-songs
- **Auto-Save Persistenz** – Daten bleiben über Neustarts erhalten
  - Media-Bibliothek (Bilder, Videos) wird automatisch gespeichert
  - Show Queue wird automatisch gespeichert
  - Beim App-Start automatische Wiederherstellung
  - Nur Dateipfade werden gespeichert (keine Binärdaten)
- **Reset-Funktionen** – Bibliotheken gezielt leeren
  - Media-Tab: Reset-Button zum Löschen aller Medien
  - Show-Tab: Reset-Button zum Leeren der Show Queue
  - Bestätigungs-Dialog vor jedem Löschen
  - Nur sichtbar wenn Daten vorhanden sind
- **Player Widget entfernt** – Countdown Tab aufgeräumt
  - Gesperrtes Player-Widget im Countdown Tab entfernt
  - Hintergrundmusik-Einstellungen bleiben erhalten
- **Verbesserte Show-Steuerung** – Musik-Playback korrigiert
  - Klick auf Musik-Item in Queue startet richtigen Track
  - Show-Navigation (↑↓) wechselt korrekt zwischen Musik-Tracks
  - Label-Anzeige für Musik-Items korrigiert

### Geändert
- **Preview Zone Layout** – Slide-Grid neben Vorschau (nicht darunter)
  - Bei Songs/PDFs: Preview links, Grid rechts
  - Scrollbar nur im Grid-Bereich
  - Grid von 4 auf 2 Spalten reduziert (kompakter)
  - Kleinere Schriftarten für bessere Übersicht

### Sicherheit
- Upload-Validierung für Songs (keine zu langen Texte)
- Explizite Bestätigung vor GitHub Uploads
- Token nur mit "repo" Berechtigung

## [1.2.0] - 2026-03-21

### Hinzugefügt
- **Musik in der Show** – Einzelne Lieder oder Playlists zur Show hinzufügen
  - Musik-Tracks aus dem Music-Tab direkt zur Show-Queue hinzufügen
  - Ganze Playlists als Show-Item verwenden
  - Automatische Wiedergabe beim Wechsel zum Musik-Element
  - Titel und Künstler werden im Output angezeigt
- **Musik-Overlay umschaltbar** – Pro Lied/Playlist einstellbar
  - 👁 Icon in der Queue: Overlay ein/aus schalten
  - Bei "aus": Blackscreen im Output (Musik läuft weiter)
  - Bei "ein": Titel & Künstler werden angezeigt
- **Pro Presenter Grid-Ansicht** – Folien-Übersicht für Songs & PDFs
  - Alle Folien auf einen Blick in 4-Spalten-Grid
  - Klick auf Folie springt direkt dazu
  - Aktuelle Folie orange hervorgehoben
  - Song-Folien mit Label (Strophe, Refrain, etc.)
  - PDF-Seiten als Thumbnail-Vorschau

## [1.0.0] - 2026-03-18

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
  - Beispiel: `openstage-v1.0.0-windows-x64-setup.exe`

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
