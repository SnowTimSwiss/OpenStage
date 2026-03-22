import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { sendToOutput } from "../../lib/events";
import OutputRenderer from "../../output/OutputRenderer";
import type { OutputPayload, ShowItem, MusicItem } from "../../types";

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function ShowTab() {
  const slides = useStore((s) => s.slides);
  const videos = useStore((s) => s.videos);
  const songs = useStore((s) => s.songs);
  const pdfGroups = useStore((s) => s.pdfGroups);
  const music = useStore((s) => s.music);
  const playlists = useStore((s) => s.playlists);
  const countdownRemaining = useStore((s) => s.countdownRemaining);
  const countdownLabel = useStore((s) => s.countdownLabel);
  const countdownTheme = useStore((s) => s.countdownTheme);

  const showQueue = useStore((s) => s.showQueue);
  const showCurrentIndex = useStore((s) => s.showCurrentIndex);
  const addToShowQueue = useStore((s) => s.addToShowQueue);
  const removeFromShowQueue = useStore((s) => s.removeFromShowQueue);
  const setShowCurrentIndex = useStore((s) => s.setShowCurrentIndex);
  const showNextSlide = useStore((s) => s.showNextSlide);
  const showPreviousSlide = useStore((s) => s.showPreviousSlide);
  const reorderShowQueue = useStore((s) => s.reorderShowQueue);

  // Music controls for show mode
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

  const resetShow = useStore((s) => s.resetShow);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "ArrowRight" || e.code === "Space") {
        e.preventDefault();
        showNextSlide();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        showPreviousSlide();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        useStore.getState().showNext();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        useStore.getState().showPrevious();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showNextSlide, showPreviousSlide]);

  const currentItem = showCurrentIndex >= 0 && showCurrentIndex < showQueue.length ? showQueue[showCurrentIndex] : null;

  // Compute output payload for current show item
  const outputPayload = useMemo<OutputPayload>(() => {
    if (showCurrentIndex < 0 || showCurrentIndex >= showQueue.length) {
      return { mode: "blank" };
    }
    const item = showQueue[showCurrentIndex];
    return buildOutputPayload(item, {
      slides,
      videos,
      songs,
      pdfGroups,
      countdownRemaining,
      countdownLabel,
      countdownTheme,
      music,
      playlists,
    });
  }, [showCurrentIndex, showQueue, slides, videos, songs, pdfGroups, countdownRemaining, countdownLabel, countdownTheme, music, playlists]);

  // Send payload to output when it changes
  useEffect(() => {
    const current = useStore.getState();
    if (current.outputMode !== outputPayload.mode || current.isBlackout) {
      useStore.setState({ outputMode: outputPayload.mode, isBlackout: false });
    }
    console.log("[ShowTab] Sending to output:", outputPayload);
    sendToOutput(outputPayload).catch((err) => {
      console.error("[ShowTab] Failed to send to output:", err);
    });
  }, [outputPayload]);

  const previewPayload = useMemo<OutputPayload>(() => {
    return currentItem
      ? buildOutputPayload(currentItem, {
          slides,
          videos,
          songs,
          pdfGroups,
          countdownRemaining,
          countdownLabel,
          countdownTheme,
          music,
          playlists,
        })
      : { mode: "blank" };
  }, [currentItem, slides, videos, songs, pdfGroups, countdownRemaining, countdownLabel, countdownTheme, music, playlists]);

  function handleAddItem(type: ShowItem["type"], refId?: string, extra?: { musicTrackId?: string; playlistId?: string }) {
    const label = getItemLabel(type, refId, slides, videos, songs, pdfGroups, music, playlists, extra);
    const item: ShowItem = {
      id: crypto.randomUUID(),
      type,
      refId,
      label,
      slideIndex: type === "song" || type === "pdf" ? 0 : undefined,
      musicTrackId: extra?.musicTrackId,
      playlistId: extra?.playlistId,
    };
    addToShowQueue(item);
    setIsAddModalOpen(false);
  }

  function toggleShowMusicOverlay(_itemId: string) {
    // Music overlays on the output are disabled in show mode.
  }

  function handleItemClick(index: number) {
    const { showQueue, music, playlists } = useStore.getState();
    const item = showQueue[index];
    
    // Handle music playback for music/playlist items
    if (item && (item.type === "music" || item.type === "playlist")) {
      let trackToPlay: MusicItem | undefined;

      if (item.type === "music" && item.musicTrackId) {
        trackToPlay = music.find((m) => m.id === item.musicTrackId);
      } else if (item.type === "playlist" && item.playlistId) {
        const playlist = playlists.find((p) => p.id === item.playlistId);
        if (playlist && playlist.tracks.length > 0) {
          trackToPlay = playlist.tracks[0];
        }
      }

      if (trackToPlay) {
        const trackIndex = music.findIndex((m) => m.id === trackToPlay!.id);
        if (trackIndex >= 0) {
          useStore.getState().setMusicIndex(trackIndex);
          useStore.getState().setMusicPlaying(true);
        }
      }
    }
    
    setShowCurrentIndex(index);
  }

  function moveItemToFinalIndex(sourceIndex: number, targetIndex: number) {
    if (
      sourceIndex < 0 ||
      sourceIndex >= showQueue.length ||
      targetIndex < 0 ||
      targetIndex >= showQueue.length ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    reorderShowQueue(sourceIndex, targetIndex);

    if (showCurrentIndex === sourceIndex) {
      setShowCurrentIndex(targetIndex);
    } else if (sourceIndex < showCurrentIndex && targetIndex >= showCurrentIndex) {
      setShowCurrentIndex(showCurrentIndex - 1);
    } else if (sourceIndex > showCurrentIndex && targetIndex <= showCurrentIndex) {
      setShowCurrentIndex(showCurrentIndex + 1);
    }
  }

  function getTotalSlides(item: ShowItem) {
    if (item.type === "song" && item.refId) {
      const song = songs.find((s) => s.id === item.refId);
      return song?.slides.length ?? 1;
    }
    if (item.type === "pdf" && item.refId) {
      const group = pdfGroups.find((g) => g.id === item.refId);
      return group?.pages.length ?? 1;
    }
    return 1;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Show Mode</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "#555" }}>
            ← → Slides • ↑↓ Items
          </span>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: "#f97316", color: "white", border: "1px solid #f97316" }}
          >
            + Add to Show
          </button>
          {showQueue.length > 0 && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: "#2a0a0a", color: "#ef4444", border: "1px solid #333" }}
              title="Show Queue leeren"
            >
              🗑️ Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[30%] flex flex-col border-r" style={{ borderColor: "#252525" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#555" }}>
              Queue ({showQueue.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {showQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <span className="text-3xl mb-2">📋</span>
                <p className="text-xs" style={{ color: "#555" }}>
                  No items in queue
                </p>
                <p className="text-[10px] mt-1" style={{ color: "#444" }}>
                  Click "Add to Show" to build the running order.
                </p>
              </div>
            ) : (
              <>
                {showQueue.map((item, index) => {
                  const isActive = index === showCurrentIndex;
                  const totalSlides = getTotalSlides(item);
                  const currentSlide = (item.slideIndex ?? 0) + 1;

                  return (
                    <div key={item.id}>
                      <div
                        onClick={() => handleItemClick(index)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border ${
                          isActive
                            ? "bg-[#f9731620] border-[#f9731640]"
                            : "bg-[#141414] border-[#1e1e1e] hover:border-[#333]"
                        }`}
                      >
                        <span
                          className="text-[10px] cursor-grab active:cursor-grabbing select-none"
                          style={{ color: "#444" }}
                        >
                          ⋮⋮
                        </span>
                        <span className="text-lg">{getItemIcon(item.type)}</span>

                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${isActive ? "text-[#f97316]" : "text-[#ccc]"}`}>
                            {item.label}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-[9px]" style={{ color: "#555" }}>
                              {item.type}
                            </p>
                            {(item.type === "song" || item.type === "pdf") && (
                              <span className="text-[9px] px-1 rounded" style={{ background: "#222", color: "#666" }}>
                                {currentSlide}/{totalSlides}
                              </span>
                            )}
                            {false && (item.type === "music" || item.type === "playlist") && (
                              <span
                                className={`text-[9px] px-1 rounded cursor-pointer transition-colors ${
                                  item.showMusicOverlay !== false
                                    ? "bg-[#f9731620] text-[#f97316]"
                                    : "bg-[#222] text-gray-500"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleShowMusicOverlay(item.id);
                                }}
                                title={item.showMusicOverlay !== false ? "Overlay anzeige: Titel & Künstler" : "Overlay aus: Blackscreen"}
                              >
                                {item.showMusicOverlay !== false ? "👁" : "🚫"}
                              </span>
                            )}
                          </div>
                        </div>

                        {isActive && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "#f97316", color: "white" }}
                          >
                            LIVE
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItemToFinalIndex(index, index - 1);
                          }}
                          disabled={index === 0}
                          className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-30"
                          style={{ color: "#777", border: "1px solid #2a2a2a", background: "#181818" }}
                          title="Nach oben"
                        >
                          ↑
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItemToFinalIndex(index, index + 1);
                          }}
                          disabled={index === showQueue.length - 1}
                          className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-30"
                          style={{ color: "#777", border: "1px solid #2a2a2a", background: "#181818" }}
                          title="Nach unten"
                        >
                          ↓
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromShowQueue(item.id);
                          }}
                          className="text-[10px] p-1 rounded hover:bg-[#222]"
                          style={{ color: "#555" }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {showQueue.length > 0 && (
            <div className="px-3 py-2 border-t flex flex-col gap-2" style={{ borderColor: "#1a1a1a" }}>
              {/* Navigation Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={showPreviousSlide}
                  className="flex-1 text-xs py-1.5 rounded-lg transition-all"
                  style={{ background: "#222", color: "#ccc", border: "1px solid #333" }}
                >
                  ← Prev
                </button>
                <button
                  onClick={showNextSlide}
                  className="flex-1 text-xs py-1.5 rounded-lg transition-all"
                  style={{ background: "#f97316", color: "white", border: "1px solid #f97316" }}
                >
                  Next →
                </button>
              </div>

              {/* Music Controls (when music item is active) */}
              {currentItem && (currentItem.type === "music" || currentItem.type === "playlist") && (
                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "#252525" }}>
                  <button
                    onClick={playPrevMusic}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                    style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}
                    title="Vorheriger Track"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => setMusicPlaying(!musicPlaying)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{
                      background: musicPlaying ? "#f97316" : "#1a1a1a",
                      color: musicPlaying ? "white" : "#aaa",
                      border: musicPlaying ? "1px solid #f97316" : "1px solid #333",
                      boxShadow: musicPlaying ? "0 0 12px #f9731640" : "none",
                    }}
                    title={musicPlaying ? "Pause" : "Play"}
                  >
                    {musicPlaying ? "⏸" : "▶"}
                  </button>
                  <button
                    onClick={playNextMusic}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                    style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}
                    title="Nächster Track"
                  >
                    ⏭
                  </button>

                  {/* Progress Bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[9px] font-mono mb-0.5" style={{ color: "#666" }}>
                      <span>{formatTime(musicCurrentTime)}</span>
                      <span>{formatTime(musicDuration)}</span>
                    </div>
                    <div className="relative h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ width: `${musicDuration > 0 ? (musicCurrentTime / musicDuration) * 100 : 0}%`, background: "#f97316" }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, musicDuration)}
                        step={0.25}
                        value={musicCurrentTime}
                        onChange={(e) => seekMusic(Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: "#666" }}>🔊</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-16 h-1"
                      style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${musicVolume * 100}%, #1a1a1a ${musicVolume * 100}%, #1a1a1a 100%)`,
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#555" }}>
              Preview
            </span>
            {(currentItem?.type === "song" || currentItem?.type === "pdf") && (
              <span className="text-[10px]" style={{ color: "#666" }}>
                {(currentItem.slideIndex ?? 0) + 1} / {getTotalSlides(currentItem)} Folien
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden p-4">
            {currentItem ? (
              <div className={`h-full ${currentItem.type === "song" || currentItem.type === "pdf" ? "flex gap-4" : "flex flex-col"}`}>
                {/* Main Preview */}
                <div className={`${currentItem.type === "song" || currentItem.type === "pdf" ? "flex-1" : "w-full"} aspect-video bg-[#0a0a0a] rounded-lg border border-[#1e1e1e] overflow-hidden relative`}>
                  <OutputRenderer state={previewPayload} embedded muteVideo videoRef={previewVideoRef} />
                </div>

                {/* Slide Grid for Songs and PDFs */}
                {(currentItem.type === "song" || currentItem.type === "pdf") && (
                  <div className="w-[320px] flex-shrink-0 overflow-y-auto pr-2">
                    <SlideGrid
                      item={currentItem}
                      songs={songs}
                      pdfGroups={pdfGroups}
                      onSelectSlide={(index) => {
                        useStore.setState((s) => ({
                          showQueue: s.showQueue.map((item) =>
                            item.id === currentItem.id ? { ...item, slideIndex: index } : item
                          ),
                        }));
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <span className="text-4xl mb-3 block">🎬</span>
                <p className="text-sm" style={{ color: "#555" }}>
                  No item selected
                </p>
                <p className="text-xs mt-1" style={{ color: "#444" }}>
                  Click an item in the queue to preview it.
                </p>
              </div>
            )}
          </div>

          {currentItem && (
            <div className="px-4 py-3 border-t" style={{ borderColor: "#1a1a1a" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getItemIcon(currentItem.type)}</span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#ccc" }}>
                      {currentItem.label}
                    </p>
                    <p className="text-[10px]" style={{ color: "#555" }}>
                      Type: {currentItem.type}
                      {(currentItem.type === "song" || currentItem.type === "pdf") && (
                        <span>
                          {" "}
                          • Slide: {(currentItem.slideIndex ?? 0) + 1}/{getTotalSlides(currentItem)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={showPreviousSlide}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "#222", color: "#ccc", border: "1px solid #333" }}
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={showNextSlide}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "#f97316", color: "white", border: "1px solid #f97316" }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <AddToShowModal
          slides={slides}
          videos={videos}
          songs={songs}
          pdfGroups={pdfGroups}
          music={music}
          playlists={playlists}
          onAdd={handleAddItem}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowResetConfirm(false)}>
          <div
            className="w-[400px] rounded-xl overflow-hidden"
            style={{ background: "#1a1a1a", border: "1px solid #333" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "#333" }}>
              <h3 className="text-sm font-semibold text-white">Show Queue leeren?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm" style={{ color: "#ccc" }}>
                Dies entfernt alle Items aus der Show Queue. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "#333" }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-xs px-4 py-2 rounded font-medium"
                style={{ background: "#2a2a2a", color: "#888" }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { resetShow(); setShowResetConfirm(false); }}
                className="text-xs px-4 py-2 rounded font-medium"
                style={{ background: "#ef4444", color: "white" }}
              >
                Leeren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildOutputPayload(
  item: ShowItem,
  data: {
    slides: any[];
    videos: any[];
    songs: any[];
    pdfGroups: any[];
    countdownRemaining: number;
    countdownLabel: string;
    countdownTheme: any;
    music: any[];
    playlists: any[];
  }
): OutputPayload {
  const { slides, videos, songs, pdfGroups, countdownRemaining, countdownLabel, countdownTheme, music, playlists } = data;

  switch (item.type) {
    case "image": {
      const slide = slides.find((s) => s.id === item.refId);
      return slide ? { mode: "image", image: { src: slide.src } } : { mode: "blank" };
    }
    case "video": {
      const video = videos.find((v) => v.id === item.refId);
      return video ? { mode: "video", video: { src: video.src, playing: true } } : { mode: "blank" };
    }
    case "song": {
      const song = songs.find((s) => s.id === item.refId);
      if (!song) return { mode: "blank" };
      const slideIdx = item.slideIndex ?? 0;
      const slide = song.slides[slideIdx];
      if (!slide) return { mode: "blank" };
      return {
        mode: "song",
        song: {
          text: slide.text,
          title: song.title,
          index: slideIdx,
          total: song.slides.length,
        },
      };
    }
    case "pdf": {
      const group = pdfGroups.find((g) => g.id === item.refId);
      if (!group) return { mode: "blank" };
      const slideIdx = item.slideIndex ?? 0;
      const page = group.pages[slideIdx];
      if (!page) return { mode: "blank" };
      return { mode: "image", image: { src: page.src } };
    }
    case "countdown":
      return {
        mode: "countdown",
        countdown: {
          remaining: countdownRemaining,
          label: countdownLabel,
          running: true,
          theme: countdownTheme,
        },
      };
    case "music": {
      if (!item.musicTrackId || !music.find((m) => m.id === item.musicTrackId)) return { mode: "blank" };
      return { mode: "blackout" };
    }
    case "playlist": {
      const playlist = item.playlistId ? playlists.find((p) => p.id === item.playlistId) : null;
      if (!playlist || playlist.tracks.length === 0) return { mode: "blank" };
      return { mode: "blackout" };
    }
    default:
      return { mode: "blank" };
  }
}

function getItemIcon(type: ShowItem["type"]): string {
  switch (type) {
    case "image":
      return "🖼️";
    case "video":
      return "🎬";
    case "song":
      return "🎵";
    case "countdown":
      return "⏱️";
    case "pdf":
      return "📊";
    case "music":
      return "🎶";
    case "playlist":
      return "📀";
  }
}

function getItemLabel(
  type: ShowItem["type"],
  refId: string | undefined,
  slides: any[],
  videos: any[],
  songs: any[],
  pdfGroups: any[],
  music: any[],
  playlists: any[],
  extra?: { musicTrackId?: string; playlistId?: string }
): string {
  switch (type) {
    case "image": {
      const slide = slides.find((s) => s.id === refId);
      return slide ? slide.name : "Image";
    }
    case "video": {
      const video = videos.find((v) => v.id === refId);
      return video ? video.name : "Video";
    }
    case "song": {
      const song = songs.find((s) => s.id === refId);
      return song ? `Song: ${song.title}` : "Song";
    }
    case "pdf": {
      const group = pdfGroups.find((g) => g.id === refId);
      return group ? `PowerPoint: ${group.name}` : "Document";
    }
    case "countdown":
      return "Countdown";
    case "music": {
      const track = extra?.musicTrackId ? music.find((m) => m.id === extra.musicTrackId) : null;
      return track ? `Musik: ${track.name}` : "Musik";
    }
    case "playlist": {
      const playlist = extra?.playlistId ? playlists.find((p) => p.id === extra.playlistId) : null;
      return playlist ? `Playlist: ${playlist.name}` : "Playlist";
    }
  }
}

interface AddToShowModalProps {
  slides: any[];
  videos: any[];
  songs: any[];
  pdfGroups: any[];
  music: any[];
  playlists: any[];
  onAdd: (type: ShowItem["type"], refId?: string, extra?: { musicTrackId?: string; playlistId?: string }) => void;
  onClose: () => void;
}

function AddToShowModal({ slides, videos, songs, pdfGroups, music, playlists, onAdd, onClose }: AddToShowModalProps) {
  const [activeSection, setActiveSection] = useState<"media" | "songs" | "pdf" | "countdown" | "music">("media");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-[500px] max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: "#1a1a1a", border: "1px solid #333" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#333" }}>
          <h3 className="text-sm font-semibold text-white">Add to Show</h3>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded hover:bg-[#333]" style={{ color: "#888" }}>
            ✕
          </button>
        </div>

        <div className="flex border-b" style={{ borderColor: "#333" }}>
          <button
            onClick={() => setActiveSection("media")}
            className={`flex-1 text-xs py-2 transition-all ${
              activeSection === "media" ? "text-[#f97316] border-b-2 border-[#f97316]" : "text-[#888]"
            }`}
          >
            📁 Media
          </button>
          <button
            onClick={() => setActiveSection("songs")}
            className={`flex-1 text-xs py-2 transition-all ${
              activeSection === "songs" ? "text-[#f97316] border-b-2 border-[#f97316]" : "text-[#888]"
            }`}
          >
            🎵 Songs
          </button>
          <button
            onClick={() => setActiveSection("pdf")}
            className={`flex-1 text-xs py-2 transition-all ${
              activeSection === "pdf" ? "text-[#f97316] border-b-2 border-[#f97316]" : "text-[#888]"
            }`}
          >
            📊 PowerPoint
          </button>
          <button
            onClick={() => setActiveSection("music")}
            className={`flex-1 text-xs py-2 transition-all ${
              activeSection === "music" ? "text-[#f97316] border-b-2 border-[#f97316]" : "text-[#888]"
            }`}
          >
            🎶 Musik
          </button>
          <button
            onClick={() => setActiveSection("countdown")}
            className={`flex-1 text-xs py-2 transition-all ${
              activeSection === "countdown" ? "text-[#f97316] border-b-2 border-[#f97316]" : "text-[#888]"
            }`}
          >
            ⏱️ Countdown
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {activeSection === "media" && (
            <div className="space-y-3">
              {slides.length === 0 && videos.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "#666" }}>
                  No media available. Add media first.
                </p>
              ) : (
                <>
                  {slides.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#555" }}>
                        Images
                      </p>
                      <div className="space-y-1">
                        {slides.map((slide) => (
                          <button
                            key={slide.id}
                            onClick={() => onAdd("image", slide.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                            style={{ background: "#141414", border: "1px solid #222" }}
                          >
                            <span className="text-lg">🖼️</span>
                            <span className="text-xs truncate" style={{ color: "#ccc" }}>
                              {slide.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {videos.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#555" }}>
                        Videos
                      </p>
                      <div className="space-y-1">
                        {videos.map((video) => (
                          <button
                            key={video.id}
                            onClick={() => onAdd("video", video.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                            style={{ background: "#141414", border: "1px solid #222" }}
                          >
                            <span className="text-lg">🎬</span>
                            <span className="text-xs truncate" style={{ color: "#ccc" }}>
                              {video.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeSection === "songs" && (
            <div className="space-y-1">
              {songs.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "#666" }}>
                  No songs available. Create songs first.
                </p>
              ) : (
                songs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => onAdd("song", song.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                    style={{ background: "#141414", border: "1px solid #222" }}
                  >
                    <span className="text-lg">🎵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "#ccc" }}>
                        {song.title}
                      </p>
                      {song.artist && (
                        <p className="text-[9px] truncate" style={{ color: "#666" }}>
                          {song.artist}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeSection === "pdf" && (
            <div className="space-y-1">
              {pdfGroups.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "#666" }}>
                  Keine PowerPoint-Präsentationen verfügbar. Importiere PDFs zuerst.
                </p>
              ) : (
                pdfGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => onAdd("pdf", group.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                    style={{ background: "#141414", border: "1px solid #222" }}
                  >
                    <span className="text-lg">📊</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "#ccc" }}>
                        {group.name}
                      </p>
                      <p className="text-[9px] truncate" style={{ color: "#666" }}>
                        {group.pages.length} Seiten
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeSection === "countdown" && (
            <div className="space-y-1">
              <button
                onClick={() => onAdd("countdown")}
                className="w-full flex items-center gap-2 p-3 rounded-lg transition-all hover:bg-[#222]"
                style={{ background: "#141414", border: "1px solid #222" }}
              >
                <span className="text-2xl">⏱️</span>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: "#ccc" }}>
                    Add Countdown
                  </p>
                  <p className="text-xs" style={{ color: "#666" }}>
                    Add the current countdown timer to the show
                  </p>
                </div>
              </button>
            </div>
          )}

          {activeSection === "music" && (
            <div className="space-y-4">
              {/* Single Tracks */}
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#555" }}>
                  Einzelne Lieder
                </p>
                <div className="space-y-1">
                  {music.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: "#666" }}>
                      Keine Musik verfügbar. Füge zuerst Musik im Musik-Tab hinzu.
                    </p>
                  ) : (
                    music.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => onAdd("music", undefined, { musicTrackId: track.id })}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                        style={{ background: "#141414", border: "1px solid #222" }}
                      >
                        <span className="text-lg">🎶</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: "#ccc" }}>
                            {track.name}
                          </p>
                          {track.artist && (
                            <p className="text-[9px] truncate" style={{ color: "#666" }}>
                              {track.artist}
                            </p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Playlists */}
              {playlists.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#555" }}>
                    Playlists
                  </p>
                  <div className="space-y-1">
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => onAdd("playlist", undefined, { playlistId: playlist.id })}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                        style={{ background: "#141414", border: "1px solid #222" }}
                      >
                        <span className="text-lg">📀</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: "#ccc" }}>
                            {playlist.name}
                          </p>
                          <p className="text-[9px] truncate" style={{ color: "#666" }}>
                            {playlist.tracks.length} Tracks
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide Grid Component (Pro Presenter Style)
// ─────────────────────────────────────────────────────────────────────────────

interface SlideGridProps {
  item: ShowItem;
  songs: any[];
  pdfGroups: any[];
  onSelectSlide: (index: number) => void;
}

function SlideGrid({ item, songs, pdfGroups, onSelectSlide }: SlideGridProps) {
  const currentSlideIndex = item.slideIndex ?? 0;

  // Get slides for song
  if (item.type === "song" && item.refId) {
    const song = songs.find((s) => s.id === item.refId);
    if (!song || !song.slides) return null;

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {song.slides.map((slide: any, index: number) => (
            <button
              key={slide.id}
              onClick={() => onSelectSlide(index)}
              className={`aspect-video rounded-lg border-2 overflow-hidden transition-all hover:scale-105 ${
                index === currentSlideIndex
                  ? "border-[#f97316] ring-2 ring-[#f9731640]"
                  : "border-[#333] hover:border-[#555]"
              }`}
            >
              <div className="w-full h-full flex flex-col p-1.5 text-left">
                {slide.label && (
                  <div className="text-[8px] font-medium mb-0.5 truncate" style={{ color: "#f97316" }}>
                    {slide.label}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="text-[9px] leading-tight whitespace-pre-line" style={{ color: "#ccc" }}>
                    {slide.text.slice(0, 80)}{slide.text.length > 80 ? '...' : ''}
                  </p>
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: "#555" }}>
                  {index + 1} / {song.slides.length}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Get slides for PDF
  if (item.type === "pdf" && item.refId) {
    const group = pdfGroups.find((g) => g.id === item.refId);
    if (!group || !group.pages) return null;

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {group.pages.map((page: any, index: number) => (
            <button
              key={page.id}
              onClick={() => onSelectSlide(index)}
              className={`aspect-video rounded-lg border-2 overflow-hidden transition-all hover:scale-105 ${
                index === currentSlideIndex
                  ? "border-[#f97316] ring-2 ring-[#f9731640]"
                  : "border-[#333] hover:border-[#555]"
              }`}
            >
              <div className="w-full h-full relative">
                <img src={page.src} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-1 right-1 text-[8px] px-1 py-0.5 rounded bg-black/80 text-white">
                  {index + 1}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
