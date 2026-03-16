import { useEffect } from "react";
import { useStore } from "../store/useStore";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MediaTab from "./tabs/MediaTab";
import SongsTab from "./tabs/SongsTab";
import CountdownTab from "./tabs/CountdownTab";
import MusicTab from "./tabs/MusicTab";
import DisplayTab from "./tabs/DisplayTab";

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
          {activeTab === "media"     && <MediaTab />}
          {activeTab === "songs"     && <SongsTab />}
          {activeTab === "countdown" && <CountdownTab />}
          {activeTab === "music"     && <MusicTab />}
          {activeTab === "display"   && <DisplayTab />}
        </main>

        {/* Preview panel */}
        <PreviewPanel />
      </div>
    </div>
  );
}

function PreviewPanel() {
  const outputMode = useStore((s) => s.outputMode);
  const isBlackout = useStore((s) => s.isBlackout);
  const activeSongId = useStore((s) => s.activeSongId);
  const activeSongSlide = useStore((s) => s.activeSongSlide);
  const songs = useStore((s) => s.songs);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const slides = useStore((s) => s.slides);
  const countdownRemaining = useStore((s) => s.countdownRemaining);

  const activeSong = songs.find((s) => s.id === activeSongId);
  const activeSlide = slides.find((s) => s.id === activeSlideId);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div
      className="w-56 shrink-0 flex flex-col border-l"
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
          className="w-full rounded-lg overflow-hidden flex items-center justify-center"
          style={{
            aspectRatio: "16/9",
            background: isBlackout ? "#000" : "#0a0a0a",
            border: "1px solid #1e1e1e",
          }}
        >
          {isBlackout ? (
            <span className="text-xs font-bold" style={{ color: "#ef4444" }}>BLACKOUT</span>
          ) : outputMode === "image" && activeSlide ? (
            <img src={activeSlide.src} alt="" className="w-full h-full object-contain" />
          ) : outputMode === "song" && activeSong ? (
            <div className="p-2 text-center">
              <p className="text-white leading-tight" style={{ fontSize: "8px" }}>
                {activeSong.slides[activeSongSlide]?.text}
              </p>
            </div>
          ) : outputMode === "countdown" ? (
            <span className="font-mono text-white text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {formatTime(countdownRemaining)}
            </span>
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
      </div>

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
