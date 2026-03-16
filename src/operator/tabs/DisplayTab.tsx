import { useEffect } from "react";
import { useStore } from "../../store/useStore";

export default function DisplayTab() {
  const monitors = useStore((s) => s.monitors);
  const outputMonitorIndex = useStore((s) => s.outputMonitorIndex);
  const outputWindowOpen = useStore((s) => s.outputWindowOpen);
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const setOutputMonitor = useStore((s) => s.setOutputMonitor);

  useEffect(() => { fetchMonitors(); }, []);

  async function handleToggleOutput(i: number) {
    if (outputMonitorIndex === i) {
      // Deselect - close output window
      await setOutputMonitor(null);
    } else {
      // Select this monitor as output
      await setOutputMonitor(i);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Display Konfiguration</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {/* Info Box */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="text-sm leading-relaxed" style={{ color: "#888" }}>
              <p className="font-semibold text-white mb-1">So funktioniert's:</p>
              <ul className="space-y-1 text-xs">
                <li>• Wähle einen Monitor als <span className="text-orange-500">Ausgabedisplay</span> (Beamer)</li>
                <li>• Das Operator-Fenster bleibt auf diesem Bildschirm</li>
                <li>• Das Ausgabefenster wird automatisch im Vollbild geöffnet</li>
                <li>• Klicke erneut auf "Ausgabe" um es zu deaktivieren</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Monitor List */}
        <div>
          <div className="text-xs font-medium mb-3" style={{ color: "#666" }}>
            Erkannte Monitore ({monitors.length})
          </div>

          {monitors.length === 0 ? (
            <div
              className="rounded-lg p-4 text-center text-sm"
              style={{ background: "#111", border: "1px solid #1e1e1e", color: "#555" }}
            >
              <p>Keine Monitore erkannt</p>
              <button
                onClick={fetchMonitors}
                className="text-xs px-3 py-1.5 rounded mt-2"
                style={{ background: "#1f1f1f", color: "#888" }}
              >
                Erneut suchen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {monitors.map((m, i) => {
                const isOutput = outputMonitorIndex === i;
                const isPrimary = i === 0;

                return (
                  <div
                    key={i}
                    className={`rounded-xl p-4 transition-all ${
                      isOutput ? "ring-2 ring-orange-500" : ""
                    }`}
                    style={{
                      background: isOutput ? "#f9731610" : "#0d0d0d",
                      border: isOutput ? "1px solid #f9731640" : "1px solid #1e1e1e",
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Monitor Icon */}
                      <div
                        className="w-20 h-14 rounded-lg flex items-center justify-center shrink-0 relative"
                        style={{
                          background: isOutput ? "#f9731620" : "#1a1a1a",
                          border: isOutput ? "2px solid #f97316" : "2px solid #2a2a2a",
                        }}
                      >
                        <span
                          className="text-xs font-mono"
                          style={{ color: isOutput ? "#f97316" : "#444" }}
                        >
                          {m.width}×{m.height}
                        </span>

                        {/* Badges */}
                        {isPrimary && (
                          <div
                            className="absolute -top-1.5 -left-1.5 text-[8px] px-1.5 py-0.5 rounded"
                            style={{ background: "#1a1a1a", color: "#666", border: "1px solid #333" }}
                          >
                            Haupt
                          </div>
                        )}
                        {isOutput && (
                          <div
                            className="absolute -top-1.5 -right-1.5 text-[8px] px-1.5 py-0.5 rounded live-dot"
                            style={{ background: "#f97316", color: "white", border: "1px solid #f97316" }}
                          >
                            LIVE
                          </div>
                        )}
                      </div>

                      {/* Monitor Info */}
                      <div className="flex-1">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: isOutput ? "#f97316" : "#ddd" }}
                        >
                          {m.name || `Monitor ${i + 1}`}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "#555" }}>
                          {m.width} × {m.height} px · Position ({m.x}, {m.y})
                        </div>
                        {isOutput && outputWindowOpen && (
                          <div className="text-xs mt-1 live-dot" style={{ color: "#22c55e" }}>
                            ● Ausgabefenster aktiv
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleToggleOutput(i)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          isOutput
                            ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                            : "bg-orange-500 text-white hover:bg-orange-600"
                        }`}
                        style={{
                          boxShadow: isOutput ? "none" : "0 0 20px #f9731640",
                        }}
                      >
                        {isOutput ? "✕ Deaktivieren" : "▶ Als Ausgabe"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Box */}
        {outputMonitorIndex !== null && monitors[outputMonitorIndex] && (
          <div
            className="rounded-xl p-4"
            style={{ background: "#0a1f0a", border: "1px solid #1a4a1a" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500 live-dot" />
              <span className="text-xs font-semibold" style={{ color: "#4a9a4a" }}>
                Aktuelle Konfiguration
              </span>
            </div>
            <div className="text-xs leading-relaxed" style={{ color: "#6a9a6a" }}>
              <p>
                <strong className="text-white">Operator:</strong> Dieser Bildschirm ({monitors[0]?.name || "Hauptmonitor"})
              </p>
              <p className="mt-1">
                <strong className="text-white">Ausgabe:</strong> {monitors[outputMonitorIndex]?.name || `Monitor ${outputMonitorIndex + 1}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
