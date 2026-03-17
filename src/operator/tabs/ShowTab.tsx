import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../store/useStore";
import { sendToOutput } from "../../lib/events";
import OutputRenderer from "../../output/OutputRenderer";
import type { OutputPayload, ShowItem } from "../../types";

export default function ShowTab() {
  const slides = useStore((s) => s.slides);
  const videos = useStore((s) => s.videos);
  const songs = useStore((s) => s.songs);
  const pptxGroups = useStore((s) => s.pptxGroups);
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const queueListRef = useRef<HTMLDivElement>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const lastHoverIndexRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (showCurrentIndex < 0 || showCurrentIndex >= showQueue.length) return;
    const item = showQueue[showCurrentIndex];
    const payload = buildOutputPayload(item, {
      slides,
      videos,
      songs,
      pptxGroups,
      countdownRemaining,
      countdownLabel,
      countdownTheme,
    });
    const current = useStore.getState();
    if (current.outputMode !== payload.mode || current.isBlackout) {
      useStore.setState({ outputMode: payload.mode, isBlackout: false });
    }
    sendToOutput(payload);
  }, [
    showCurrentIndex,
    showQueue,
    slides,
    videos,
    songs,
    pptxGroups,
    countdownRemaining,
    countdownLabel,
    countdownTheme,
  ]);

  const currentItem =
    showCurrentIndex >= 0 && showCurrentIndex < showQueue.length ? showQueue[showCurrentIndex] : null;

  const previewPayload = useMemo(
    () =>
      currentItem
        ? buildOutputPayload(currentItem, {
            slides,
            videos,
            songs,
            pptxGroups,
            countdownRemaining,
            countdownLabel,
            countdownTheme,
          })
        : { mode: "blank" as const },
    [currentItem, slides, videos, songs, pptxGroups, countdownRemaining, countdownLabel, countdownTheme]
  );

  function handleAddItem(type: ShowItem["type"], refId?: string) {
    const label = getItemLabel(type, refId, slides, videos, songs, pptxGroups);
    const item: ShowItem = {
      id: crypto.randomUUID(),
      type,
      refId,
      label,
      slideIndex: type === "song" || type === "pptx" ? 0 : undefined,
    };
    addToShowQueue(item);
    setIsAddModalOpen(false);
  }

  function handleItemClick(index: number) {
    setShowCurrentIndex(index);
  }

  function moveDraggedItem(sourceIndex: number | null, targetIndex: number) {
    if (sourceIndex === null || sourceIndex === targetIndex) {
      setDraggedIndex(null);
      setDropIndex(null);
      draggedIndexRef.current = null;
      lastHoverIndexRef.current = null;
      return;
    }
    if (sourceIndex < 0 || sourceIndex >= showQueue.length) {
      setDraggedIndex(null);
      setDropIndex(null);
      draggedIndexRef.current = null;
      lastHoverIndexRef.current = null;
      return;
    }

    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const boundedTargetIndex = Math.max(0, Math.min(showQueue.length - 1, adjustedTargetIndex));
    reorderShowQueue(sourceIndex, boundedTargetIndex);

    if (showCurrentIndex === sourceIndex) {
      setShowCurrentIndex(boundedTargetIndex);
    } else if (sourceIndex < showCurrentIndex && boundedTargetIndex >= showCurrentIndex) {
      setShowCurrentIndex(showCurrentIndex - 1);
    } else if (sourceIndex > showCurrentIndex && boundedTargetIndex <= showCurrentIndex) {
      setShowCurrentIndex(showCurrentIndex + 1);
    }

    setDraggedIndex(null);
    setDropIndex(null);
    draggedIndexRef.current = null;
    lastHoverIndexRef.current = null;
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

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    setDropIndex(index);
    draggedIndexRef.current = index;
    lastHoverIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragEnd() {
    const source = draggedIndexRef.current;
    const target = dropIndex ?? lastHoverIndexRef.current;
    if (
      source !== null &&
      target !== null &&
      target !== source
    ) {
      moveDraggedItem(source, target);
      return;
    }
    setDraggedIndex(null);
    setDropIndex(null);
    draggedIndexRef.current = null;
    lastHoverIndexRef.current = null;
  }

  function getDropTargetIndex(e: React.DragEvent, index: number) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    return offsetY > rect.height / 2 ? index + 1 : index;
  }

  function getDropIndexFromClientY(clientY: number) {
    const root = queueListRef.current;
    if (!root) return showQueue.length;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-queue-item='true']"));
    for (const item of items) {
      const idx = Number(item.dataset.index);
      if (!Number.isInteger(idx)) continue;
      const rect = item.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return idx;
    }

    return showQueue.length;
  }

  function handleQueueDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = getDropIndexFromClientY(e.clientY);
    lastHoverIndexRef.current = target;
    if (dropIndex !== target) setDropIndex(target);
  }

  function handleQueueDrop(e: React.DragEvent) {
    e.preventDefault();
    moveDraggedItem(getDraggedIndex(e), getDropIndexFromClientY(e.clientY));
  }

  function getDraggedIndex(e: React.DragEvent) {
    const raw = e.dataTransfer.getData("text/plain");
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
    return draggedIndexRef.current;
  }

  function getTotalSlides(item: ShowItem) {
    if (item.type === "song" && item.refId) {
      const song = songs.find((s) => s.id === item.refId);
      return song?.slides.length ?? 1;
    }
    if (item.type === "pptx" && item.refId) {
      const group = pptxGroups.find((g) => g.id === item.refId);
      return group?.slides.length ?? 1;
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
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[30%] flex flex-col border-r" style={{ borderColor: "#252525" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#555" }}>
              Queue ({showQueue.length})
            </span>
          </div>

          <div
            ref={queueListRef}
            className="flex-1 overflow-y-auto p-2 flex flex-col gap-1"
            onDragOver={handleQueueDragOver}
            onDrop={handleQueueDrop}
          >
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
                  const isDragging = draggedIndex === index;
                  const totalSlides = getTotalSlides(item);
                  const currentSlide = (item.slideIndex ?? 0) + 1;
                  const showDropBefore = draggedIndex !== null && dropIndex === index && draggedIndex !== index;

                  return (
                    <div key={item.id} className="flex flex-col" data-queue-item="true" data-index={index}>
                      <div
                        onDragEnter={() => {
                          if (dropIndex !== index) setDropIndex(index);
                          lastHoverIndexRef.current = index;
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dropIndex !== index) setDropIndex(index);
                          lastHoverIndexRef.current = index;
                        }}
                        className={`h-3 rounded transition-all ${showDropBefore ? "bg-[#f97316]" : "bg-transparent"}`}
                      />
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => {
                          const target = getDropTargetIndex(e, index);
                          if (dropIndex !== target) setDropIndex(target);
                          lastHoverIndexRef.current = target;
                        }}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleItemClick(index)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border ${
                          isActive
                            ? "bg-[#f9731620] border-[#f9731640]"
                            : isDragging
                              ? "bg-[#222] border-[#444] opacity-50"
                              : "bg-[#141414] border-[#1e1e1e] hover:border-[#333]"
                        }`}
                      >
                        <span className="text-[10px] cursor-grab active:cursor-grabbing select-none" style={{ color: "#444" }}>
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
                            {(item.type === "song" || item.type === "pptx") && (
                              <span className="text-[9px] px-1 rounded" style={{ background: "#222", color: "#666" }}>
                                {currentSlide}/{totalSlides}
                              </span>
                            )}
                          </div>
                        </div>

                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f97316", color: "white" }}>
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

                <div
                  onDragEnter={() => {
                    if (dropIndex !== showQueue.length) setDropIndex(showQueue.length);
                    lastHoverIndexRef.current = showQueue.length;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropIndex !== showQueue.length) setDropIndex(showQueue.length);
                    lastHoverIndexRef.current = showQueue.length;
                  }}
                  className={`h-3 rounded transition-all ${
                    draggedIndex !== null && dropIndex === showQueue.length ? "bg-[#f97316]" : "bg-transparent"
                  }`}
                />
              </>
            )}
          </div>

          {showQueue.length > 0 && (
            <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: "#1a1a1a" }}>
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
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#555" }}>
              Preview
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            {currentItem ? (
              <div className="w-full h-full max-h-[500px] aspect-video bg-[#0a0a0a] rounded-lg border border-[#1e1e1e] overflow-hidden relative">
                <OutputRenderer state={previewPayload} embedded muteVideo videoRef={previewVideoRef} />
                {(currentItem.type === "song" || currentItem.type === "pptx") && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <span className="text-[10px] px-2 py-1 rounded" style={{ background: "#222", color: "#888" }}>
                      Slide {(currentItem.slideIndex ?? 0) + 1} / {getTotalSlides(currentItem)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
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
                      {(currentItem.type === "song" || currentItem.type === "pptx") && (
                        <span> • Slide: {(currentItem.slideIndex ?? 0) + 1}/{getTotalSlides(currentItem)}</span>
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
          pptxGroups={pptxGroups}
          onAdd={handleAddItem}
          onClose={() => setIsAddModalOpen(false)}
        />
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
    pptxGroups: any[];
    countdownRemaining: number;
    countdownLabel: string;
    countdownTheme: any;
  }
): OutputPayload {
  const { slides, videos, songs, pptxGroups, countdownRemaining, countdownLabel, countdownTheme } = data;

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
    case "pptx": {
      const group = pptxGroups.find((g) => g.id === item.refId);
      if (!group) return { mode: "blank" };
      const slideIdx = item.slideIndex ?? 0;
      const slide = group.slides[slideIdx];
      if (!slide) return { mode: "blank" };
      if (slide.html) return { mode: "html", html: { content: slide.html } };
      return { mode: "image", image: { src: slide.src } };
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
    case "pptx":
      return "📊";
  }
}

function getItemLabel(
  type: ShowItem["type"],
  refId: string | undefined,
  slides: any[],
  videos: any[],
  songs: any[],
  pptxGroups: any[]
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
    case "pptx": {
      const group = pptxGroups.find((g) => g.id === refId);
      return group ? `PPTX: ${group.name}` : "Presentation";
    }
    case "countdown":
      return "Countdown";
  }
}

interface AddToShowModalProps {
  slides: any[];
  videos: any[];
  songs: any[];
  pptxGroups: any[];
  onAdd: (type: ShowItem["type"], refId?: string) => void;
  onClose: () => void;
}

function AddToShowModal({ slides, videos, songs, pptxGroups, onAdd, onClose }: AddToShowModalProps) {
  const [activeSection, setActiveSection] = useState<"media" | "songs" | "pptx" | "countdown">("media");

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
            onClick={() => setActiveSection("pptx")}
            className={`flex-1 text-xs py-2 transition-all ${
              activeSection === "pptx" ? "text-[#f97316] border-b-2 border-[#f97316]" : "text-[#888]"
            }`}
          >
            📊 PPTX
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

          {activeSection === "pptx" && (
            <div className="space-y-1">
              {pptxGroups.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "#666" }}>
                  No PowerPoint presentations available. Import PPTX first.
                </p>
              ) : (
                pptxGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => onAdd("pptx", group.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-[#222]"
                    style={{ background: "#141414", border: "1px solid #222" }}
                  >
                    <span className="text-lg">📊</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "#ccc" }}>
                        {group.name}
                      </p>
                      <p className="text-[9px] truncate" style={{ color: "#666" }}>
                        {group.slides.length} slides
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
        </div>
      </div>
    </div>
  );
}
