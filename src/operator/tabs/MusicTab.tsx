import { useState } from "react";
import { useStore } from "../../store/useStore";
import { resolveSpotifyClientId, setStoredSpotifyClientId } from "../../lib/spotify";
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
  const spotifyAuth = useStore((s) => s.spotifyAuth);
  
  const loadMusic = useStore((s) => s.loadMusic);
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
	  const connectSpotify = useStore((s) => s.connectSpotify);
	  const setError = useStore((s) => s.setError);
	  const importSpotifyPlaylist = useStore((s) => s.importSpotifyPlaylist);

	  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
	  const [newPlaylistName, setNewPlaylistName] = useState("");
	  const [showSpotifyModal, setShowSpotifyModal] = useState(false);
	  const [spotifyClientIdInput, setSpotifyClientIdInput] = useState(() =>
	    resolveSpotifyClientId(import.meta.env.VITE_SPOTIFY_CLIENT_ID)
	  );
	  const [spotifyPlaylistUri, setSpotifyPlaylistUri] = useState("");
	
	  const current = music[musicIndex];
	  const spotifyRedirectUri = `http://127.0.0.1:${Number(import.meta.env.VITE_SPOTIFY_AUTH_PORT) || 8080}/callback`;
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

	  async function handleConnectSpotify() {
	    const resolvedClientId = spotifyClientIdInput.trim() || resolveSpotifyClientId(import.meta.env.VITE_SPOTIFY_CLIENT_ID);
	    if (!resolvedClientId) {
	      setError("Spotify Client ID fehlt. Bitte in Spotify → Developer Dashboard eine App anlegen und die Client ID hier eintragen.");
	      setShowSpotifyModal(true);
	      return;
	    }
	    setStoredSpotifyClientId(resolvedClientId);
	    setError("Öffne Spotify Login im Browser…");
	    try {
	      await connectSpotify();
	    } catch (err) {
	      console.error(err);
	      setError(`Spotify Verbindung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
	    }
	  }

  async function handleImportSpotifyPlaylist() {
    if (!spotifyPlaylistUri.trim()) return;
    try {
      await importSpotifyPlaylist(spotifyPlaylistUri.trim());
      setSpotifyPlaylistUri("");
    } catch (err) {
      console.error("Failed to import playlist:", err);
      alert("Fehler beim Importieren der Playlist. Ist die URI korrekt?");
    }
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
                {p.source === "spotify" ? "🟢" : "📁"} {p.name} ({p.tracks.length})
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Spotify Button */}
          {spotifyAuth.isAuthenticated ? (
            <button
              onClick={() => setShowSpotifyModal(true)}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
	                  style={{
	                    background: "#1DB954",
	                    color: "white",
	                    opacity: (!spotifyClientIdInput.trim() && !resolveSpotifyClientId(import.meta.env.VITE_SPOTIFY_CLIENT_ID)) ? 0.6 : 1,
	                  }}
            >
              🟢 Spotify
            </button>
          ) : (
            <button
	                  onClick={handleConnectSpotify}
	                  disabled={!spotifyClientIdInput.trim() && !resolveSpotifyClientId(import.meta.env.VITE_SPOTIFY_CLIENT_ID)}
              className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1"
              style={{ background: "#1DB954", color: "white" }}
            >
              + Spotify
            </button>
          )}
          
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
            onClick={loadMusic}
            className="text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: "#f97316", color: "white" }}
          >
            + Hinzufügen
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
              <div className="w-12 h-12 rounded flex items-center justify-center text-xl" style={{ background: "#1a1a1a" }}>
                🎵
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{current.name}</div>
              {current.artist && (
                <div className="text-xs mt-0.5" style={{ color: "#888" }}>{current.artist}</div>
              )}
              <div className="text-xs mt-0.5" style={{ color: "#555" }}>
                {musicIndex + 1} / {music.length} {current.source === "spotify" ? "(Spotify)" : ""}
              </div>
            </div>
            
            {/* Add to Playlist Dropdown */}
            {playlists.length > 0 && (
              <div className="relative group">
                <button
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: "#1a1a1a", color: "#888" }}
                >
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
                        {p.source === "spotify" ? "🟢" : "📁"} {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-mono" style={{ color: "#666" }}>{formatTime(musicCurrentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, musicDuration || 0)}
              step={0.25}
              value={Math.min(musicCurrentTime, musicDuration || musicCurrentTime)}
              onChange={(e) => seekMusic(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[11px] font-mono" style={{ color: "#666" }}>{formatTime(musicDuration)}</span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-[11px]" style={{ color: "#555" }}>Vol</span>
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
            <p className="text-sm" style={{ color: "#555" }}>MP3, WAV, FLAC, AAC und mehr</p>
            <div className="flex gap-2">
              <button onClick={loadMusic} className="text-sm px-4 py-2 rounded" style={{ background: "#f97316", color: "white" }}>
                Musik laden
              </button>
              <button onClick={() => setShowCreatePlaylist(true)} className="text-sm px-4 py-2 rounded" style={{ background: "#252525", color: "#aaa" }}>
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
                onClick={() => { setMusicIndex(i); setMusicPlaying(true); }}
              >
                <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: isActive ? "#f97316" : "#444" }}>
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
                    <div className="text-xs truncate" style={{ color: "#666" }}>{track.artist}</div>
                  )}
                </div>
                
                {track.source === "spotify" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#1DB95420", color: "#1DB954" }}>
                    Spotify
                  </span>
                )}
                
                <button
                  onClick={(e) => { e.stopPropagation(); removeMusic(track.id); }}
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
                onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName(""); }}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ background: "#252525", color: "#aaa" }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spotify Modal */}
      {showSpotifyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg p-6 w-96 border border-[#333]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🟢</span>
              <h3 className="text-lg font-semibold text-white">Spotify</h3>
            </div>

            {spotifyAuth.isAuthenticated ? (
              <>
                <p className="text-sm text-gray-300 mb-4">
                  ✅ Mit Spotify verbunden. Importiere Playlists mit URI oder Link.
                </p>

                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Spotify Playlist URI/Link</label>
                  <input
                    type="text"
                    value={spotifyPlaylistUri}
                    onChange={(e) => setSpotifyPlaylistUri(e.target.value)}
                    placeholder="spotify:playlist:xxx oder https://..."
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] text-white border border-[#333] text-sm"
                  />
                </div>

                <button
                  onClick={handleImportSpotifyPlaylist}
                  className="w-full mb-3 px-4 py-2 rounded text-sm font-medium"
                  style={{ background: "#1DB954", color: "white" }}
                >
                  Playlist importieren
                </button>

                <button
                  onClick={() => { useStore.getState().disconnectSpotify(); setShowSpotifyModal(false); }}
                  className="w-full px-4 py-2 rounded text-sm font-medium"
                  style={{ background: "#252525", color: "#ef4444" }}
                >
                  Trennen
                </button>
              </>
	            ) : (
	              <>
	                <div className="mb-4">
	                  <label className="text-xs text-gray-400 block mb-1">Spotify Client ID</label>
	                  <input
	                    type="text"
	                    value={spotifyClientIdInput}
	                    onChange={(e) => setSpotifyClientIdInput(e.target.value)}
	                    placeholder="z.B. 0123456789abcdef0123456789abcdef"
	                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] text-white border border-[#333] text-sm"
	                  />
	                  <p className="text-[11px] text-gray-500 mt-2">
	                    Du findest die Client ID im Spotify Developer Dashboard (App → Settings).
	                  </p>
	                </div>

	                <div className="mb-4">
	                  <label className="text-xs text-gray-400 block mb-1">Redirect URI (im Spotify Dashboard eintragen)</label>
	                  <div className="flex gap-2">
	                    <input
	                      type="text"
	                      value={spotifyRedirectUri}
	                      readOnly
	                      className="flex-1 px-3 py-2 rounded bg-[#0a0a0a] text-gray-300 border border-[#333] text-sm"
	                    />
	                    <button
	                      onClick={() => navigator.clipboard?.writeText(spotifyRedirectUri).catch(() => {})}
	                      className="px-3 py-2 rounded text-xs font-medium"
	                      style={{ background: "#252525", color: "#aaa" }}
	                    >
	                      Kopieren
	                    </button>
	                  </div>
	                </div>

	                <p className="text-sm text-gray-300 mb-4">
	                  Verbinde dich mit Spotify, um deine Playlists zu importieren.
	                  <br /><br />
	                  <strong className="text-white">Ablauf:</strong>
                  <ol className="list-decimal list-inside mt-2 text-gray-400 text-xs">
                    <li>"Verbinden" klicken</li>
                    <li>In Spotify im Browser anmelden</li>
                    <li>Automatische Verbindung nach Login</li>
                  </ol>
                </p>

                <button
                  onClick={handleConnectSpotify}
                  className="w-full mb-3 px-4 py-2 rounded text-sm font-medium"
                  style={{ background: "#1DB954", color: "white" }}
                >
                  🟢 Mit Spotify verbinden
                </button>

                <button
                  onClick={() => setShowSpotifyModal(false)}
                  className="w-full px-4 py-2 rounded text-sm font-medium"
                  style={{ background: "#252525", color: "#aaa" }}
                >
                  Abbrechen
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
