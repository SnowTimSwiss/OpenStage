import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

const MODE_LABELS: Record<string, string> = {
  blank: "Nichts",
  blackout: "BLACKOUT",
  image: "Bild",
  html: "Folie",
  video: "Video",
  song: "Liedtext",
  countdown: "Countdown",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function Header() {
  const isBlackout = useStore((s) => s.isBlackout);
  const outputMode = useStore((s) => s.outputMode);
  const toggleBlackout = useStore((s) => s.toggleBlackout);
  const clearOutput = useStore((s) => s.clearOutput);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header
        className="flex items-center justify-between px-5 h-14 shrink-0 border-b"
        style={{ borderColor: "#252525", background: "#0d0d0d" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: "#f97316" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" />
              <polygon points="5.5,4.5 10,7 5.5,9.5" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-wide text-white">OpenStage</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "#1f1f1f", color: "#666" }}
          >
            v1.2.0
          </span>
        </div>

        {/* Live status */}
        <div className="flex items-center gap-3">
          {/* Clock */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded font-mono"
            style={{ background: "#171717", border: "1px solid #252525", color: "#aaa" }}
          >
            <span className="text-xs">🕐</span>
            <span className="text-sm font-medium">{currentTime}</span>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded"
            style={{ background: "#171717", border: "1px solid #252525" }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                outputMode === "blank" ? "bg-zinc-700" : "live-dot bg-green-500"
              }`}
            />
            <span className="text-xs" style={{ color: "#888" }}>
              Live:{" "}
              <span className="text-white font-medium">
                {isBlackout ? "BLACKOUT" : MODE_LABELS[outputMode] ?? outputMode}
              </span>
            </span>
          </div>

          {/* Clear button */}
          <button
            onClick={clearOutput}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ background: "#1a1a1a", color: "#666", border: "1px solid #252525" }}
            onMouseOver={(e) => ((e.target as HTMLElement).style.color = "#ccc")}
            onMouseOut={(e) => ((e.target as HTMLElement).style.color = "#666")}
          >
            Leeren
          </button>

          {/* Blackout */}
          <button
            onClick={toggleBlackout}
            className="px-4 py-1.5 rounded font-semibold text-sm transition-all"
            style={{
              background: isBlackout ? "#ef4444" : "#2a0a0a",
              color: isBlackout ? "white" : "#ef4444",
              border: `1px solid ${isBlackout ? "#ef4444" : "#5a1a1a"}`,
              boxShadow: isBlackout ? "0 0 20px #ef444460" : "none",
            }}
          >
            ■ BLACKOUT
          </button>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div
          className="fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50"
          style={{ background: "#2a0a0a", border: "1px solid #ef4444" }}
        >
          <span className="text-lg">⚠️</span>
          <span className="text-sm text-white">{error}</span>
          <button
            onClick={clearError}
            className="text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
