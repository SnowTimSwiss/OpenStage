import type { RefObject } from "react";
import type { OutputPayload } from "../types";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface OutputRendererProps {
  state: OutputPayload;
  isTransitioning?: boolean;
  videoRef?: RefObject<HTMLVideoElement>;
  videoError?: boolean;
  onVideoError?: () => void;
  onVideoPlay?: () => void;
  onVideoEnded?: () => void;
  embedded?: boolean;
  compact?: boolean;
  muteVideo?: boolean;
}

export default function OutputRenderer({
  state,
  isTransitioning = false,
  videoRef,
  videoError = false,
  onVideoError,
  onVideoPlay,
  onVideoEnded,
  embedded = false,
  compact = false,
  muteVideo = false,
}: OutputRendererProps) {
  const rootClassName = embedded ? "w-full h-full" : "w-screen h-screen";
  const transitionStyle = { opacity: isTransitioning ? 0 : 1 };
  const { mode } = state;
  const songFontSize = compact ? "clamp(0.75rem, 1.6vw, 1.15rem)" : "clamp(2rem, 5vw, 5rem)";
  const countdownLabelSize = compact ? "0.7rem" : "1.5rem";
  const countdownTimeSize = compact ? "clamp(1.5rem, 3.8vw, 3.4rem)" : "clamp(6rem, 18vw, 18rem)";
  const countdownTransition = "opacity 1200ms ease";

  if (mode === "blackout" || mode === "blank") {
    return (
      <div
        className={`${rootClassName} bg-black transition-opacity duration-300`}
        style={transitionStyle}
      />
    );
  }

  if (mode === "image" && state.image) {
    return (
      <div
        className={`${rootClassName} bg-black flex items-center justify-center transition-opacity duration-300`}
        style={transitionStyle}
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

  if (mode === "html" && state.html) {
    return (
      <div
        className={`${rootClassName} bg-black flex items-center justify-center transition-opacity duration-300`}
        style={transitionStyle}
      >
        <img
          src={state.html.content}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  if (mode === "video" && state.video) {
    return (
      <div
        className={`${rootClassName} bg-black flex items-center justify-center transition-opacity duration-300 relative`}
        style={transitionStyle}
      >
        <video
          ref={videoRef}
          src={state.video.src}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted={muteVideo}
          onEnded={onVideoEnded}
          onError={() => onVideoError?.()}
          onPlay={() => onVideoPlay?.()}
        />
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center px-4">
              <p className="text-white text-lg mb-2">Video kann nicht abgespielt werden</p>
              <p className="text-gray-400 text-sm">Das Video-Format wird möglicherweise nicht unterstützt</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === "song" && state.song) {
    return (
      <div
        className={`${rootClassName} bg-black flex flex-col items-center justify-center px-20 transition-opacity duration-300`}
        style={transitionStyle}
      >
        <p
          className="text-white text-center leading-snug whitespace-pre-line"
          style={{
            fontSize: songFontSize,
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

  if (mode === "music" && state.music) {
    return (
      <div
        className={`${rootClassName} bg-black flex items-center justify-center transition-opacity duration-300`}
        style={transitionStyle}
      >
        <div className="text-center">
          {state.music.trackName && (
            <p
              className="text-white font-medium mb-2"
              style={{
                fontSize: compact ? "1.25rem" : "2.5rem",
                fontFamily: "'Sora', sans-serif",
                textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              }}
            >
              {state.music.trackName}
            </p>
          )}
          {state.music.artist && (
            <p
              className="text-white/60"
              style={{
                fontSize: compact ? "0.875rem" : "1.5rem",
                fontFamily: "'Sora', sans-serif",
                textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              }}
            >
              {state.music.artist}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (mode === "countdown" && state.countdown !== undefined) {
    const { remaining, label, theme = "default", isFadingOut = false } = state.countdown;
    const urgent = remaining <= 10 && remaining > 0;
    const opacity = isFadingOut ? 0 : 1;
    const style = { opacity: isTransitioning ? 0 : opacity, transition: countdownTransition };

    if (theme === "minimal") {
      return (
        <div
          className={`${rootClassName} bg-black flex flex-col items-center justify-center gap-4 transition-opacity duration-300`}
          style={style}
        >
          {label && (
            <p
              className="text-white/50 uppercase tracking-widest"
              style={{ fontFamily: "'Sora', sans-serif", fontSize: countdownLabelSize }}
            >
              {label}
            </p>
          )}
          <p
            className="font-mono leading-none"
            style={{
              fontSize: countdownTimeSize,
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

    if (theme === "default") {
      return (
        <div
          className={`${rootClassName} bg-black flex flex-col items-center justify-center gap-6 transition-opacity duration-300 relative overflow-hidden`}
          style={style}
        >
          <div className="countdown-bg-aurora" />
          {label && (
            <p
              className="text-white/60 uppercase tracking-widest relative z-10"
              style={{ fontFamily: "'Sora', sans-serif", fontSize: countdownLabelSize }}
            >
              {label}
            </p>
          )}
          <p
            className="font-mono leading-none relative z-10"
            style={{
              fontSize: countdownTimeSize,
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

    if (theme === "bold") {
      return (
        <div
          className={`${rootClassName} bg-black flex flex-col items-center justify-center transition-opacity duration-300 relative overflow-hidden`}
          style={style}
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
              className="text-white/70 uppercase tracking-[0.25em] mb-6 relative z-10"
              style={{ fontFamily: "'Sora', sans-serif", fontSize: compact ? "0.8rem" : "1.875rem" }}
            >
              {label}
            </p>
          )}
          <p
            className="font-mono leading-none relative z-10"
            style={{
              fontSize: countdownTimeSize,
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

    return (
      <div className={`${rootClassName} bg-black flex items-center justify-center`} style={{ opacity }}>
        <p className="font-mono text-white" style={{ fontSize: countdownTimeSize }}>
          {formatTime(remaining)}
        </p>
      </div>
    );
  }

  return <div className={`${rootClassName} bg-black`} />;
}
