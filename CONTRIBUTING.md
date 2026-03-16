# Contributing to OpenStage

Danke, dass du zu OpenStage beitragen möchtest! 🎉

## Schnellstart

### Voraussetzungen

- [Node.js](https://nodejs.org/) (v18 oder höher)
- [Rust](https://rustup.rs/) (neueste stabile Version)
- Git

### Installation

```bash
# Repository klonen
git clone https://github.com/OpenStage/openstage.git
cd openstage

# Dependencies installieren
npm install

# Development-Server starten
npm run tauri dev
```

### Build

```bash
# Production-Build erstellen
npm run tauri build
```

## Projektstruktur

```
openstage/
├── src/                    # Frontend (React/TypeScript)
│   ├── operator/           # Operator-Fenster (Steuerung)
│   ├── output/             # Output-Fenster (Beamer-Ausgabe)
│   ├── store/              # Zustand (State Management)
│   ├── types/              # TypeScript-Typen
│   └── lib/                # Utilities
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs          # Tauri Commands
│   │   └── main.rs
│   └── tauri.conf.json     # Tauri-Konfiguration
└── package.json
```

## Entwicklung

### Code-Stil

- **TypeScript**: Strict Mode aktiviert
- **Formatting**: Prettier (falls konfiguriert)
- **Naming**: PascalCase für Komponenten, camelCase für Variablen

### Commits

Wir verwenden konventionelle Commit-Nachrichten:

```
feat: Neue Funktion hinzugefügt
fix: Bugfix für Video-Player
docs: README aktualisiert
style: Code-Formatierung
refactor: Code-Refactoring
chore: Build-Script aktualisiert
```

### Pull Requests

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/neue-funktion`)
3. Commite deine Änderungen
4. Pushe den Branch (`git push origin feature/neue-funktion`)
5. Erstelle einen Pull Request

## Features entwickeln

### Neues Feature hinzufügen

1. **Store erweitern** (`src/store/useStore.ts`)
   - State-Variablen hinzufügen
   - Actions implementieren

2. **UI-Komponente erstellen** (`src/operator/tabs/`)
   - Neue Tab-Komponente
   - Im OperatorApp registrieren

3. **Tauri-Command** (falls benötigt)
   - In `src-tauri/src/lib.rs` implementieren
   - In TypeScript mit `invoke()` aufrufen

### Beispiel: Neues Media-Format

```typescript
// src/store/useStore.ts
loadDocuments: async () => {
  const files = await openDialog({
    multiple: true,
    filters: [{ name: "Documents", extensions: ["pdf", "pptx"] }],
  });
  // ... Verarbeitung
}
```

## Fehler melden

### Bug Report

Öffne ein Issue mit folgenden Informationen:

- **Beschreibung**: Was ist das Problem?
- **Schritte zur Reproduktion**
- **Erwartetes Verhalten**
- **Screenshots** (falls hilfreich)
- **Systeminformationen**: OS, OpenStage-Version

### Feature Request

- **Beschreibung**: Was soll das Feature tun?
- **Use Case**: Warum ist es nützlich?
- **Alternativen**: Gibt es Workarounds?

## Architektur

### State Management

OpenStage verwendet [Zustand](https://zustand-demo.pmnd.rs/) für globales State-Management:

```typescript
import { useStore } from "../store/useStore";

function MyComponent() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
}
```

### Event-System

Kommunikation zwischen Operator und Output:

```typescript
// Event senden
import { sendToOutput } from "../lib/events";
await sendToOutput({ mode: "image", image: { src } });

// Event empfangen (OutputApp)
import { listen } from "@tauri-apps/api/event";
const unlisten = listen(OUTPUT_EVENT, (e) => { /* ... */ });
```

## Testing

### Manuelle Tests

- [ ] Alle Tabs funktionieren (Slides, Songs, Countdown, Video, Music, Display)
- [ ] Output-Fenster zeigt Inhalte korrekt
- [ ] Keyboard-Shortcuts funktionieren
- [ ] Multi-Monitor-Konfiguration
- [ ] Blackout-Funktion

### Build-Test

```bash
npm run build
npm run tauri build
``
## Lizenz

Durch deinen Beitrag stimmst du zu, dass dein Code unter der [GPL-3.0-Lizenz](LICENSE) veröffentlicht wird.

---

**Danke für deinen Beitrag zu OpenStage!** 🙌
