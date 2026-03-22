import { useState, useMemo } from "react";
import { useStore } from "../../store/useStore";
import type { Song, SongSlide, RepositorySong } from "../../types";
import { save as saveFile, open as openFile } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { convertFileSrc } from "@tauri-apps/api/core";

type View = "list" | "editor" | "live";
const SONGS_REPOSITORY_URL = "https://github.com/SnowTimSwiss/OpenStage-songs";

type MessageDialogState = {
  title: string;
  message: string;
  tone?: "neutral" | "success" | "danger";
} | null;

export default function SongsTab() {
  const songs = useStore((s) => s.songs);
  const activeSongId = useStore((s) => s.activeSongId);
  const activeSongSlide = useStore((s) => s.activeSongSlide);
  const showAllSongSlides = useStore((s) => s.showAllSongSlides);
  const songBackgroundImage = useStore((s) => s.songBackgroundImage);
  const addSong = useStore((s) => s.addSong);
  const updateSong = useStore((s) => s.updateSong);
  const removeSong = useStore((s) => s.removeSong);
  const selectSong = useStore((s) => s.selectSong);
  const goLiveSongSlide = useStore((s) => s.goLiveSongSlide);
  const nextSongSlide = useStore((s) => s.nextSongSlide);
  const prevSongSlide = useStore((s) => s.prevSongSlide);
  const setSongBackgroundImage = useStore((s) => s.setSongBackgroundImage);
  const setShowAllSongSlides = useStore((s) => s.setShowAllSongSlides);

  // GitHub Repository functions
  const fetchRepositorySongs = useStore((s) => s.fetchRepositorySongs);
  const downloadRepositorySong = useStore((s) => s.downloadRepositorySong);

  const [view, setView] = useState<View>("list");
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [repositorySongs, setRepositorySongs] = useState<RepositorySong[]>([]);
  const [isLoadingRepo, setIsLoadingRepo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [messageDialog, setMessageDialog] = useState<MessageDialogState>(null);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songs;
    const query = searchQuery.toLowerCase();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        (song.artist && song.artist.toLowerCase().includes(query)) ||
        song.slides.some((slide) => slide.text.toLowerCase().includes(query) || (slide.label && slide.label.toLowerCase().includes(query)))
    );
  }, [songs, searchQuery]);

  const activeSong = songs.find((s) => s.id === activeSongId) ?? null;

  function showMessage(title: string, message: string, tone: "neutral" | "success" | "danger" = "neutral") {
    setMessageDialog({ title, message, tone });
  }

  function startNew() {
    setEditingSong({
      id: "__new__",
      title: "",
      artist: "",
      slides: [{ id: crypto.randomUUID(), text: "", label: "Strophe 1" }],
    });
    setView("editor");
  }

  function startEdit(song: Song) {
    setEditingSong({ ...song, slides: song.slides.map((s) => ({ ...s })) });
    setView("editor");
  }

  function saveSong() {
    if (!editingSong) return;
    if (editingSong.id === "__new__") {
      const { id: _id, ...rest } = editingSong;
      addSong(rest);
    } else {
      const { id, ...rest } = editingSong;
      updateSong(id, rest);
    }
    setView("list");
    setEditingSong(null);
  }

  async function exportSong(song: Song) {
    const filePath = await saveFile({
      title: "Song exportieren",
      defaultPath: `${song.title.replace(/[^a-z0-9]/gi, "_")}.json`,
      filters: [{ name: "Song JSON", extensions: ["json"] }],
    });
    if (!filePath) return;

    const songData = JSON.stringify(song, null, 2);
    await writeFile(filePath, new TextEncoder().encode(songData));
  }

  async function importSong() {
    const filePath = await openFile({
      title: "Song importieren",
      filters: [{ name: "Song JSON", extensions: ["json"] }],
    });
    if (!filePath) return;

    try {
      const content = await readFile(filePath);
      const songData = new TextDecoder().decode(content);
      const song: Omit<Song, "id"> = JSON.parse(songData);

      // Validate basic structure
      if (!song.title || !Array.isArray(song.slides)) {
        throw new Error("Ungültiges Song-Format");
      }

      addSong(song);
    } catch (err) {
      console.error("Failed to import song:", err);
      showMessage("Import fehlgeschlagen", "Fehler beim Importieren: Ungueltiges Song-Format", "danger");
    }
  }

  async function loadRepositorySongs() {
    setIsLoadingRepo(true);
    setRepoError(null);
    try {
      const songs = await fetchRepositorySongs();
      setRepositorySongs(songs);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : "Repository konnte nicht geladen werden");
    } finally {
      setIsLoadingRepo(false);
    }
  }

  async function handleDownloadSong(repoSong: RepositorySong) {
    try {
      await downloadRepositorySong(repoSong);
      // Refresh repository list to show updated status
      await loadRepositorySongs();
    } catch (err) {
      showMessage("Download fehlgeschlagen", err instanceof Error ? err.message : "Download fehlgeschlagen", "danger");
    }
  }

  async function openRepositoryExternally() {
    try {
      await openUrl(SONGS_REPOSITORY_URL);
    } catch (err) {
      console.error("Failed to open GitHub repository:", err);
      showMessage("GitHub konnte nicht geöffnet werden", "Die GitHub-Seite konnte nicht automatisch geöffnet werden.", "danger");
    }
  }

  function openRepositoryModal() {
    setIsRepoModalOpen(true);
    void loadRepositorySongs();
  }

  async function handleSetBackgroundImage() {
    try {
      const files = await openFile({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!files) return;
      const path = files as string;
      const src = convertFileSrc(path);
      setSongBackgroundImage(src);
    } catch (err) {
      console.error("Failed to set background image:", err);
      showMessage("Fehler", "Hintergrundbild konnte nicht geladen werden", "danger");
    }
  }

  function handleClearBackgroundImage() {
    setSongBackgroundImage(null);
  }

  // ── EDITOR ────────────────────────────────────────────────────────────────
  if (view === "editor" && editingSong) {
    return <SongEditor
      song={editingSong}
      onChange={setEditingSong}
      onSave={saveSong}
      onCancel={() => { setView("list"); setEditingSong(null); }}
    />;
  }

  // ── SONG LIVE VIEW ────────────────────────────────────────────────────────
  if (view === "live" && activeSong) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
          <button
            onClick={() => setView("list")}
            className="text-xs px-2 py-1 rounded"
            style={{ color: "#888", background: "#1a1a1a" }}
          >
            ← Zurück
          </button>
          <h2 className="text-sm font-semibold text-white flex-1">{activeSong.title}</h2>
          
          {/* Toggle für ganzes Lied */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllSongSlides}
              onChange={(e) => {
                setShowAllSongSlides(e.target.checked);
                // Wenn umgeschaltet wird, aktuelle Folie neu laden
                if (activeSongId) {
                  goLiveSongSlide(activeSongId, activeSongSlide);
                }
              }}
              className="w-4 h-4 rounded"
              style={{ accentColor: "#f97316" }}
            />
            <span className="text-xs text-gray-300">Ganzes Lied</span>
          </label>
          
          <span className="text-xs" style={{ color: "#555" }}>
            {activeSongSlide + 1} / {activeSong.slides.length}
          </span>
        </div>

        {/* Slide grid */}
        {showAllSongSlides ? (
          /* Vorschau des ganzen Liedes - 2 Spalten wie im Output */
          <div className="flex-1 overflow-y-auto p-4">
            <div className="rounded-lg p-6" style={{ background: "#141414", border: "1px solid #f9731640" }}>
              <div className="text-xs font-medium mb-4 text-center" style={{ color: "#f97316" }}>
                📄 Vorschau - Ganzes Lied
              </div>
              <div
                className="text-white leading-snug whitespace-pre-line"
                style={{
                  columnCount: 2,
                  columnGap: "2rem",
                  textAlign: "center",
                  fontSize: "clamp(0.9rem, 2vw, 1.5rem)",
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 300,
                  letterSpacing: "0.01em",
                }}
              >
                {activeSong.slides.map((slide, i) => (
                  <span key={slide.id}>
                    {slide.text}
                    {i < activeSong.slides.length - 1 && "\n\n"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Einzelne Folien */
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
            {activeSong.slides.map((slide, i) => {
              const isActive = i === activeSongSlide && activeSongId === activeSong.id;
              return (
                <button
                  key={slide.id}
                  onClick={() => goLiveSongSlide(activeSong.id, i)}
                  className="text-left rounded-lg p-3 transition-all"
                  style={{
                    background: isActive ? "#f9731615" : "#141414",
                    border: isActive ? "1px solid #f97316" : "1px solid #222",
                    color: isActive ? "#f97316" : "#ccc",
                  }}
                >
                  {slide.label && (
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: isActive ? "#f97316aa" : "#444" }}>
                      {slide.label}
                    </div>
                  )}
                  <div className="text-xs leading-relaxed whitespace-pre-line">{slide.text || <span style={{ color: "#444" }}>(leer)</span>}</div>
                  {slide.notes && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: "#222" }}>
                      <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#555" }}>
                        📝 Notizen
                      </div>
                      <div className="text-[10px] leading-relaxed" style={{ color: "#666" }}>{slide.notes}</div>
                    </div>
                  )}
                  {isActive && (
                    <div className="mt-2 text-[10px] font-bold" style={{ color: "#f97316" }}>● LIVE</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Arrow controls - nur im Einzel Folien-Modus */}
        {!showAllSongSlides && (
          <div className="flex gap-2 p-3 border-t" style={{ borderColor: "#252525" }}>
            <button
              onClick={prevSongSlide}
              className="flex-1 py-2 rounded font-bold text-sm"
              style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}
            >
              ◀ Zurück
            </button>
            <button
              onClick={nextSongSlide}
              className="flex-1 py-2 rounded font-bold text-sm"
              style={{ background: "#f97316", color: "white" }}
            >
              Weiter ▶
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── SONG LIST ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-3 px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Lieder</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSetBackgroundImage}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: songBackgroundImage ? "#22c55e20" : "#1f1f1f", color: songBackgroundImage ? "#22c55e" : "#888", border: "1px solid #333" }}
              title="Standard-Hintergrundbild für Lieder auswählen"
            >
              {songBackgroundImage ? "✓ Hintergrund" : "🖼 Hintergrund"}
            </button>
            {songBackgroundImage && (
              <button
                onClick={handleClearBackgroundImage}
                className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: "#1f1f1f", color: "#ef4444", border: "1px solid #333" }}
                title="Hintergrundbild entfernen"
              >
                ✕ Entfernen
              </button>
            )}
            <button
              onClick={openRepositoryModal}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "#1f1f1f", color: "#22c55e", border: "1px solid #333" }}
              title="Songs aus dem GitHub Repository laden"
            >
              🌐 Repository
            </button>
            <button
              onClick={importSong}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "#1f1f1f", color: "#7c3aed", border: "1px solid #333" }}
              title="Song aus JSON-Datei importieren"
            >
              📥 Import
            </button>
            <button
              onClick={startNew}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "#f97316", color: "white" }}
            >
              + Neues Lied
            </button>
          </div>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="Suche (Titel, Artist, Text)..."
          className="text-sm px-3 py-2 rounded outline-none"
          style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filteredSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl">🎵</span>
            {songs.length === 0 ? (
              <>
                <p className="text-white font-medium">Keine Lieder</p>
                <p className="text-sm" style={{ color: "#555" }}>Füge dein erstes Lied hinzu</p>
                <button onClick={startNew} className="text-sm px-4 py-2 rounded" style={{ background: "#f97316", color: "white" }}>
                  Lied erstellen
                </button>
              </>
            ) : (
              <>
                <p className="text-white font-medium">Keine Treffer</p>
                <p className="text-sm" style={{ color: "#555" }}>Versuche eine andere Suche</p>
              </>
            )}
          </div>
        ) : (
          filteredSongs.map((song) => {
            const isSelected = song.id === activeSongId;
            return (
              <div
                key={song.id}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: isSelected ? "#f9731610" : "#141414",
                  border: isSelected ? "1px solid #f9731640" : "1px solid #1e1e1e",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{song.title}</div>
                  {song.artist && <div className="text-xs truncate" style={{ color: "#555" }}>{song.artist}</div>}
                  <div className="text-xs mt-0.5" style={{ color: "#444" }}>
                    {song.slides.length} Folie{song.slides.length !== 1 ? "n" : ""}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => exportSong(song)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "#1f1f1f", color: "#7c3aed" }}
                    title="Exportieren"
                  >
                    📤
                  </button>
                  <button
                    onClick={() => startEdit(song)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "#222", color: "#777" }}
                    title="Bearbeiten"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => { selectSong(song.id); setView("live"); }}
                    className="text-xs px-3 py-1 rounded font-medium"
                    style={{ background: isSelected ? "#f97316" : "#1f1f1f", color: isSelected ? "white" : "#888" }}
                  >
                    {isSelected ? "● Live" : "Auswählen"}
                  </button>
                  <button
                    onClick={() => removeSong(song.id)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "#2a0a0a", color: "#ef4444" }}
                    title="Löschen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {messageDialog && (
        <MessageDialog
          title={messageDialog.title}
          message={messageDialog.message}
          tone={messageDialog.tone}
          onClose={() => setMessageDialog(null)}
        />
      )}

      {isRepoModalOpen && (
        <RepositoryModal
          isOpen={isRepoModalOpen}
          onClose={() => setIsRepoModalOpen(false)}
          repositorySongs={repositorySongs}
          isLoading={isLoadingRepo}
          error={repoError}
          onRefresh={loadRepositorySongs}
          onDownload={handleDownloadSong}
          onOpenRepository={openRepositoryExternally}
        />
      )}
    </div>
  );
}

