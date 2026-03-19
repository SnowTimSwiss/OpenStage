import { useEffect, useState } from "react";
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
  const [musicExpanded, setMusicExpanded] = useState(Boolean(backgroundPlaylistId));

  useEffect(() => {
    setMusicExpanded(Boolean(backgroundPlaylistId));
  }, [backgroundPlaylistId]);

  const urgent = remaining <= 10 && remaining > 0 && running;
  const countdownOnOutput = outputMode === "countdown" && !isBlackout;
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  const activePlaylist = activePlaylistId ? playlists.find((p) => p.id === activePlaylistId) : null;
  const backgroundPlaylist = backgroundPlaylistId ? playlists.find((p) => p.id === backgroundPlaylistId) : null;
  const backgroundPlaylistArt = backgroundPlaylist?.coverArt ?? backgroundPlaylist?.tracks[0]?.albumArt ?? null;
  const playlistOptions = playlists.map((p) => ({
    id: p.id,
    title: `${p.name} (${p.tracks.length})`,
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
          <button
            onClick={() => setMusicExpanded((value) => !value)}
            className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-all"
            style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
          >
            <div className="text-left">
              <div className="text-xs font-medium" style={{ color: "#ddd" }}>
                Hintergrundmusik
              </div>
              <div className="text-[11px] mt-1" style={{ color: "#666" }}>
                {musicExpanded ? "Einstellungen sichtbar" : "Eingeklappt"}
              </div>
            </div>
            <div
              className={`relative h-6 w-11 rounded-full transition-colors ${musicExpanded ? "bg-[#f97316]" : "bg-[#333]"}`}
              aria-hidden="true"
            >
              <div
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: musicExpanded ? "translateX(22px)" : "translateX(2px)" }}
              />
            </div>
          </button>

          {musicExpanded && (
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-medium" style={{ color: "#666" }}>
                    🎵 Hintergrundmusik (endet bei 0:00)
                  </label>
                  <button
                    onClick={() => {
                      if (!activePlaylistId) return;
                      setBackgroundPlaylist(activePlaylistId);
                    }}
                    disabled={!activePlaylistId}
                    className="text-[11px] px-2 py-1 rounded"
                    style={{
                      background: "#1a1a1a",
                      color: activePlaylistId ? "#f97316" : "#555",
                      border: "1px solid #2a2a2a",
                    }}
                    title={
                      activePlaylist
                        ? `Aktive Playlist übernehmen: ${activePlaylist.name}`
                        : "Im Musik-Tab erst eine Playlist aktivieren"
                    }
                  >
                    Aktive Playlist
                  </button>
                </div>
                {activePlaylist && (
                  <p className="text-[11px] mb-2" style={{ color: "#555" }}>
                    Aktiv im Musik-Tab: <span style={{ color: "#888" }}>{activePlaylist.name}</span>
                  </p>
                )}
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
                  Musik startet {musicStartMin} min vor 00 mit {startVolumePercent}% der max. Lautstärke. Ab{" "}
                  {fadeInStartMin} min wird auf {Math.round(bgVolume * 100)}% eingeblendet. Bei {fullMin} min ist
                  Maximum erreicht.
                </p>
              </div>

              <div
                className="rounded-xl p-4 border"
                style={{
                  background: "#0b0b0b",
                  borderColor: "#232323",
                  opacity: 0.55,
                  filter: "grayscale(1)",
                }}
              >
                <div className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#666" }}>
                  Player Widget
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ background: "#1a1a1a" }}
                  >
                    {backgroundPlaylistArt ? (
                      <img src={backgroundPlaylistArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">🎵</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#ddd" }}>
                      {backgroundPlaylist ? backgroundPlaylist.name : "Keine Hintergrundmusik"}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "#666" }}>
                      {backgroundPlaylist
                        ? `${backgroundPlaylist.tracks.length} Tracks · Lokal`
                        : "Nur Vorschau, hier kann nichts geändert werden"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    disabled
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-not-allowed"
                    style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222" }}
                  >
                    ⏮
                  </button>
                  <button
                    disabled
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold cursor-not-allowed"
                    style={{ background: "#1f1f1f", color: "#777", border: "1px solid #262626" }}
                  >
                    ▶
                  </button>
                  <button
                    disabled
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-not-allowed"
                    style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222" }}
                  >
                    ⏭
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: "#666" }}>
                    <span>Lautstärke</span>
                    <span>{Math.round(bgVolume * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={bgVolume} disabled className="w-full" />
                </div>

                <div className="mt-4">
                  <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#666]"
                      style={{ width: backgroundPlaylist ? "42%" : "0%" }}
                    />
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: "#555" }}>
                    Gleiche Vorschau wie im Musik-Player, aber im Countdown gesperrt.
                  </p>
                </div>

                <p className="text-[11px] mt-3" style={{ color: "#555" }}>
                  Steuerung bleibt im Countdown gesperrt. Hier siehst du nur, welche Playlist aktiv ist.
                </p>
              </div>
            </div>
          )}
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
      </div>
    </div>
  );
}
