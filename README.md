# OpenStage 🎬

**Open-source Präsentationssoftware für Live-Events, Gottesdienste und Konzerte.**

Entwickelt für alle, die die Technik hinter der Bühne steuern – nicht nur für die Sprecher.

![Version](https://img.shields.io/github/v/release/gesom/openstage?style=flat-square)
![License](https://img.shields.io/github/license/gesom/openstage?style=flat-square)
![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey?style=flat-square)

---

## ✨ Features

### 🎯 Live-Steuerung
- **Multi-Monitor-Support** – Operator-Ansicht + separates Output-Fenster für Beamer/Projektor
- **Show-Modus** – Komplette Ablaufplanung mit Queue, Vorschau und Live-Steuerung
- **Blackout** – Ein Klick zum Abdunkeln der Ausgabe
- **Tastatur-Steuerung** – Pfeiltasten, Space für Navigation

### 📝 Medien & Inhalte
- **PowerPoint Import** – Exportiere als PDF für perfekte Darstellung (alle Seiten einzeln navigierbar)
- **Song-Texte** – Folienweise mit Labels (Strophe, Refrain, etc.)
- **Song Import/Export** – JSON-Format zum Teilen und Archivieren
- **Bilder** – Alle gängigen Formate (JPG, PNG, GIF, SVG, WebP)
- **Videos** – MP4, WebM, OGG mit Play/Pause/Seek-Steuerung
- **Countdown Timer** – Verschiedene Themes (Default, Minimal, Bold)

### 🎵 Audio
- **Musik-Wiedergabe** – Lokale Audiodateien
- **Queue-System** – Playlists für automatische Wiedergabe
- **Lautstärke-Steuerung** – Pro Titel einstellbar

### 🛠️ Bedienung
- **Drag & Drop** – Reihenfolge per Maus ändern
- **Suche** – Songs durchsuchen (Titel, Künstler, Text)
- **Präsentationsmodus** – Vollbild für PDFs mit Tastatur-Navigation
- **HiDPI Rendering** – Gestochen scharfe Darstellung auf allen Displays

---

## 📥 Installation

### Downloads
Lade die neueste Version von der [Releases-Seite](https://github.com/gesom/openstage/releases) herunter.

### Windows
| Datei | Beschreibung |
|-------|-------------|
| `openstage-v{version}-windows-x64-setup.exe` | **Empfohlen** – NSIS Installer |
| `openstage-v{version}-windows-x64-installer.msi` | Windows Installer (MSI) |
| `openstage-v{version}-windows-x64-portable.exe` | Portable – keine Installation nötig |

### macOS
| Datei | Beschreibung |
|-------|-------------|
| `openstage-v{version}-macos-arm64.dmg` | **Apple Silicon** (M1/M2/M3) |
| `openstage-v{version}-macos-intel.dmg` | **Intel** (ältere Macs bis 2019) |

### Linux
| Datei | Beschreibung |
|-------|-------------|
| `openstage-v{version}-linux-amd64.deb` | Debian/Ubuntu (.deb) |
| `openstage-v{version}-linux-x86_64.AppImage` | AppImage (die meisten Distros) |

---

## 🚀 Erste Schritte

### 1. Output-Fenster einrichten
1. Gehe zum Tab **Display**
2. Wähle den Monitor für die Ausgabe (Beamer, zweiter Bildschirm)
3. Klicke auf **Output öffnen**
4. Das Output-Fenster öffnet sich auf dem gewählten Monitor

### 2. Medien importieren
#### PowerPoint als PDF importieren
1. PowerPoint öffnen
2. `Datei → Exportieren → PDF/XPS erstellen`
3. PDF speichern
4. In OpenStage: Tab **Medien** → **+ PowerPoint** klicken
5. Anleitung befolgen → PDF auswählen
6. Alle Seiten werden einzeln angezeigt

#### Bilder & Videos
- Tab **Medien** → **+ Medien** → Dateien auswählen

#### Songs erstellen
- Tab **Songs** → **+ Neues Lied**
- Titel, Künstler und Folien eingeben
- Jede Folie kann mit Label versehen werden (z.B. "Strophe 1", "Refrain")

#### Songs importieren/exportieren
- **Export:** Song-Liste → 📤 Button beim gewünschten Song
- **Import:** Tab **Songs** → **📥 Import** → JSON-Datei auswählen

### 3. Show planen (optional)
1. Tab **Show** öffnen
2. Elemente aus Medien, Songs, Countdown hinzufügen
3. Reihenfolge per Drag & Drop anpassen
4. Im Live-Betrieb mit ← → zwischen den Elementen navigieren

---

## 🎹 Tastaturkürzel

### Global
| Taste | Aktion |
|-------|--------|
| `F5` | Output-Fenster öffnen/schließen |
| `Esc` | Präsentationsmodus beenden |

### Im Präsentationsmodus (PDFs)
| Taste | Aktion |
|-------|--------|
| `→` / `Space` | Nächste Seite |
| `←` | Vorherige Seite |
| `Page Down` | Nächste Seite |
| `Page Up` | Vorherige Seite |
| `Esc` | Modus beenden |

### Im Show-Modus
| Taste | Aktion |
|-------|--------|
| `→` | Nächstes Element / Nächste Folie |
| `←` | Vorheriges Element / Vorherige Folie |
| `↑` | Vorheriges Element in Queue |
| `↓` | Nächstes Element in Queue |
| `Space` | Nächstes Element |

---

## 📖 Verwendung

### PowerPoint-Präsentationen
OpenStage importiert PowerPoint-Dateien als PDF für **100% Layout-Treue**:
- Schriftarten werden korrekt dargestellt
- Positionierung bleibt exakt erhalten
- Alle Effekte und Transparenzen funktionieren

**Workflow:**
1. PowerPoint → `Datei → Exportieren → PDF erstellen`
2. PDF in OpenStage importieren
3. Im **Medien**-Tab oder **Show**-Modus verwenden

### Songs verwalten
**Song-Format (JSON):**
```json
{
  "title": "Beispiel Lied",
  "artist": "Unbekannt",
  "slides": [
    {
      "id": "slide-1",
      "text": "Dies ist der Text\nder ersten Strophe.",
      "label": "Strophe 1"
    },
    {
      "id": "slide-2",
      "text": "Das ist der Refrain.",
      "label": "Refrain"
    }
  ]
}
```

**Tipp:** Siehe `example-song.json` für ein vollständiges Beispiel.

### Countdown Timer
1. Tab **Countdown** öffnen
2. Dauer einstellen (Minuten:Sekunden)
3. Theme wählen:
   - **Default** – Aurora-Hintergrund, große Anzeige
   - **Minimal** – Schlichte Textanzeige
   - **Bold** – Fetter Stil mit Akzent-Leiste
4. Timer starten oder als Item zur Show hinzufügen

---

## 🛠️ Entwicklung

### Voraussetzungen
- [Node.js](https://nodejs.org/) v20+
- [Rust](https://rustup.rs/) (für Tauri)
- npm oder pnpm

### Projekt klonen
```bash
git clone https://github.com/gesom/openstage.git
cd openstage
```

### Abhängigkeiten installieren
```bash
npm install
```

### Entwicklungsserver starten
```bash
npm run dev
```

### Build erstellen
```bash
npm run build
npm run tauri build
```

### Code-Qualität
```bash
# Linting
npm run lint
npm run lint:fix

# Formatierung
npm run format
npm run format:check
```

---

## 🏗️ Tech Stack

| Bereich | Technologie |
|---------|------------|
| **Frontend** | React 18, TypeScript, TailwindCSS |
| **State** | Zustand |
| **Backend** | Tauri v2 (Rust) |
| **PDF-Rendering** | PDF.js (Mozilla) |
| **Build** | Vite |

---

## 🤝 Contributing

Beiträge sind herzlich willkommen! So kannst du helfen:

### Mitmachen
1. Repository forken
2. Feature-Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Commits machen (`git commit -m 'Add amazing feature'`)
4. Pushen (`git push origin feature/amazing-feature`)
5. Pull Request öffnen

### Richtlinien
- Folge dem bestehenden Code-Style
- Füge Tests hinzu, wo sinnvoll
- Dokumentiere neue Features
- Halte PRs klein und fokussiert

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

---

## 📄 Lizenz

OpenStage ist lizenziert unter der **GPL v3 License**.  
Siehe [LICENSE](LICENSE) für Details.

---

## 🙏 Danksagungen

- [Tauri](https://tauri.app) – Für das fantastische Rust-basierte Framework
- [PDF.js](https://mozilla.github.io/pdf.js/) – Mozilla's PDF-Renderer
- [React](https://react.dev) – Die UI-Bibliothek
- [Zustand](https://zustand-demo.pmnd.rs/) – Minimalistischer State-Manager
- [TailwindCSS](https://tailwindcss.com/) – Utility-First CSS

---

## 📞 Support & Kontakt

- **Issues:** [GitHub Issues](https://github.com/gesom/openstage/issues)
- **Discussions:** [GitHub Discussions](https://github.com/gesom/openstage/discussions)
- **Releases:** [GitHub Releases](https://github.com/gesom/openstage/releases)

---

**OpenStage** – Built with ❤️ for live event creators everywhere.
