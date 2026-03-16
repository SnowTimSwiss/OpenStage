import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { OUTPUT_EVENT, VIDEO_CTRL_EVENT } from "../lib/events";
import type { OutputPayload } from "../types";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function OutputApp() {
  const [state, setState] = useState<OutputPayload>({ mode: "blank" });
  const [previousMode, setPreviousMode] = useState<OutputPayload["mode"]>("blank");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (state.mode !== previousMode) {
      setIsTransitioning(true);
      setVideoError(false);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPreviousMode(state.mode);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.mode, previousMode, state.image, state.song, state.countdown]);

  useEffect(() => {
    const unlisten = listen<OutputPayload>(OUTPUT_EVENT, (e) => {
      console.log("Output event received:", e.payload);
      setState(e.payload);
      if (e.payload.mode === "video" && e.payload.video?.playing && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch((err) => {
          console.error("Video play error:", err);
          setVideoError(true);
        });
      }
    });

    const unlistenCtrl = listen<{ action: string }>(VIDEO_CTRL_EVENT, (e) => {
      if (!videoRef.current) return;
      if (e.payload.action === "play") {
        videoRef.current.play().catch((err) => {
          console.error("Play error:", err);
          setVideoError(true);
        });
      }
      if (e.payload.action === "pause") {
        videoRef.current.pause();
      }
    });

    return () => {
      unlisten.then((f) => f());
      unlistenCtrl.then((f) => f());
    };
  }, []);

  const { mode } = state;

  // ── Blackout ─────────────────────────────────────────────────────────────
  if (mode === "blackout" || mode === "blank") {
    return (
      <div
        className="w-screen h-screen bg-black transition-opacity duration-300"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      />
    );
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  if (mode === "image" && state.image) {
    return (
      <div
        className="w-screen h-screen bg-black flex items-center justify-center transition-opacity duration-300"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        <img
          src={state.image.src}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
          onError={() => console.error("Failed to load image")}
        />
      </div>
    );
  }

  // ── Video ─────────────────────────────────────────────────────────────────
  if (mode === "video" && state.video) {
    return (
      <div
        className="w-screen h-screen bg-black flex items-center justify-center transition-opacity duration-300 relative"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        <video
          ref={videoRef}
          src={state.video.src}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          onEnded={() => setState({ mode: "blank" })}
          onError={(e) => {
            console.error("Video error:", e);
            setVideoError(true);
          }}
          onPlay={() => setVideoError(false)}
        />
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center px-4">
              <p className="text-white text-lg mb-2">⚠️ Video kann nicht abgespielt werden</p>
              <p className="text-gray-400 text-sm">Das Video-Format wird möglicherweise nicht unterstützt</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Song lyrics ───────────────────────────────────────────────────────────
  if (mode === "song" && state.song) {
    return (
      <div
        className="w-screen h-screen bg-black flex flex-col items-center justify-center px-20 transition-opacity duration-300"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        <p
          className="text-white text-center leading-snug whitespace-pre-line"
          style={{
            fontSize: "clamp(2rem, 5vw, 5rem)",
            fontFamily: "'Sora', sans-serif",
            fontWeight: 300,
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
            letterSpacing: "0.01em",
          }}
        >
          {state.song.text}
        </p>
      </div>
    );
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  if (mode === "countdown" && state.countdown !== undefined) {
    const { remaining, label, theme = "default" } = state.countdown;
    const urgent = remaining <= 10 && remaining > 0;

    // Minimal = clean look
    if (theme === "minimal") {
      return (
        <div
          className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-4 transition-opacity duration-300"
          style={{ opacity: isTransitioning ? 0 : 1 }}
        >
          {label && (
            <p
              className="text-white/50 uppercase tracking-widest text-2xl"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {label}
            </p>
          )}
          <p
            className="font-mono leading-none"
            style={{
              fontSize: "clamp(6rem, 18vw, 18rem)",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: urgent ? "#ef4444" : "#ffffff",
              textShadow: urgent ? "0 0 40px #ef444480" : "0 0 20px rgba(255,255,255,0.3)",
              transition: "color 0.3s, text-shadow 0.3s",
            }}
          >
            {formatTime(remaining)}
          </p>
        </div>
      );
    }

    // Aurora = colorful gradient background
    if (theme === "default") {
      return (
        <div
          className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-6 transition-opacity duration-300 relative overflow-hidden"
          style={{ opacity: isTransitioning ? 0 : 1 }}
        >
          <div className="countdown-bg-aurora" />
          {label && (
            <p
              className="text-white/60 uppercase tracking-widest text-2xl relative z-10"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {label}
            </p>
          )}
          <p
            className="font-mono leading-none relative z-10"
            style={{
              fontSize: "clamp(6rem, 18vw, 18rem)",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: urgent ? "#ef4444" : "#ffffff",
              textShadow: urgent 
                ? "0 0 60px #ef444480, 0 0 100px #ef444440" 
                : "0 0 40px #f9731650, 0 0 80px #f9731630",
              transition: "color 0.3s, text-shadow 0.3s",
            }}
          >
            {formatTime(remaining)}
          </p>
        </div>
      );
    }

    // Bold = pulse effect with grid
    if (theme === "bold") {
      return (
        <div
          className="w-screen h-screen bg-black flex flex-col items-center justify-center transition-opacity duration-300 relative overflow-hidden"
          style={{ opacity: isTransitioning ? 0 : 1 }}
        >
          <div className="countdown-bg-pulse" />
          <div 
            className="absolute top-0 left-0 right-0 h-1.5" 
            style={{ 
              background: urgent ? "#ef4444" : "#f97316",
              boxShadow: `0 0 30px ${urgent ? "#ef4444" : "#f97316"}`,
            }} 
          />
          {label && (
            <p
              className="text-white/70 uppercase tracking-[0.25em] text-3xl mb-6 relative z-10"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {label}
            </p>
          )}
          <p
            className="font-mono leading-none relative z-10"
            style={{
              fontSize: "clamp(6rem, 18vw, 18rem)",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 800,
              color: urgent ? "#ef4444" : "#ffffff",
              textShadow: urgent 
                ? "0 0 60px #ef4444, 0 0 120px #ef444460" 
                : "0 0 40px #f9731660, 0 0 80px #f9731640",
              transition: "color 0.3s, text-shadow 0.3s",
            }}
          >
            {formatTime(remaining)}
          </p>
        </div>
      );
    }

    // Fallback to minimal
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <p className="font-mono text-white" style={{ fontSize: "clamp(6rem, 18vw, 18rem)" }}>
          {formatTime(remaining)}
        </p>
      </div>
    );
  }

  return <div className="w-screen h-screen bg-black" />;
}
