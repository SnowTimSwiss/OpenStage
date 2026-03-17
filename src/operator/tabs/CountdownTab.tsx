import { useStore } from "../../store/useStore";
import { formatTime } from "../../lib/formatTime";

const THEMES = [
  { id: "minimal", label: "Minimal", icon: "◐" },
  { id: "default", label: "Aurora", icon: "◈" },
  { id: "bold", label: "Pulse", icon: "◉" },
] as const;

export default function CountdownTab() {
  const remaining = useStore((s) => s.countdownRemaining);
  const label = useStore((s) => s.countdownLabel);
  const running = useStore((s) => s.countdownRunning);
  const targetTime = useStore((s) => s.countdownTargetTime);
  const theme = useStore((s) => s.countdownTheme);
  const outputMode = useStore((s) => s.outputMode);
  const isBlackout = useStore((s) => s.isBlackout);
  const playlists = useStore((s) => s.playlists);
  const backgroundPlaylistId = useStore((s) => s.countdownBackgroundPlaylistId);
  const bgVolume = useStore((s) => s.countdownBackgroundMusicVolume);
  const musicStartMin = useStore((s) => s.countdownBackgroundMusicStartMinutes);
  const startVolumePercent = useStore((s) => s.countdownBackgroundMusicStartVolumePercent);
  const fadeInStartMin = useStore((s) => s.countdownBackgroundMusicFadeInStartMinutes);
  const fullMin = useStore((s) => s.countdownBackgroundMusicFullVolumeMinutes);
  const displayAfterZero = useStore((s) => s.countdownDisplayAfterZeroSeconds);
  const setLabel = useStore((s) => s.setCountdownLabel);
  const setTargetTime = useStore((s) => s.setCountdownTargetTime);
  const applyTargetTime = useStore((s) => s.applyCountdownTargetTime);
  const setTheme = useStore((s) => s.setCountdownTheme);
  const setBackgroundPlaylist = useStore((s) => s.setCountdownBackgroundPlaylist);
  const setBgVolume = useStore((s) => s.setCountdownBackgroundMusicVolume);
  const setMusicStartMin = useStore((s) => s.setCountdownBackgroundMusicStartMinutes);
  const setStartVolumePercent = useStore((s) => s.setCountdownBackgroundMusicStartVolumePercent);
  const setFadeInStartMin = useStore((s) => s.setCountdownBackgroundMusicFadeInStartMinutes);
  const setFullMin = useStore((s) => s.setCountdownBackgroundMusicFullVolumeMinutes);
  const setDisplayAfterZero = useStore((s) => s.setCountdownDisplayAfterZeroSeconds);

  const urgent = remaining <= 10 && remaining > 0 && running;
  const countdownOnOutput = outputMode === "countdown" && !isBlackout;
  const playlistOptions = playlists.map((p) => ({
    id: p.id,
    title: `${p.source === "spotify" ? "Spotify" : "Local"}: ${p.name} (${p.tracks.length})`,
    artist: "",
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Countdown</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        <div
          className="rounded-xl p-6 flex flex-col items-center gap-3"
          style={{
            background: theme === "bold" ? "#0a0a0a" : "#0d0d0d",
            border: "1px solid #1e1e1e",
            borderTop: theme === "bold" ? `3px solid ${urgent ? "#ef4444" : "#f97316"}` : "1px solid #1e1e1e",
          }}
        >
          {theme === "default" && (
            <div className="absolute inset-0 overflow-hidden rounded-xl" style={{ pointerEvents: "none" }}>
              <div className="countdown-bg-aurora" style={{ opacity: 0.3 }} />
            </div>
          )}

          <div className="text-3xl mb-1" style={{ filter: "drop-shadow(0 0 10px currentColor)" }}>
            {theme === "minimal" && "◐"}
            {theme === "default" && "◈"}
            {theme === "bold" && "◉"}
          </div>

          <div
            className="font-mono font-semibold leading-none relative z-10"
            style={{
              fontSize: "clamp(3rem, 8vw, 5rem)",
              fontFamily: "'JetBrains Mono', monospace",
              color: urgent ? "#ef4444" : countdownOnOutput ? "#f97316" : "#ffffff",
              transition: "color 0.3s, text-shadow 0.3s",
              textShadow: urgent
                ? "0 0 40px #ef444480"
                : theme === "bold"
                  ? "0 0 30px #f9731660"
                  : theme === "default"
                    ? "0 0 20px #f9731640"
                    : "none",
            }}
          >
            {formatTime(remaining)}
          </div>

          {targetTime && (
            <div className="text-xs flex items-center gap-1 relative z-10" style={{ color: "#666" }}>
              <span>🕐</span>
              <span>
                Ziel: <span style={{ color: "#888" }}>{targetTime} Uhr</span>
              </span>
            </div>
          )}

          {countdownOnOutput && (
            <div className="flex items-center gap-2 text-xs relative z-10" style={{ color: "#22c55e" }}>
              <span className="w-2 h-2 rounded-full bg-green-500 live-dot" />
              <span className="font-medium">Als Ausgabe aktiv</span>
            </div>
          )}
        </div>

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
              title="Berechnet die verbleibende Zeit bis zur Zielzeit"
            >
              Übernehmen
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#555" }}>
            Die Zeit wird automatisch berechnet. Bei vergangener Zeit wird morgen angenommen.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            🎵 Hintergrundmusik (endet bei 0:00)
          </label>
          <select
            className="w-full text-sm px-3 py-2 rounded outline-none"
            style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
            value={backgroundPlaylistId ?? ""}
            onChange={(e) => setBackgroundPlaylist(e.target.value || null)}
          >
            <option value="">Keine Musik</option>
            {playlistOptions.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title} {song.artist ? `— ${song.artist}` : ""}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#666" }}>
                Musik startet (min vor 00)
              </label>
              <input
                type="number"
                min={0}
                max={240}
                value={musicStartMin}
                onChange={(e) => setMusicStartMin(Number(e.target.value))}
                className="w-full text-sm px-2 py-2 rounded outline-none"
                style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
              />
            </div>

            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#666" }}>
                Start-Lautstärke (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={startVolumePercent}
                onChange={(e) => setStartVolumePercent(Number(e.target.value))}
                className="w-full text-sm px-2 py-2 rounded outline-none"
                style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#666" }}>
                Fade-In ab (min vor 00)
              </label>
              <input
                type="number"
                min={0}
                max={240}
                value={fadeInStartMin}
                onChange={(e) => setFadeInStartMin(Number(e.target.value))}
                className="w-full text-sm px-2 py-2 rounded outline-none"
                style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
              />
            </div>

            <div>
              <label className="text-[11px] block mb-1" style={{ color: "#666" }}>
                100% ab (min vor 00)
              </label>
              <input
                type="number"
                min={0}
                max={240}
                value={fullMin}
                onChange={(e) => setFullMin(Number(e.target.value))}
                className="w-full text-sm px-2 py-2 rounded outline-none"
                style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-[11px] block mb-1" style={{ color: "#666" }}>
              Max. Lautstärke (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={bgVolume}
                onChange={(e) => setBgVolume(Number(e.target.value))}
                className="flex-1"
              />
              <div className="text-[11px] w-10 text-right" style={{ color: "#555" }}>
                {Math.round(bgVolume * 100)}%
              </div>
            </div>
          </div>

          <p className="text-[11px] mt-2" style={{ color: "#555" }}>
            Musik startet {musicStartMin} min vor 00 mit {startVolumePercent}% der max. Lautstärke. Ab {fadeInStartMin} min wird auf{" "}
            {Math.round(bgVolume * 100)}% eingeblendet. Bei {fullMin} min ist Maximum erreicht.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            ⏱️ Anzeige nach 0:00
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={60}
              value={displayAfterZero}
              onChange={(e) => setDisplayAfterZero(Number(e.target.value))}
              className="w-24 text-sm px-2 py-2 rounded outline-none"
              style={{ background: "#141414", border: "1px solid #252525", color: "#ddd" }}
            />
            <span className="text-xs" style={{ color: "#888" }}>
              Sekunden
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "#555" }}>
            Der Countdown bleibt nach 0:00 noch {displayAfterZero} Sekunden sichtbar, bevor er zu schwarz fadet.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: "#666" }}>
            Design (Beamer)
          </label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex-1 py-3 rounded-lg text-xs font-medium transition-all border"
                style={{
                  background: theme === t.id ? "#f9731620" : "#141414",
                  color: theme === t.id ? "#f97316" : "#666",
                  borderColor: theme === t.id ? "#f9731640" : "#222",
                  boxShadow: theme === t.id ? "0 0 20px #f9731620" : "none",
                }}
              >
                <span className="text-lg block mb-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <p className="text-[11px] text-center mt-2" style={{ color: "#555" }}>
            Countdown läuft im Hintergrund. Sichtbar wird er, wenn der aktive Ausgabe-Modus auf Countdown steht.
          </p>
        </div>
      </div>
    </div>
  );
}
