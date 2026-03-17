import { useEffect } from "react";
import { useStore } from "../store/useStore";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MediaTab from "./tabs/MediaTab";
import SongsTab from "./tabs/SongsTab";
import CountdownTab from "./tabs/CountdownTab";
import MusicTab from "./tabs/MusicTab";
import DisplayTab from "./tabs/DisplayTab";
import ShowTab from "./tabs/ShowTab";

export default function OperatorApp() {
  const activeTab = useStore((s) => s.activeTab);

  // Fetch monitors once on startup (also restores output window placement).
  useEffect(() => {
    useStore.getState().fetchMonitors();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const toggleBlackout = useStore.getState().toggleBlackout;
    const nextSlide = useStore.getState().nextSongSlide;
    const prevSlide = useStore.getState().prevSongSlide;

    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "KeyB") toggleBlackout();
      if (e.code === "ArrowRight" || e.code === "Space") nextSlide();
      if (e.code === "ArrowLeft") prevSlide();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden" style={{ background: "#111111" }}>
          {activeTab === "media" && <MediaTab />}
          {activeTab === "songs" && <SongsTab />}
          {activeTab === "countdown" && <CountdownTab />}
          {activeTab === "music" && <MusicTab />}
          {activeTab === "display" && <DisplayTab />}
          {activeTab === "show" && <ShowTab />}
        </main>

        {/* Preview panel with music controls */}
        <PreviewPanel />
      </div>
    </div>
  );
}

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function PreviewPanel() {
  const outputMode = useStore((s) => s.outputMode);
  const isBlackout = useStore((s) => s.isBlackout);
  const activeSongId = useStore((s) => s.activeSongId);
  const activeSongSlide = useStore((s) => s.activeSongSlide);
  const songs = useStore((s) => s.songs);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const slides = useStore((s) => s.slides);
  const pptxGroups = useStore((s) => s.pptxGroups);
  const countdownRemaining = useStore((s) => s.countdownRemaining);
  const countdownLabel = useStore((s) => s.countdownLabel);
  const countdownTheme = useStore((s) => s.countdownTheme);
  const activeVideoId = useStore((s) => s.activeVideoId);
  const videos = useStore((s) => s.videos);

  // Music state
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

  const activeSong = songs.find((s) => s.id === activeSongId);
  const activeSlide =
    slides.find((s) => s.id === activeSlideId) ??
    pptxGroups.flatMap((g) => g.slides).find((s) => s.id === activeSlideId);
  const activeVideo = videos.find((v) => v.id === activeVideoId);
  const currentMusic = music[musicIndex];

  const duration = musicDuration || 0;
  const currentTime = Math.min(musicCurrentTime, duration || musicCurrentTime);
  const progress = duration > 0 ? currentTime / duration : 0;

  // Countdown theme styles for preview
  const getPreviewStyles = () => {
    if (outputMode !== "countdown") return {};
    
    const urgent = countdownRemaining <= 10 && countdownRemaining > 0;
    
    if (countdownTheme === "minimal") {
      return {
        timeStyle: {
          fontSize: "clamp(2rem, 5vw, 3rem)",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          color: urgent ? "#ef4444" : "#ffffff",
        } as React.CSSProperties,
        labelStyle: {
          fontSize: "0.6rem",
          color: "#888",
          textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
        } as React.CSSProperties,
        containerStyle: {
          background: "#000",
        } as React.CSSProperties,
      };
    }
    
    if (countdownTheme === "default") {
      return {
        timeStyle: {
          fontSize: "clamp(2rem, 5vw, 3rem)",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          color: urgent ? "#ef4444" : "#ffffff",
          textShadow: urgent ? "0 0 20px #ef444480" : "0 0 15px #f9731633",
        } as React.CSSProperties,
        labelStyle: {
          fontSize: "0.6rem",
          color: "#888",
          textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
        } as React.CSSProperties,
        containerStyle: {
          background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
        } as React.CSSProperties,
      };
    }
    
    if (countdownTheme === "bold") {
      return {
        timeStyle: {
          fontSize: "clamp(2rem, 5vw, 3rem)",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 800,
          color: urgent ? "#ef4444" : "#ffffff",
          textShadow: urgent ? "0 0 20px #ef444480" : "0 0 15px #f9731640",
        } as React.CSSProperties,
        labelStyle: {
          fontSize: "0.65rem",
          color: "#aaa",
          textTransform: "uppercase" as const,
          letterSpacing: "0.2em",
        } as React.CSSProperties,
        containerStyle: {
          background: "#000",
          borderTop: `3px solid ${urgent ? "#ef4444" : "#f97316"}`,
        } as React.CSSProperties,
      };
    }
    
    return {};
  };

  const previewStyles = getPreviewStyles();

  return (
    <div
      className="w-72 shrink-0 flex flex-col border-l"
      style={{ borderColor: "#252525", background: "#0d0d0d" }}
    >
      <div className="px-3 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
        <span className="text-[11px] uppercase tracking-widest font-medium" style={{ color: "#444" }}>
          Vorschau
        </span>
      </div>

      {/* Preview screen */}
      <div className="p-3">
        <div
          className="w-full rounded-lg overflow-hidden flex items-center justify-center relative"
          style={{
            aspectRatio: "16/9",
            background: isBlackout ? "#000" : "#0a0a0a",
            border: "1px solid #1e1e1e",
            ...previewStyles.containerStyle,
          }}
        >
          {isBlackout ? (
            <span className="text-xs font-bold" style={{ color: "#ef4444" }}>BLACKOUT</span>
          ) : outputMode === "image" && activeSlide ? (
            <img src={activeSlide.src} alt="" className="w-full h-full object-contain" />
          ) : outputMode === "song" && activeSong ? (
            <div className="p-3 text-center w-full flex flex-col items-center justify-center h-full">
              <p
                className="text-white leading-snug whitespace-pre-line"
                style={{
                  fontSize: "clamp(0.7rem, 2vw, 1rem)",
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 300,
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                {activeSong.slides[activeSongSlide]?.text}
              </p>
            </div>
          ) : outputMode === "countdown" ? (
            <div className="flex flex-col items-center gap-1 p-2">
              {countdownLabel && (
                <span style={previewStyles.labelStyle}>{countdownLabel}</span>
              )}
              <span style={previewStyles.timeStyle}>
                {formatTime(countdownRemaining)}
              </span>
            </div>
          ) : outputMode === "video" && activeVideo ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl">🎬</span>
              <span className="text-[9px] text-gray-400 max-w-[90%] truncate">{activeVideo.name}</span>
            </div>
          ) : outputMode === "video" ? (
            <span className="text-2xl">🎬</span>
          ) : (
            <span className="text-xs" style={{ color: "#333" }}>Kein Output</span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="px-3 py-2 flex flex-col gap-2">
        <div className="text-[11px]" style={{ color: "#444" }}>
          Modus:{" "}
          <span style={{ color: "#888" }}>
            {isBlackout ? "Blackout" : outputMode === "blank" ? "Leer" : outputMode}
          </span>
        </div>
        {outputMode === "song" && activeSong && (
          <div className="text-[11px]" style={{ color: "#444" }}>
            Folie{" "}
            <span style={{ color: "#888" }}>
              {activeSongSlide + 1}/{activeSong.slides.length}
            </span>
          </div>
        )}
        {outputMode === "video" && activeVideo && (
          <div className="text-[11px] truncate" style={{ color: "#444" }}>
            Video: <span style={{ color: "#888" }}>{activeVideo.name}</span>
          </div>
        )}
      </div>

      {/* Music Controls */}
      {currentMusic && (
        <div className="px-3 py-3 border-t" style={{ borderColor: "#1a1a1a" }}>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#555" }}>
            Musik
          </div>
          
          <div className="text-xs font-medium truncate mb-2" style={{ color: "#ddd" }} title={currentMusic.name}>
            {currentMusic.name}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={playPrevMusic}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: "#141414", color: "#aaa", border: "1px solid #222" }}
            >
              ⏮
            </button>
            <button
              onClick={() => setMusicPlaying(!musicPlaying)}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{
                background: musicPlaying ? "#f97316" : "#141414",
                color: musicPlaying ? "white" : "#aaa",
                border: musicPlaying ? "1px solid #f97316" : "1px solid #222",
                boxShadow: musicPlaying ? "0 0 12px #f9731640" : "none",
              }}
            >
              {musicPlaying ? "⏸" : "▶"}
            </button>
            <button
              onClick={playNextMusic}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: "#141414", color: "#aaa", border: "1px solid #222" }}
            >
              ⏭
            </button>
          </div>

          {/* Progress */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-[9px] font-mono mb-1" style={{ color: "#666" }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="relative h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full"
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
              />
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ color: "#666" }}>🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="flex-1 h-1"
              style={{
                background: "linear-gradient(to right, #f97316 0%, #f97316 " + (musicVolume * 100) + "%, #1a1a1a " + (musicVolume * 100) + "%, #1a1a1a 100%)",
                borderRadius: "2px",
                outline: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Shortcut hints */}
      <div className="mt-auto px-3 py-3 border-t" style={{ borderColor: "#1a1a1a" }}>
        <div className="text-[10px] flex flex-col gap-1.5" style={{ color: "#333" }}>
          <div><kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "#1a1a1a", color: "#555" }}>B</kbd> Blackout</div>
          <div><kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "#1a1a1a", color: "#555" }}>→ / Space</kbd> Nächste Folie</div>
          <div><kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "#1a1a1a", color: "#555" }}>←</kbd> Vorherige Folie</div>
        </div>
      </div>
    </div>
  );
}
