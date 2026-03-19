import { useState } from "react";
import { useStore } from "../../store/useStore";
import type { MusicItem, Playlist } from "../../types";

export default function MusicTab() {
  const music = useStore((s) => s.music);
  const musicIndex = useStore((s) => s.musicIndex);
  const musicPlaying = useStore((s) => s.musicPlaying);
  const musicCurrentTime = useStore((s) => s.musicCurrentTime);
  const musicDuration = useStore((s) => s.musicDuration);
  const musicVolume = useStore((s) => s.musicVolume);
  const playlists = useStore((s) => s.playlists);
  const activePlaylistId = useStore((s) => s.activePlaylistId);

  const loadMusic = useStore((s) => s.loadMusic);
  const loadMusicFromFolder = useStore((s) => s.loadMusicFromFolder);
  const resetAllMusic = useStore((s) => s.resetAllMusic);
  const setMusicIndex = useStore((s) => s.setMusicIndex);
  const setMusicPlaying = useStore((s) => s.setMusicPlaying);
  const playNextMusic = useStore((s) => s.playNextMusic);
  const playPrevMusic = useStore((s) => s.playPrevMusic);
  const seekMusic = useStore((s) => s.seekMusic);
  const setMusicVolume = useStore((s) => s.setMusicVolume);
  const removeMusic = useStore((s) => s.removeMusic);
  const reorderMusic = useStore((s) => s.reorderMusic);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const setActivePlaylist = useStore((s) => s.setActivePlaylist);
  const addTrackToPlaylist = useStore((s) => s.addTrackToPlaylist);
  const setError = useStore((s) => s.setError);

  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPlaylistSelect, setShowPlaylistSelect] = useState(false);
  const [pendingImportType, setPendingImportType] = useState<"files" | "folder" | null>(null);
  const [selectedPlaylistForImport, setSelectedPlaylistForImport] = useState<string | null>(null);
  const [showCreatePlaylistForImport, setShowCreatePlaylistForImport] = useState(false);
  const [newPlaylistNameForImport, setNewPlaylistNameForImport] = useState("");

  const current = music[musicIndex];
  const activePlaylist = activePlaylistId ? playlists.find((p) => p.id === activePlaylistId) : null;
  const dragIndex = useStore((s) => (s as any).dragIndex ?? -1);
  const setDragIndex = (i: number) => (useStore as any).setState({ dragIndex: i });

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, _index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderMusic(fromIndex, toIndex);
    }
    setDragIndex(-1);
  }

  function handleDragEnd() {
    setDragIndex(-1);
  }

  function formatTime(s: number) {
    if (!Number.isFinite(s) || s < 0) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  }

  function handleSelectPlaylist(playlistId: string | null) {
    setActivePlaylist(playlistId);
  }

  function handleImportWithPlaylist(type: "files" | "folder") {
    if (activePlaylistId) {
      if (type === "files") {
        loadMusic(activePlaylistId);
      } else {
        loadMusicFromFolder(activePlaylistId);
      }
      return;
    }

    setPendingImportType(type);
    setSelectedPlaylistForImport(null);
    setShowPlaylistSelect(true);
  }

  function handleConfirmPlaylistImport() {
    if (!pendingImportType) return;

    if (showCreatePlaylistForImport && newPlaylistNameForImport.trim()) {
      // Create new playlist and import
      const newPlaylist = createPlaylist(newPlaylistNameForImport.trim());
      if (pendingImportType === "files") {
        loadMusic(newPlaylist.id);
      } else {
        loadMusicFromFolder(newPlaylist.id);
      }
      setNewPlaylistNameForImport("");
      setShowCreatePlaylistForImport(false);
    } else {
      // Import to selected playlist or no playlist
      if (pendingImportType === "files") {
        loadMusic(selectedPlaylistForImport);
      } else {
        loadMusicFromFolder(selectedPlaylistForImport);
      }
    }

    setShowPlaylistSelect(false);
    setPendingImportType(null);
    setSelectedPlaylistForImport(null);
  }

  function handleCreatePlaylistForImport() {
    setShowCreatePlaylistForImport(true);
    setSelectedPlaylistForImport(null);
  }

  function handleAddToPlaylist(playlist: Playlist, track: MusicItem) {
    addTrackToPlaylist(playlist.id, track);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Playlist Selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Musik</h2>

          {/* Playlist Selector */}
          <select
            value={activePlaylistId || ""}
            onChange={(e) => handleSelectPlaylist(e.target.value || null)}
            className="text-xs px-2 py-1 rounded bg-[#1a1a1a] text-gray-300 border border-[#333]"
          >
            <option value="">Alle Tracks</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                📁 {p.name} ({p.tracks.length})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Playlist Button */}
          <button
            onClick={() => setShowCreatePlaylist(true)}
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: "#252525", color: "#aaa" }}
          >
            + Playlist
          </button>

          {/* Add Music Button */}
          <button
            onClick={() => handleImportWithPlaylist("files")}
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: "#f97316", color: "white" }}
            title={activePlaylist ? `Direkt in "${activePlaylist.name}" importieren` : "Importziel auswählen"}
          >
            {activePlaylist ? "+ Dateien in aktive Playlist" : "+ Dateien"}
          </button>

          {/* Add Folder Button */}
          <button
            onClick={() => handleImportWithPlaylist("folder")}
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: "#f97316", color: "white" }}
            title={activePlaylist ? `Direkt in "${activePlaylist.name}" importieren` : "Importziel auswählen"}
          >
            {activePlaylist ? "+ Ordner in aktive Playlist" : "+ Ordner"}
          </button>

          {/* Reset All Button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: "#252525", color: "#ef4444" }}
            title="Alle Songs und Playlists zurücksetzen"
          >
            🗑 Reset
          </button>
        </div>
      </div>

      {/* Player */}
      {current && (
        <div className="px-4 py-4 border-b" style={{ borderColor: "#252525", background: "#0d0d0d" }}>
          <div className="flex items-center gap-3 mb-4">
            {current.albumArt ? (
              <img src={current.albumArt} alt="" className="w-12 h-12 rounded object-cover" />
            ) : (
              <div
                className="w-12 h-12 rounded flex items-center justify-center text-xl"
                style={{ background: "#1a1a1a" }}
              >
                🎵
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{current.name}</div>
              {current.artist && (
                <div className="text-xs mt-0.5" style={{ color: "#888" }}>
                  {current.artist}
                </div>
              )}
              <div className="text-xs mt-0.5" style={{ color: "#555" }}>
                {musicIndex + 1} / {music.length}
              </div>
            </div>

            {/* Add to Playlist Dropdown */}
            {playlists.length > 0 && (
              <div className="relative group">
                <button className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", color: "#888" }}>
                  ⋯
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-[#1a1a1a] border border-[#333] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <div className="py-1">
                    <div className="px-3 py-2 text-xs font-medium text-gray-400 border-b border-[#333]">
                      Zu Playlist hinzufügen
                    </div>
                    {playlists.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleAddToPlaylist(p, current)}
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#252525] transition-colors"
                      >
                        📁 {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-mono" style={{ color: "#666" }}>
              {formatTime(musicCurrentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, musicDuration || 0)}
              step={0.25}
              value={Math.min(musicCurrentTime, musicDuration || musicCurrentTime)}
              onChange={(e) => seekMusic(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[11px] font-mono" style={{ color: "#666" }}>
              {formatTime(musicDuration)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-[11px]" style={{ color: "#555" }}>
              Vol
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="w-40"
            />
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={playPrevMusic}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
              style={{ background: "#1a1a1a", color: "#888" }}
            >
              ⏮
            </button>
            <button
              onClick={() => setMusicPlaying(!musicPlaying)}
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all"
              style={{
                background: musicPlaying ? "#f97316" : "#1f1f1f",
                color: musicPlaying ? "white" : "#888",
                boxShadow: musicPlaying ? "0 0 20px #f9731650" : "none",
              }}
            >
              {musicPlaying ? "⏸" : "▶"}
            </button>
            <button
              onClick={playNextMusic}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
              style={{ background: "#1a1a1a", color: "#888" }}
            >
              ⏭
            </button>
          </div>
        </div>
      )}

      {/* Queue / Tracks */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
        {music.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl">🎧</span>
            <p className="text-white font-medium">Keine Musik geladen</p>
            <p className="text-sm" style={{ color: "#555" }}>
              MP3, WAV, FLAC, AAC und mehr
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleImportWithPlaylist("files")}
                className="text-sm px-4 py-2 rounded"
                style={{ background: "#f97316", color: "white" }}
              >
                Musik laden
              </button>
              <button
                onClick={() => setShowCreatePlaylist(true)}
                className="text-sm px-4 py-2 rounded"
                style={{ background: "#252525", color: "#aaa" }}
              >
                Playlist erstellen
              </button>
            </div>
          </div>
        ) : (
          music.map((track, i) => {
            const isActive = i === musicIndex;
            return (
              <div
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer group"
                style={{
                  background: isActive ? "#f9731610" : "transparent",
                  border: isActive ? "1px solid #f9731430" : "1px solid transparent",
                  opacity: dragIndex === i ? 0.5 : 1,
                }}
                onClick={() => {
                  setMusicIndex(i);
                  setMusicPlaying(true);
                }}
              >
                <span
                  className="text-xs font-mono w-5 text-right shrink-0"
                  style={{ color: isActive ? "#f97316" : "#444" }}
                >
                  {isActive && musicPlaying ? "♪" : i + 1}
                </span>

                {track.albumArt ? (
                  <img src={track.albumArt} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <span className="text-lg w-8 h-8 flex items-center justify-center">🎵</span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: isActive ? "#f97316" : "#ccc" }}>
                    {track.name}
                  </div>
                  {track.artist && (
                    <div className="text-xs truncate" style={{ color: "#666" }}>
                      {track.artist}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMusic(track.id);
                  }}
                  className="text-xs opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded"
                  style={{ color: "#ef4444" }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg p-6 w-80 border border-[#333]">
            <h3 className="text-lg font-semibold text-white mb-4">Playlist erstellen</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist-Name"
              className="w-full px-3 py-2 rounded bg-[#0a0a0a] text-white border border-[#333] text-sm mb-4"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreatePlaylist}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#f97316", color: "white" }}
              >
                Erstellen
              </button>
              <button
                onClick={() => {
                  setShowCreatePlaylist(false);
                  setNewPlaylistName("");
                }}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#252525", color: "#aaa" }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg p-6 w-96 border border-[#333]">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🗑</span>
              <h3 className="text-lg font-semibold text-white">Alles zurücksetzen</h3>
            </div>

            <p className="text-sm text-gray-300 mb-2">Bist du sicher? Dies wird löschen:</p>
            <ul className="text-sm text-gray-400 mb-6 list-disc list-inside space-y-1">
              <li>Alle geladenen Songs</li>
              <li>Alle Playlists</li>
              <li>Die aktuelle Musik-Wiedergabe</li>
            </ul>

            <p className="text-xs text-red-400 mb-4">⚠️ Diese Aktion kann nicht rückgängig gemacht werden.</p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetAllMusic();
                  setShowResetConfirm(false);
                }}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#ef4444", color: "white" }}
              >
                Ja, alles löschen
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#252525", color: "#aaa" }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Select Modal for Import */}
      {showPlaylistSelect && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg p-6 w-96 border border-[#333]">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📁</span>
              <h3 className="text-lg font-semibold text-white">In Playlist importieren</h3>
            </div>

            <p className="text-sm text-gray-300 mb-4">Wähle eine Playlist für den Import oder erstelle eine neue:</p>

            {/* Create New Playlist Option */}
            <div className="mb-4">
              <button
                onClick={handleCreatePlaylistForImport}
                className="w-full px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
                style={{
                  background: showCreatePlaylistForImport ? "#f97316" : "#252525",
                  color: showCreatePlaylistForImport ? "white" : "#aaa",
                }}
              >
                + Neue Playlist erstellen
              </button>

              {showCreatePlaylistForImport && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={newPlaylistNameForImport}
                    onChange={(e) => setNewPlaylistNameForImport(e.target.value)}
                    placeholder="Playlist-Name"
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] text-white border border-[#333] text-sm"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Existing Playlists */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Oder wähle eine bestehende Playlist:</label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                <button
                  onClick={() => {
                    setSelectedPlaylistForImport(null);
                    setShowCreatePlaylistForImport(false);
                    setNewPlaylistNameForImport("");
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                    selectedPlaylistForImport === null && !showCreatePlaylistForImport
                      ? "bg-[#f9731620] text-[#f97316] border border-[#f9731640]"
                      : "text-gray-300 hover:bg-[#252525]"
                  }`}
                >
                  📂 Keine Playlist (nur zur Queue hinzufügen)
                </button>
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPlaylistForImport(p.id);
                      setShowCreatePlaylistForImport(false);
                      setNewPlaylistNameForImport("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                      selectedPlaylistForImport === p.id
                        ? "bg-[#f9731620] text-[#f97316] border border-[#f9731640]"
                        : "text-gray-300 hover:bg-[#252525]"
                    }`}
                  >
                    📁 {p.name} ({p.tracks.length})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConfirmPlaylistImport}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#f97316", color: "white" }}
              >
                Importieren
              </button>
              <button
                onClick={() => {
                  setShowPlaylistSelect(false);
                  setPendingImportType(null);
                  setSelectedPlaylistForImport(null);
                  setShowCreatePlaylistForImport(false);
                  setNewPlaylistNameForImport("");
                }}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#252525", color: "#aaa" }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