// ── Song Editor Component ─────────────────────────────────────────────────────
function SongEditor({ song, onChange, onSave, onCancel }: {
  song: Song;
  onChange: (s: Song) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function updateSlide(id: string, field: keyof SongSlide, value: string) {
    onChange({
      ...song,
      slides: song.slides.map((s) => s.id === id ? { ...s, [field]: value } : s),
    });
  }

  function addSlide() {
    onChange({
      ...song,
      slides: [...song.slides, { id: crypto.randomUUID(), text: "", label: "" }],
    });
  }

  function removeSlide(id: string) {
    if (song.slides.length <= 1) return;
    onChange({ ...song, slides: song.slides.filter((s) => s.id !== id) });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: "#252525" }}>
        <button onClick={onCancel} className="text-xs px-2 py-1 rounded" style={{ color: "#888", background: "#1a1a1a" }}>
          ← Abbrechen
        </button>
        <h2 className="text-sm font-semibold text-white flex-1">
          {song.id === "__new__" ? "Neues Lied" : "Lied bearbeiten"}
        </h2>
        <button onClick={onSave} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: "#f97316", color: "white" }}>
          Speichern
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Title / Artist */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label>Titel *</Label>
            <Input value={song.title} onChange={(v) => onChange({ ...song, title: v })} placeholder="Liedtitel" />
          </div>
          <div className="flex-1">
            <Label>Artist (optional)</Label>
            <Input value={song.artist ?? ""} onChange={(v) => onChange({ ...song, artist: v })} placeholder="Interpret" />
          </div>
        </div>

        {/* Slides */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Folien</Label>
            <button onClick={addSlide} className="text-xs px-2 py-1 rounded" style={{ background: "#1f1f1f", color: "#f97316" }}>
              + Folie
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {song.slides.map((slide, i) => (
              <div key={slide.id} className="rounded-lg p-3" style={{ background: "#111", border: "1px solid #222" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono" style={{ color: "#444" }}>{i + 1}</span>
                  <input
                    className="flex-1 text-xs px-2 py-1 rounded outline-none"
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }}
                    placeholder="Bezeichnung (z.B. Strophe 1, Refrain)"
                    value={slide.label ?? ""}
                    onChange={(e) => updateSlide(slide.id, "label", e.target.value)}
                  />
                  {song.slides.length > 1 && (
                    <button onClick={() => removeSlide(slide.id)} className="text-xs" style={{ color: "#ef4444" }}>✕</button>
                  )}
                </div>
                <textarea
                  className="w-full text-sm rounded p-2 outline-none resize-none leading-relaxed"
                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#ddd", minHeight: "80px" }}
                  placeholder="Liedtext dieser Folie..."
                  value={slide.text}
                  onChange={(e) => updateSlide(slide.id, "text", e.target.value)}
                  rows={3}
                />
                {/* Notes (operator only) */}
                <div className="mt-2 pt-2 border-t" style={{ borderColor: "#222" }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#444" }}>
                    📝 Notizen (nur Operator)
                  </div>
                  <textarea
                    className="w-full text-xs rounded p-2 outline-none resize-none"
                    style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", color: "#888", minHeight: "50px" }}
                    placeholder="Private Notizen für diese Folie..."
                    value={slide.notes ?? ""}
                    onChange={(e) => updateSlide(slide.id, "notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium mb-1.5" style={{ color: "#666" }}>{children}</div>;
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full text-sm px-3 py-2 rounded outline-none"
      style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function MessageDialog({
  title,
  message,
  tone = "neutral",
  onClose,
}: {
  title: string;
  message: string;
  tone?: "neutral" | "success" | "danger";
  onClose: () => void;
}) {
  const accent = tone === "success" ? "#22c55e" : tone === "danger" ? "#ef4444" : "#f97316";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-[420px] rounded-xl overflow-hidden"
        style={{ background: "#1a1a1a", border: `1px solid ${accent}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "#333" }}>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <div className="p-4">
          <p className="text-sm whitespace-pre-line" style={{ color: "#ccc" }}>{message}</p>
        </div>
        <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: "#333" }}>
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded font-medium"
            style={{ background: accent, color: tone === "success" ? "#08130a" : "white" }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

interface RepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositorySongs: RepositorySong[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDownload: (song: RepositorySong) => void;
  onOpenRepository: () => void;
}

function RepositoryModal({
  isOpen,
  onClose,
  repositorySongs,
  isLoading,
  error,
  onRefresh,
  onDownload,
  onOpenRepository,
}: RepositoryModalProps) {
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const filteredRepositorySongs = useMemo(() => {
    const query = repoSearchQuery.trim().toLowerCase();
    if (!query) return repositorySongs;
    return repositorySongs.filter((song) => song.name.toLowerCase().includes(query));
  }, [repoSearchQuery, repositorySongs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-[600px] max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: "#1a1a1a", border: "1px solid #333" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#333" }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🌐</span>
            <h3 className="text-sm font-semibold text-white">OpenStage Songs Repository</h3>
          </div>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded hover:bg-[#333]" style={{ color: "#888" }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Songs List */}
          <div className="mb-4 p-3 rounded-lg" style={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium" style={{ color: "#ddd" }}>
                Online-Songs suchen & herunterladen
              </div>
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="text-xs px-2 py-1 rounded"
                style={{ background: "#1f1f1f", color: "#888", border: "1px solid #333" }}
              >
                {isLoading ? "Lädt..." : "Aktualisieren"}
              </button>
            </div>

            <input
              type="text"
              value={repoSearchQuery}
              onChange={(e) => setRepoSearchQuery(e.target.value)}
              placeholder="Online-Songs im Repository suchen..."
              className="w-full text-xs px-3 py-2 rounded outline-none mb-3"
              style={{ background: "#141414", border: "1px solid #333", color: "#ddd" }}
            />

            {error && (
              <div className="p-3 rounded-lg mb-3" style={{ background: "#2a0a0a", border: "1px solid #ef4444" }}>
                <div className="text-xs" style={{ color: "#ef4444" }}>{error}</div>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-xs" style={{ color: "#666" }}>Lade Repository...</div>
              </div>
            ) : filteredRepositorySongs.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-xs" style={{ color: "#666" }}>
                  {repositorySongs.length === 0 ? "Keine Songs im Repository gefunden" : "Keine Songs für diese Suche gefunden"}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredRepositorySongs.map((repoSong) => (
                  <div
                    key={repoSong.path}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: "#141414", border: "1px solid #1e1e1e" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#ddd" }}>
                        {repoSong.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "#555" }}>
                        {repoSong.isLocal ? (
                          <span style={{ color: "#22c55e" }}>✓ Lokal verfügbar</span>
                        ) : (
                          "Nicht heruntergeladen"
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDownload(repoSong)}
                      disabled={repoSong.isLocal}
                      className="text-xs px-3 py-1.5 rounded font-medium"
                      style={{
                        background: repoSong.isLocal ? "#1f1f1f" : "#f97316",
                        color: repoSong.isLocal ? "#555" : "white",
                        border: "1px solid #333",
                      }}
                    >
                      {repoSong.isLocal ? "✓ Hinzugefügt" : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4 p-3 rounded-lg" style={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <div className="text-xs font-medium" style={{ color: "#ddd" }}>
                  Repository auf GitHub
                </div>
                <div className="text-[11px] mt-1" style={{ color: "#666" }}>
                  Hier kannst du das Song-Repository direkt im Browser öffnen, wenn du die Sammlung ansehen oder verwalten möchtest.
                </div>
              </div>
              <button
                onClick={onOpenRepository}
                className="shrink-0 text-xs px-3 py-1.5 rounded"
                style={{ background: "#1f1f1f", color: "#22c55e", border: "1px solid #333" }}
              >
                GitHub öffnen
              </button>
            </div>

            <p className="text-[10px] mt-3" style={{ color: "#555" }}>
              Suche und Download bleiben hier im Vordergrund. Der GitHub-Link ist nur ein zusätzlicher Direktzugriff auf das Repository.
            </p>
          </div>

          {/* Info Box */}
          <div className="mb-4 p-3 rounded-lg" style={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}>
            <div className="text-xs font-medium mb-1" style={{ color: "#ddd" }}>
              📖 OpenStage Songs Repository
            </div>
            <p className="text-[11px]" style={{ color: "#666" }}>
              Lade kostenlose Songs aus dem Community-Repository herunter. Alle Songs sind unter CC0-1.0 lizenziert
              und können frei verwendet werden.
            </p>
            <button
              onClick={onOpenRepository}
              className="text-[11px] mt-2 inline-block"
              style={{ color: "#f97316" }}
            >
              Repository auf GitHub ansehen →
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "#333" }}>
          <div className="text-[10px]" style={{ color: "#555" }}>
            📄 Lizenz: CC0-1.0 (Public Domain)
          </div>
          <button
            onClick={onClose}
            className="text-xs px-4 py-1.5 rounded"
            style={{ background: "#1f1f1f", color: "#888", border: "1px solid #333" }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
