import { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { assignOutputToMonitor } from "../../lib/events";

export default function DisplayTab() {
  const monitors = useStore((s) => s.monitors);
  const selectedMonitor = useStore((s) => s.selectedMonitor);
  const outputWindowReady = useStore((s) => s.outputWindowReady);
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const setSelectedMonitor = useStore((s) => s.setSelectedMonitor);
  const openOutput = useStore((s) => s.openOutput);

  useEffect(() => { fetchMonitors(); }, []);

  async function assignMonitor(i: number) {
    setSelectedMonitor(i);
    if (!outputWindowReady) await openOutput();
    const m = monitors[i];
    if (m) await assignOutputToMonitor(m.x, m.y, m.width, m.height);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Display Konfiguration</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {/* Output window control */}
        <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Ausgabefenster</div>
              <div className="text-xs mt-0.5" style={{ color: "#555" }}>
                {outputWindowReady ? "Fenster ist offen" : "Fenster nicht geöffnet"}
              </div>
            </div>
            <div
              className={`w-2.5 h-2.5 rounded-full ${outputWindowReady ? "bg-green-500 live-dot" : "bg-zinc-700"}`}
            />
          </div>
          <button
            onClick={openOutput}
            className="w-full py-2.5 rounded font-medium text-sm transition-all"
            style={{
              background: outputWindowReady ? "#141414" : "#f97316",
              color: outputWindowReady ? "#555" : "white",
              border: outputWindowReady ? "1px solid #252525" : "none",
            }}
          >
            {outputWindowReady ? "Fenster erneut öffnen" : "Ausgabefenster öffnen"}
          </button>
        </div>

        {/* Monitor selection */}
        <div>
          <div className="text-xs font-medium mb-3" style={{ color: "#666" }}>
            Erkannte Monitore ({monitors.length})
          </div>
          {monitors.length === 0 ? (
            <div
              className="rounded-lg p-4 text-center text-sm"
              style={{ background: "#111", border: "1px solid #1e1e1e", color: "#555" }}
            >
              <button
                onClick={fetchMonitors}
                className="text-xs px-3 py-1.5 rounded mt-2"
                style={{ background: "#1f1f1f", color: "#888" }}
              >
                Monitore laden
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {monitors.map((m, i) => {
                const isSelected = i === selectedMonitor;
                const isMain = i === 0;
                return (
                  <button
                    key={i}
                    onClick={() => assignMonitor(i)}
                    className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: isSelected ? "#f9731610" : "#111",
                      border: isSelected ? "1px solid #f9731440" : "1px solid #1e1e1e",
                    }}
                  >
                    {/* Monitor icon */}
                    <div
                      className="w-16 h-10 rounded flex items-center justify-center shrink-0 relative"
                      style={{
                        background: isSelected ? "#f9731620" : "#1a1a1a",
                        border: isSelected ? "2px solid #f97316" : "2px solid #2a2a2a",
                      }}
                    >
                      <span className="text-xs" style={{ color: isSelected ? "#f97316" : "#444" }}>
                        {m.width}×{m.height}
                      </span>
                      {isMain && (
                        <div
                          className="absolute -top-2 -right-2 text-[8px] px-1 py-0.5 rounded"
                          style={{ background: "#1a1a1a", color: "#555", border: "1px solid #333" }}
                        >
                          Haupt
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: isSelected ? "#f97316" : "#ddd" }}>
                        {m.name || `Monitor ${i + 1}`}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#555" }}>
                        {m.width} × {m.height} px · Position ({m.x}, {m.y})
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-xs font-bold" style={{ color: "#f97316" }}>Beamer ▶</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Info box */}
        <div
          className="rounded-lg p-4 text-xs leading-relaxed"
          style={{ background: "#0a1020", border: "1px solid #1a2540", color: "#4a6a9a" }}
        >
          <div className="font-semibold mb-1" style={{ color: "#6a8abf" }}>ℹ️ Tastenkürzel</div>
          <div className="space-y-1">
            <div>Ausgabefenster auf Monitor ziehen → Vollbild drücken</div>
            <div>Das Ausgabefenster zeigt immer den aktuellen Live-Inhalt</div>
          </div>
        </div>
      </div>
    </div>
  );
}
