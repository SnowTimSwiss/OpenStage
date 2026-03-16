import { useStore } from "../../store/useStore";
import { formatTime } from "../../lib/formatTime";

const THEMES = [
  { id: "minimal", label: "Minimal" },
  { id: "default", label: "Aurora" },
  { id: "bold", label: "Pulse" },
] as const;

export default function CountdownTab() {
  const remaining = useStore((s) => s.countdownRemaining);
  const label = useStore((s) => s.countdownLabel);
  const running = useStore((s) => s.countdownRunning);
  const live = useStore((s) => s.countdownLive);
  const targetTime = useStore((s) => s.countdownTargetTime);
  const theme = useStore((s) => s.countdownTheme);
  const backgroundMusicId = useStore((s) => s.countdownBackgroundMusicId);
  const songs = useStore((s) => s.songs);
  const setLabel = useStore((s) => s.setCountdownLabel);
  const setTargetTime = useStore((s) => s.setCountdownTargetTime);
  const applyTargetTime = useStore((s) => s.applyCountdownTargetTime);
  const setTheme = useStore((s) => s.setCountdownTheme);
  const setBackgroundMusic = useStore((s) => s.setCountdownBackgroundMusic);
  const start = useStore((s) => s.startCountdown);
  const stop = useStore((s) => s.stopCountdown);
  const reset = useStore((s) => s.resetCountdown);
  const setLive = useStore((s) => s.setCountdownLive);

  const urgent = remaining <= 10 && remaining > 0 && running;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Countdown</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {/* Big Timer Display */}
        <div
          className="rounded-xl p-6 flex flex-col items-center gap-2"
          style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
        >
          <div
            className="font-mono text-6xl font-semibold leading-none"
            style={{
              color: urgent ? "#ef4444" : live ? "#f97316" : "#ffffff",
              transition: "color 0.3s",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {formatTime(remaining)}
          </div>

          {targetTime && (
            <div className="text-xs" style={{ color: "#555" }}>
              Zielzeit: <span style={{ color: "#888" }}>{targetTime} Uhr</span>
            </div>
          )}

          {live && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#22c55e" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot" />
              Live auf Beamer
            </div>
          )}
        </div>

        {/* Label */}
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            Anzeigetext
          </label>
          <input
            className="w-full text-sm px-3 py-2 rounded outline-none"
            style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. Gottesdienst beginnt in"
          />
        </div>

        {/* Target time */}
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            Zielzeit (Countdown endet um)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="w-32 text-sm px-3 py-2 rounded outline-none"
              style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
              value={targetTime ?? ""}
              onChange={(e) => setTargetTime(e.target.value || null)}
            />
            <button
              onClick={applyTargetTime}
              className="px-3 py-2 rounded text-xs font-medium"
              style={{ background: "#1f1f1f", color: "#f97316", border: "1px solid #333" }}
              title="Setzt Dauer so, dass der Countdown zur Zielzeit bei 00:00 ist"
            >
              Anwenden
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#555" }}>
            Wenn die Uhrzeit schon vorbei ist, wird automatisch auf morgen gerechnet.
          </p>
        </div>

        {/* Background Music */}
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            Hintergrundmusik (endet bei 0:00)
          </label>
          <select
            className="w-full text-sm px-3 py-2 rounded outline-none"
            style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
            value={backgroundMusicId ?? ""}
            onChange={(e) => setBackgroundMusic(e.target.value || null)}
          >
            <option value="">Keine Musik</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title} {song.artist ? `- ${song.artist}` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] mt-2" style={{ color: "#555" }}>
            Wähle ein Lied. Die Musik wird so gestartet, dass sie genau bei 0:00 endet.
          </p>
        </div>

        {/* Themes */}
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            Theme (Beamer)
          </label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex-1 py-2 rounded text-xs font-medium transition-all"
                style={{
                  background: theme === t.id ? "#f9731620" : "#141414",
                  color: theme === t.id ? "#f97316" : "#666",
                  border: theme === t.id ? "1px solid #f9731640" : "1px solid #222",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={running ? stop : start}
              className="flex-1 py-3 rounded font-semibold text-sm transition-all"
              style={{
                background: running ? "#1a1a1a" : "#f97316",
                color: running ? "#888" : "white",
                border: running ? "1px solid #333" : "none",
              }}
            >
              {running ? "Läuft..." : "Start"}
            </button>
            <button
              onClick={reset}
              className="px-5 py-3 rounded font-semibold text-sm"
              style={{ background: "#141414", color: "#666", border: "1px solid #252525" }}
            >
              ↺ Reset
            </button>
          </div>

          {/* Live toggle */}
          <button
            onClick={() => setLive(!live)}
            className="w-full py-3 rounded font-semibold text-sm transition-all"
            style={{
              background: live ? "#14290a" : "#0a1a0a",
              color: live ? "#22c55e" : "#444",
              border: live ? "1px solid #22c55e60" : "1px solid #1a2a1a",
              boxShadow: live ? "0 0 16px #22c55e20" : "none",
            }}
          >
            {live ? "● Countdown läuft auf Beamer" : "◯ Auf Beamer zeigen"}
          </button>
        </div>
      </div>
    </div>
  );
}
