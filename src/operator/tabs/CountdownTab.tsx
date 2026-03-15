import { useStore } from "../../store/useStore";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const PRESETS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
];

export default function CountdownTab() {
  const duration = useStore((s) => s.countdownDuration);
  const remaining = useStore((s) => s.countdownRemaining);
  const label = useStore((s) => s.countdownLabel);
  const running = useStore((s) => s.countdownRunning);
  const live = useStore((s) => s.countdownLive);
  const setDuration = useStore((s) => s.setCountdownDuration);
  const setLabel = useStore((s) => s.setCountdownLabel);
  const start = useStore((s) => s.startCountdown);
  const stop = useStore((s) => s.stopCountdown);
  const reset = useStore((s) => s.resetCountdown);
  const setLive = useStore((s) => s.setCountdownLive);

  const progress = duration > 0 ? (remaining / duration) : 0;
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
          {/* Progress ring / bar */}
          <div className="w-full h-1.5 rounded-full mb-2" style={{ background: "#1a1a1a" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progress * 100}%`,
                background: urgent ? "#ef4444" : "#f97316",
                boxShadow: urgent ? "0 0 8px #ef4444" : "none",
              }}
            />
          </div>

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

          {live && (
            <div className="flex items-center gap-1.5 text-xs live-dot" style={{ color: "#22c55e" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot inline-block" />
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

        {/* Duration */}
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            Dauer
          </label>
          <div className="flex gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setDuration(p.seconds)}
                className="flex-1 py-2 rounded text-xs font-medium transition-all"
                style={{
                  background: duration === p.seconds ? "#f9731620" : "#141414",
                  color: duration === p.seconds ? "#f97316" : "#666",
                  border: duration === p.seconds ? "1px solid #f9731640" : "1px solid #222",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={3600}
              className="w-24 text-sm px-3 py-2 rounded outline-none text-center"
              style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
              value={Math.floor(duration / 60)}
              onChange={(e) => setDuration(Number(e.target.value) * 60)}
            />
            <span className="text-sm" style={{ color: "#555" }}>Minuten</span>
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
              {running ? "⏸ Pause" : "▶ Start"}
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
