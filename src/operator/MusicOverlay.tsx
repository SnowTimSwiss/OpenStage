import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function MusicOverlay() {
  const music = useStore((s) => s.music);
  const musicIndex = useStore((s) => s.musicIndex);
  const musicPlaying = useStore((s) => s.musicPlaying);
  const musicCurrentTime = useStore((s) => s.musicCurrentTime);
  const musicDuration = useStore((s) => s.musicDuration);
  const musicVolume = useStore((s) => s.musicVolume);
  const setMusicPlaying = useStore((s) => s.setMusicPlaying);
  const playNextMusic = useStore((s) => s.playNextMusic);
  const playPrevMusic = useStore((s) => s.playPrevMusic);
  const seekMusic = useStore((s) => s.seekMusic);
  const setMusicVolume = useStore((s) => s.setMusicVolume);

  const [expanded, setExpanded] = useState(false);

  const current = music[musicIndex];
  const duration = musicDuration || 0;
  const currentTime = Math.min(musicCurrentTime, duration || musicCurrentTime);
  const progress = duration > 0 ? currentTime / duration : 0;

  const title = useMemo(() => {
    if (!current) return "";
    return `${current.name} (${musicIndex + 1}/${music.length})`;
  }, [current, musicIndex, music.length]);

  if (!current) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className="rounded-xl border shadow-2xl overflow-hidden"
        style={{
          width: expanded ? 360 : 280,
          background: "#0b0b0be6",
          borderColor: "#222",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="px-3 py-2 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest" style={{ color: "#555" }}>
              Musik
            </div>
            <div className="text-sm font-medium truncate" style={{ color: "#ddd" }} title={title}>
              {current.name}
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs px-2 py-1 rounded"
            style={{ background: "#141414", color: "#888", border: "1px solid #222" }}
            title={expanded ? "Einklappen" : "Ausklappen"}
          >
            {expanded ? "–" : "+"}
          </button>
        </div>

        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={playPrevMusic}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#141414", color: "#aaa", border: "1px solid #222" }}
              title="Vorheriger Track"
            >
              ⏮
            </button>
            <button
              onClick={() => setMusicPlaying(!musicPlaying)}
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
              style={{
                background: musicPlaying ? "#f97316" : "#141414",
                color: musicPlaying ? "white" : "#aaa",
                border: musicPlaying ? "1px solid #f97316" : "1px solid #222",
                boxShadow: musicPlaying ? "0 0 16px #f9731650" : "none",
              }}
              title={musicPlaying ? "Pause" : "Play"}
            >
              {musicPlaying ? "⏸" : "▶"}
            </button>
            <button
              onClick={playNextMusic}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#141414", color: "#aaa", border: "1px solid #222" }}
              title="Nächster Track"
            >
              ⏭
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-mono" style={{ color: "#666" }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="relative mt-1">
                <div className="h-1.5 rounded-full" style={{ background: "#1a1a1a" }} />
                <div
                  className="absolute left-0 top-0 h-1.5 rounded-full"
                  style={{ width: `${progress * 100}%`, background: "#f97316" }}
                />
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, duration)}
                  step={0.25}
                  value={currentTime}
                  onChange={(e) => seekMusic(Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  title="Scrub"
                />
              </div>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1a1a1a" }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest" style={{ color: "#555" }}>
                  Vol
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[11px] font-mono" style={{ color: "#666" }}>
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

