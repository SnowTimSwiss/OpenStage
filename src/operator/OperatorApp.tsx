import { useEffect, useMemo, useRef } from "react";
import { useStore } from "../store/useStore";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MediaTab from "./tabs/MediaTab";
import SongsTab from "./tabs/SongsTab";
import CountdownTab from "./tabs/CountdownTab";
import MusicTab from "./tabs/MusicTab";
import DisplayTab from "./tabs/DisplayTab";
import ShowTab from "./tabs/ShowTab";
import SlideshowTab from "./tabs/SlideshowTab";
import OutputRenderer from "../output/OutputRenderer";
import MusicOverlay from "./MusicOverlay";
import { getSongPresentation } from "../lib/songPresentation";
import type { OutputPayload } from "../types";

export default function OperatorApp() {
  const activeTab = useStore((s) => s.activeTab);
  const showQueue = useStore((s) => s.showQueue);
  const showCurrentIndex = useStore((s) => s.showCurrentIndex);

  // The floating music island is the always-available fallback transport. We hide
  // it whenever the current view already exposes its own music controls, so there
  // is never the floating island AND an inline control on screen at the same time:
  //  - normal tabs render the PreviewPanel (which has a music transport)
  //  - the show tab renders inline music controls when the current item is music
  //  - the slideshow tab has no inline transport, so the island stays visible there
  const currentShowItem =
    showCurrentIndex >= 0 && showCurrentIndex < showQueue.length ? showQueue[showCurrentIndex] : null;
  const inlineMusicControlsVisible =
    (activeTab !== "show" && activeTab !== "slideshow") ||
    (activeTab === "show" && (currentShowItem?.type === "music" || currentShowItem?.type === "playlist"));

  useEffect(() => {
    useStore.getState().fetchMonitors();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const state = useStore.getState();

      if (e.code === "KeyB") {
        state.toggleBlackout();
        return;
      }

      if (activeTab === "show") return;
      if (activeTab !== "songs") return;

      if (e.code === "ArrowRight" || e.code === "Space") {
        e.preventDefault();
        state.nextSongSlide();
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        state.prevSongSlide();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab]);

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
          {activeTab === "slideshow" && <SlideshowTab />}
        </main>
        {activeTab !== "show" && activeTab !== "slideshow" && <PreviewPanel />}
      </div>
      {!inlineMusicControlsVisible && <MusicOverlay />}
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
  const pdfGroups = useStore((s) => s.pdfGroups);
  const countdownRemaining = useStore((s) => s.countdownRemaining);
  const countdownLabel = useStore((s) => s.countdownLabel);
  const countdownTheme = useStore((s) => s.countdownTheme);
  const activeVideoId = useStore((s) => s.activeVideoId);
  const videos = useStore((s) => s.videos);

  const music = useStore((s) => s.music);
  const musicIndex = useStore((s) => s.musicIndex);
  const musicPlaying = useStore((s) => s.musicPlaying);
  const musicCurrentTime = useStore((s) => s.musicCurrentTime);
  const musicDuration = useStore((s) => s.musicDuration);
  const musicVolume = useStore((s) => s.musicVolume);
  const songBackgroundImage = useStore((s) => s.songBackgroundImage);
  const setMusicPlaying = useStore((s) => s.setMusicPlaying);
  const playNextMusic = useStore((s) => s.playNextMusic);
  const playPrevMusic = useStore((s) => s.playPrevMusic);
  const seekMusic = useStore((s) => s.seekMusic);
  const setMusicVolume = useStore((s) => s.setMusicVolume);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const activeSong = songs.find((s) => s.id === activeSongId);
  const activeSlide =
    slides.find((s) => s.id === activeSlideId) ??
    pdfGroups.flatMap((g) => g.pages).find((s) => s.id === activeSlideId);
  const activeVideo = videos.find((v) => v.id === activeVideoId);
  const currentMusic = music[musicIndex];
  const previewSong = activeSong ?? null;
  const activeSongPresentation = previewSong ? getSongPresentation(previewSong, activeSongSlide) : null;

  const duration = musicDuration || 0;
  const currentTime = Math.min(musicCurrentTime, duration || musicCurrentTime);
  const progress = duration > 0 ? currentTime / duration : 0;

  const previewPayload = useMemo<OutputPayload>(() => {
    if (isBlackout) return { mode: "blackout" };
    if ((outputMode === "image" || outputMode === "html") && activeSlide) {
      return { mode: "image", image: { src: activeSlide.src } };
    }
    if (outputMode === "song" && previewSong && activeSongPresentation && activeSongPresentation.total > 0) {
      return {
        mode: "song",
        song: {
          text: activeSongPresentation.text,
          title: previewSong.title,
          artist: previewSong.artist,
          backgroundImage: songBackgroundImage,
          index: activeSongPresentation.index,
          total: activeSongPresentation.total,
          allSlides: Boolean(previewSong.combineSlides),
        },
      };
    }
    if (outputMode === "countdown") {
      return {
        mode: "countdown",
        countdown: {
          remaining: countdownRemaining,
          label: countdownLabel,
          running: true,
          theme: countdownTheme,
        },
      };
    }
    if (outputMode === "video" && activeVideo) {
      return { mode: "video", video: { src: activeVideo.src, playing: true } };
    }
    return { mode: "blank" };
  }, [
    isBlackout,
    outputMode,
    activeSlide,
    previewSong,
    activeSongPresentation,
    countdownRemaining,
    countdownLabel,
    countdownTheme,
    activeVideo,
    songBackgroundImage,
  ]);

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

      <div className="p-3">
        <div
          className="w-full rounded-lg overflow-hidden relative"
          style={{ aspectRatio: "16/9", background: "#0a0a0a", border: "1px solid #1e1e1e" }}
        >
          <OutputRenderer state={previewPayload} embedded compact muteVideo videoRef={previewVideoRef} />
        </div>
      </div>

      <div className="px-3 py-2 flex flex-col gap-2">
        <div className="text-[11px]" style={{ color: "#444" }}>
          Modus:{" "}
          <span style={{ color: "#888" }}>
            {isBlackout ? "Blackout" : outputMode === "blank" ? "Leer" : outputMode}
          </span>
        </div>
        {outputMode === "song" && activeSong && activeSongPresentation && activeSongPresentation.total > 0 && (
          <div className="text-[11px]" style={{ color: "#444" }}>
            Folie <span style={{ color: "#888" }}>{activeSongPresentation.index + 1}/{activeSongPresentation.total}</span>
          </div>
        )}
        {outputMode === "video" && activeVideo && (
          <div className="text-[11px] truncate" style={{ color: "#444" }}>
            Video: <span style={{ color: "#888" }}>{activeVideo.name}</span>
          </div>
        )}
      </div>

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
                background: `linear-gradient(to right, #f97316 0%, #f97316 ${musicVolume * 100}%, #1a1a1a ${musicVolume * 100}%, #1a1a1a 100%)`,
                borderRadius: "2px",
                outline: "none",
              }}
            />
          </div>
        </div>
      )}

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
