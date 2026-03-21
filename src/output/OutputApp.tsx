import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { OUTPUT_EVENT, OUTPUT_READY_EVENT, VIDEO_CTRL_EVENT } from "../lib/events";
import type { OutputPayload } from "../types";
import OutputRenderer from "./OutputRenderer";

export default function OutputApp() {
  const [state, setState] = useState<OutputPayload>({ mode: "blank" });
  const [pendingState, setPendingState] = useState<OutputPayload | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [monitorIndex, setMonitorIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentModeRef = useRef<OutputPayload["mode"]>("blank");
  const transitioningRef = useRef(false);
  const TRANSITION_MS = 260;

  useEffect(() => {
    // Parse monitor index from URL
    const params = new URLSearchParams(window.location.search);
    const monitorParam = params.get("monitor");
    const idx = monitorParam !== null ? parseInt(monitorParam, 10) : null;
    if (!isNaN(idx!)) {
      setMonitorIndex(idx);
      // Update window title with monitor number
      const windowLabel = `output-${idx}`;
      WebviewWindow.getByLabel(windowLabel).then((w) => {
        if (w) {
          w.setTitle(`OpenStage — Output ${idx! + 1}`);
        }
      });
    }
  }, []);

  useEffect(() => {
    currentModeRef.current = state.mode;
  }, [state.mode]);

  useEffect(() => {
    transitioningRef.current = isTransitioning;
  }, [isTransitioning]);

  useEffect(() => {
    if (!isTransitioning || !pendingState) return;

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setState(pendingState);
      currentModeRef.current = pendingState.mode;
      setPendingState(null);
      setVideoError(false);
      transitioningRef.current = false;
      setIsTransitioning(false);
    }, TRANSITION_MS);

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [isTransitioning, pendingState]);

  useEffect(() => {
    if (state.mode === "video" && state.video?.playing && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch((err) => {
        console.error("Video play error:", err);
        setVideoError(true);
      });
    }
  }, [state]);

  useEffect(() => {
    let disposed = false;
    let unlistenOutput: (() => void) | null = null;
    let unlistenCtrl: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenOutput = await listen<OutputPayload>(OUTPUT_EVENT, (e) => {
        console.log("[OutputApp] Received output event:", e.payload);
        const next = e.payload;

        if (transitioningRef.current) {
          console.log("[OutputApp] Still transitioning, setting pending state");
          setPendingState(next);
          return;
        }

        if (next.mode !== currentModeRef.current) {
          console.log("[OutputApp] Mode changed, starting transition");
          transitioningRef.current = true;
          setPendingState(next);
          setIsTransitioning(true);
          return;
        }

        console.log("[OutputApp] Same mode, updating state directly");
        currentModeRef.current = next.mode;
        setState(next);
      });

      unlistenCtrl = await listen<{ action: string }>(VIDEO_CTRL_EVENT, (e) => {
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

      if (disposed) {
        unlistenOutput?.();
        unlistenCtrl?.();
        return;
      }

      await emit(OUTPUT_READY_EVENT, {});
    };

    void setupListeners();

    return () => {
      disposed = true;
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      unlistenOutput?.();
      unlistenCtrl?.();
    };
  }, []);

  return (
    <OutputRenderer
      state={state}
      isTransitioning={isTransitioning}
      videoRef={videoRef}
      videoError={videoError}
      onVideoEnded={() => {
        currentModeRef.current = "blank";
        setState({ mode: "blank" });
      }}
      onVideoError={() => setVideoError(true)}
      onVideoPlay={() => setVideoError(false)}
    />
  );
}
