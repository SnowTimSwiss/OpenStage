import { useEffect, useRef } from "react";
import { useStore } from "../../store/useStore";

export default function MusicTab() {
  const music = useStore((s) => s.music);
  const musicIndex = useStore((s) => s.musicIndex);
  const musicPlaying = useStore((s) => s.musicPlaying);
  const loadMusic = useStore((s) => s.loadMusic);
  const setMusicIndex = useStore((s) => s.setMusicIndex);
  const setMusicPlaying = useStore((s) => s.setMusicPlaying);
  const removeMusic = useStore((s) => s.removeMusic);

  const audioRef = useRef<HTMLAudioElement>(null);
  const current = music[musicIndex];

  useEffect(() => {
    if (!audioRef.current || !current) return;
    audioRef.current.src = current.src;
    if (musicPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [musicIndex, current]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (musicPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [musicPlaying]);

  function playNext() {
    const next = (musicIndex + 1) % music.length;
    setMusicIndex(next);
    setMusicPlaying(true);
  }

  function playPrev() {
    const prev = (musicIndex - 1 + music.length) % music.length;
    setMusicIndex(prev);
    setMusicPlaying(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Musik</h2>
        <button
          onClick={loadMusic}
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ background: "#f97316", color: "white" }}
        >
          + Hinzufügen
        </button>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={playNext}
        onPlay={() => setMusicPlaying(true)}
        onPause={() => setMusicPlaying(false)}
      />

      {/* Player */}
      {current && (
        <div className="px-4 py-4 border-b" style={{ borderColor: "#252525", background: "#0d0d0d" }}>
          <div className="text-center mb-4">
            <div className="text-2xl mb-2">🎵</div>
            <div className="text-sm font-semibold text-white truncate">{current.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "#555" }}>
              {musicIndex + 1} / {music.length}
            </div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={playPrev}
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
              onClick={playNext}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
              style={{ background: "#1a1a1a", color: "#888" }}
            >
              ⏭
            </button>
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
        {music.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl">🎧</span>
            <p className="text-white font-medium">Keine Musik geladen</p>
            <p className="text-sm" style={{ color: "#555" }}>MP3, WAV, FLAC, AAC und mehr</p>
            <button onClick={loadMusic} className="text-sm px-4 py-2 rounded" style={{ background: "#f97316", color: "white" }}>
              Musik laden
            </button>
          </div>
        ) : (
          music.map((track, i) => {
            const isActive = i === musicIndex;
            return (
              <div
                key={track.id}
                className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer"
                style={{
                  background: isActive ? "#f9731610" : "transparent",
                  border: isActive ? "1px solid #f9731430" : "1px solid transparent",
                }}
                onClick={() => { setMusicIndex(i); setMusicPlaying(true); }}
              >
                <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: isActive ? "#f97316" : "#444" }}>
                  {isActive && musicPlaying ? "♪" : i + 1}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color: isActive ? "#f97316" : "#ccc" }}>
                  {track.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMusic(track.id); }}
                  className="text-xs opacity-0 hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded"
                  style={{ color: "#ef4444" }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
