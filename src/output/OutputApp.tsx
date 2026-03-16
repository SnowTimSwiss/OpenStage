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
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoErrorRef = useRef<boolean>(false);

  useEffect(() => {
    if (state.mode !== previousMode) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPreviousMode(state.mode);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.mode, previousMode]);

  useEffect(() => {
    const unlisten = listen<OutputPayload>(OUTPUT_EVENT, (e) => {
      setState(e.payload);
      if (e.payload.mode === "video" && e.payload.video?.playing && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch((err) => {
          console.error("Video play error:", err);
          videoErrorRef.current = true;
        });
      }
    });

    const unlistenCtrl = listen<{ action: string }>(VIDEO_CTRL_EVENT, (e) => {
      if (!videoRef.current) return;
      if (e.payload.action === "play") {
        videoRef.current.play().catch((err) => console.error("Play error:", err));
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

  // Reset video error state on mode change
  useEffect(() => {
    videoErrorRef.current = false;
  }, [state.mode]);

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
        />
      </div>
    );
  }

  // ── Video ─────────────────────────────────────────────────────────────────
  if (mode === "video" && state.video) {
    return (
      <div
        className="w-screen h-screen bg-black flex items-center justify-center transition-opacity duration-300"
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
            videoErrorRef.current = true;
          }}
        />
        {videoErrorRef.current && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
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
    const { remaining, label } = state.countdown;
    const urgent = remaining <= 10 && remaining > 0;
    return (
      <div
        className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-6 transition-opacity duration-300"
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
            textShadow: urgent ? "0 0 40px #ef444480" : "none",
            transition: "color 0.3s, text-shadow 0.3s",
          }}
        >
          {formatTime(remaining)}
        </p>
      </div>
    );
  }

  return <div className="w-screen h-screen bg-black" />;
}
