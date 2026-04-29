import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import { openOutputWindow, sendVideoControl } from "../../lib/events";

type FilterType = "all" | "image" | "video" | "pdf";

function alternateAssetUrl(src: string): string | null {
  // Tauri can expose assets via `asset://localhost/...` and `http(s)://asset.localhost/...`.
  const assetLocalhostPrefix = "asset://localhost/";
  const httpPrefix = "http://asset.localhost/";
  const httpsPrefix = "https://asset.localhost/";

  if (src.startsWith(assetLocalhostPrefix)) {
    return `${httpPrefix}${src.slice(assetLocalhostPrefix.length)}`;
  }
  if (src.startsWith("asset://")) {
    return `${httpPrefix}${src.slice("asset://".length)}`;
  }
  if (src.startsWith(httpPrefix)) {
    return `${assetLocalhostPrefix}${src.slice(httpPrefix.length)}`;
  }
  if (src.startsWith(httpsPrefix)) {
    return `${assetLocalhostPrefix}${src.slice(httpsPrefix.length)}`;
  }
  return null;
}

export default function MediaTab() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [_viewMode, _setViewMode] = useState<"grid" | "list">("grid");
  const [pdfPresentation, setPdfPresentation] = useState<{ groupId: string; index: number } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPptxHint, setShowPptxHint] = useState(false);

  // Slides (images)
  const slides = useStore((s) => s.slides);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const outputMode = useStore((s) => s.outputMode);
  const isBlackout = useStore((s) => s.isBlackout);
  const loadMedia = useStore((s) => s.loadMedia);
  const goLiveSlide = useStore((s) => s.goLiveSlide);
  const removeSlide = useStore((s) => s.removeSlide);
  const reorderSlides = useStore((s) => s.reorderSlides);

  // Videos
  const videos = useStore((s) => s.videos);
  const activeVideoId = useStore((s) => s.activeVideoId);
  const loadVideos = useStore((s) => s.loadVideos);
  const goLiveVideo = useStore((s) => s.goLiveVideo);
  const removeVideo = useStore((s) => s.removeVideo);

  // PDF Groups
  const pdfGroups = useStore((s) => s.pdfGroups);
  const expandedGroupId = useStore((s) => s.expandedGroupId);
  const loadPdf = useStore((s) => s.loadPdf);
  const toggleExpandGroup = useStore((s) => s.toggleExpandGroup);
  const removeGroup = useStore((s) => s.removeGroup);
  const goLivePageFromGroup = useStore((s) => s.goLivePageFromGroup);
  const outputMonitorIndices = useStore((s) => s.outputMonitorIndices);
  const outputWindowsOpen = useStore((s) => s.outputWindowsOpen);
  const toggleOutputMonitor = useStore((s) => s.toggleOutputMonitor);
  const resetMedia = useStore((s) => s.resetMedia);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Drag & Drop State
  const dragIndex = useStore((s) => (s as any).dragIndex ?? -1);
  const setDragIndex = (i: number) => (useStore as any).setState({ dragIndex: i });

  // Image error tracking
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [retryImages, setRetryImages] = useState<Record<string, boolean>>({});

  const presentationGroup = useMemo(() => {
    if (!pdfPresentation) return null;
    return pdfGroups.find((g) => g.id === pdfPresentation.groupId) ?? null;
  }, [pdfGroups, pdfPresentation]);

  const presentationPages = presentationGroup?.pages ?? [];
  const presentationIndex = pdfPresentation?.index ?? 0;
  const presentationCurrent = presentationPages[presentationIndex];
  const presentationNext = presentationPages[presentationIndex + 1];

  function closePresentation() {
    setPdfPresentation(null);
  }

  async function ensureOutputVisible() {
    // If at least one monitor is configured, make sure the output windows are opened.
    if (outputMonitorIndices.length > 0) {
      // Windows are already opened by the store, just verify they're visible
      // The store handles opening windows for all configured monitors
    }

    // If no output windows are open, open one on the first available monitor
    if (outputMonitorIndices.length === 0) {
      await openOutputWindow();
    }
  }

  async function startPresentation(groupId: string) {
    const group = pdfGroups.find((g) => g.id === groupId);
    if (!group || group.pages.length === 0) return;
    await ensureOutputVisible();
    setPdfPresentation({ groupId, index: 0 });
    goLivePageFromGroup(groupId, 0);
  }

  function stepPresentation(delta: number) {
    if (!pdfPresentation) return;
    const group = pdfGroups.find((g) => g.id === pdfPresentation.groupId);
    if (!group) return;
    const nextIndex = Math.max(0, Math.min(group.pages.length - 1, pdfPresentation.index + delta));
    if (nextIndex === pdfPresentation.index) return;

    // Trigger transition animation
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 300);

    setPdfPresentation({ groupId: pdfPresentation.groupId, index: nextIndex });
    goLivePageFromGroup(pdfPresentation.groupId, nextIndex);
  }

  useEffect(() => {
    if (!pdfPresentation) return;
    function onKey(e: KeyboardEvent) {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePresentation();
        return;
      }
      if (e.code === "ArrowRight" || e.code === "Space" || e.code === "PageDown") {
        e.preventDefault();
        e.stopPropagation();
        stepPresentation(1);
      }
      if (e.code === "ArrowLeft" || e.code === "PageUp") {
        e.preventDefault();
        e.stopPropagation();
        stepPresentation(-1);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pdfPresentation, pdfGroups]);

  function handleImageError(slideId: string, slideName: string, slideSrc: string) {
    console.warn("Failed to load image:", slideName, slideSrc?.substring(0, 80));

    // Try once with a different URL format (asset:// <-> http(s)://asset.localhost)
    if (!retryImages[slideId]) {
      const alt = alternateAssetUrl(slideSrc);
      if (alt && alt !== slideSrc) {
        console.log("Retrying with alternate URL format:", alt);
        setRetryImages((prev) => ({ ...prev, [slideId]: true }));
        return; // Don't mark as error yet
      }
    }

    setImageErrors((prev) => ({ ...prev, [slideId]: true }));
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, _index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderSlides(fromIndex, toIndex);
    }
    setDragIndex(-1);
  }

  function handleDragEnd() {
    setDragIndex(-1);
  }

  // Filter items
  // filtered slides for future use

  const totalImages = slides.length + pdfGroups.reduce((acc, g) => acc + g.pages.length, 0);
  const totalVideos = videos.length;

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Medien</h2>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center gap-1 mr-3">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              Alle ({totalImages + totalVideos})
            </FilterButton>
            <FilterButton active={filter === "image"} onClick={() => setFilter("image")}>
              🖼️ Bilder ({totalImages})
            </FilterButton>
            <FilterButton active={filter === "video"} onClick={() => setFilter("video")}>
              🎬 Videos ({totalVideos})
            </FilterButton>
            <FilterButton active={filter === "pdf"} onClick={() => setFilter("pdf")}>
              📄 PDF ({pdfGroups.length})
            </FilterButton>
          </div>

          {/* Add buttons */}
          <button
            onClick={() => setShowPptxHint(true)}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
            style={{ background: "#7c3aed", color: "white" }}
            title="PowerPoint als PDF importieren"
          >
            + PowerPoint
          </button>
          <button
            onClick={loadMedia}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
            style={{ background: "#f97316", color: "white" }}
            title="Bilder oder Videos hinzufügen"
          >
            + Medien
          </button>
          {(slides.length > 0 || videos.length > 0) && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{ background: "#2a0a0a", color: "#ef4444", border: "1px solid #333" }}
              title="Alle Medien entfernen"
            >
              🗑️ Reset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PDF Groups */}
        {(filter === "all" || filter === "pdf") && pdfGroups.length > 0 && (
          <div className="flex flex-col gap-4 mb-6">
            {pdfGroups.map((group) => {
              const isExpanded = expandedGroupId === group.id;

              return (
                <div
                  key={group.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "#0d0d0d", border: "1px solid #252525" }}
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    style={{ background: isExpanded ? "#7c3aed20" : "transparent" }}
                    onClick={() => toggleExpandGroup(group.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center"
                        style={{ background: "#7c3aed30" }}
                      >
                        📄
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{group.name}</div>
                        <div className="text-xs" style={{ color: "#666" }}>
                          {group.pages.length} Seiten
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startPresentation(group.id);
                        }}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "#1a1a1a", color: "#f97316", border: "1px solid #333" }}
                        title="Präsentation starten (ESC zum Beenden)"
                      >
                        Start
                      </button>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", color: "#666" }}>
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGroup(group.id);
                        }}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "#2a0a0a", color: "#ef4444" }}
                        title="Entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Group Content (expanded) */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-4 gap-2">
                        {group.pages.map((page, i) => {
                          const active = outputMode === "image" && !isBlackout && page.id === activeSlideId;
                          return (
                            <button
                              key={page.id}
                              onClick={() => goLivePageFromGroup(group.id, i)}
                              className="relative group rounded-lg overflow-hidden cursor-pointer transition-all"
                              style={{
                                border: active ? "2px solid #f97316" : "2px solid #252525",
                                boxShadow: active ? "0 0 16px #f9731640" : "none",
                              }}
                            >
                              <div className="aspect-video bg-black relative">
                                <img
                                  data-slide-id={page.id}
                                  src={retryImages[page.id] ? (alternateAssetUrl(page.src) ?? page.src) : page.src}
                                  alt={page.name}
                                  className="w-full h-full object-contain"
                                  draggable={false}
                                  onError={() => handleImageError(page.id, page.name, page.src)}
                                />
                                {imageErrors[page.id] && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                    <div className="text-center">
                                      <span className="text-2xl">⚠️</span>
                                      <p className="text-xs text-zinc-500 mt-1">Vorschau nicht verfügbar</p>
                                      <p className="text-[10px] text-zinc-600 mt-0.5">{page.name}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-bold">LIVE</span>
                              </div>
                              <div
                                className="absolute top-1 left-1 text-[9px] font-mono px-1 py-0.5 rounded"
                                style={{ background: "#000000aa", color: "#888" }}
                              >
                                {i + 1}
                              </div>
                              {active && (
                                <div
                                  className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded live-dot"
                                  style={{ background: "#f97316", color: "white" }}
                                >
                                  LIVE
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Videos Section */}
        {(filter === "all" || filter === "video") && videos.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                🎬 Videos
              </h3>
              <button
                onClick={loadVideos}
                className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: "#1f1f1f", color: "#f97316", border: "1px solid #333" }}
              >
                + Video
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {videos.map((video) => {
                const isActive = outputMode === "video" && !isBlackout && video.id === activeVideoId;
                return (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: isActive ? "#f9731610" : "#141414",
                      border: isActive ? "1px solid #f9731640" : "1px solid #1e1e1e",
                    }}
                  >
                    <div
                      className="w-16 h-12 rounded flex items-center justify-center shrink-0"
                      style={{ background: "#1a1a1a" }}
                    >
                      🎬
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{video.name}</div>
                      {isActive && (
                        <div className="text-xs live-dot" style={{ color: "#22c55e" }}>
                          ● Live
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {isActive && (
                        <>
                          <button
                            onClick={() => sendVideoControl("play")}
                            className="text-xs px-2 py-1.5 rounded"
                            style={{ background: "#22c55e20", color: "#22c55e" }}
                            title="Play"
                          >
                            ▶
                          </button>
                          <button
                            onClick={() => sendVideoControl("pause")}
                            className="text-xs px-2 py-1.5 rounded"
                            style={{ background: "#1a1a1a", color: "#888" }}
                            title="Pause"
                          >
                            ⏸
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => goLiveVideo(video.id)}
                        className="text-xs px-3 py-1.5 rounded font-medium"
                        style={{ background: isActive ? "#f97316" : "#1f1f1f", color: isActive ? "white" : "#888" }}
                      >
                        {isActive ? "● Live" : "Abspielen"}
                      </button>
                      <button
                        onClick={() => removeVideo(video.id)}
                        className="text-xs px-2 py-1.5 rounded"
                        style={{ background: "#2a0a0a", color: "#ef4444" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Images Section */}
        {(filter === "all" || filter === "image") && slides.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                🖼️ Bilder
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {slides.map((slide, i) => {
                const active = outputMode === "image" && !isBlackout && slide.id === activeSlideId;
                return (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className="relative group rounded-lg overflow-hidden cursor-pointer transition-all"
                    style={{
                      border: active ? "2px solid #f97316" : "2px solid #252525",
                      boxShadow: active ? "0 0 16px #f9731640" : "none",
                      opacity: dragIndex === i ? 0.5 : 1,
                    }}
                    onClick={() => goLiveSlide(slide.id)}
                  >
                    <div className="aspect-video bg-black relative">
                      <img
                        data-slide-id={slide.id}
                        src={retryImages[slide.id] ? (alternateAssetUrl(slide.src) ?? slide.src) : slide.src}
                        alt={slide.name}
                        className="w-full h-full object-contain"
                        draggable={false}
                        onError={() => handleImageError(slide.id, slide.name, slide.src)}
                      />
                      {imageErrors[slide.id] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                          <div className="text-center">
                            <span className="text-2xl">⚠️</span>
                            <p className="text-xs text-zinc-500 mt-1">Vorschau nicht verfügbar</p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">{slide.name}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-bold">LIVE</span>
                    </div>
                    <div
                      className="absolute top-1.5 left-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "#000000aa", color: "#888" }}
                    >
                      {i + 1}
                    </div>
                    {active && (
                      <div
                        className="absolute top-1.5 right-1.5 text-[10px] font-bold px-2 py-0.5 rounded live-dot"
                        style={{ background: "#f97316", color: "white" }}
                      >
                        LIVE
                      </div>
                    )}
                    <button
                      className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center text-xs"
                      style={{ background: "#ef4444", color: "white" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSlide(slide.id);
                      }}
                      title="Entfernen"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Empty State */}
        {slides.length === 0 && videos.length === 0 && pdfGroups.length === 0 && (
          <EmptyState
            icon="📁"
            text="Keine Medien geladen"
            sub="Füge Bilder, Videos oder PDFs hinzu (PowerPoint als PDF exportieren)"
            onAction={loadMedia}
            actionLabel="Medien laden"
          />
        )}
      </div>

      {/* PowerPoint Hint Modal */}
      {showPptxHint && (
        <PptxHintModal
          onClose={() => setShowPptxHint(false)}
          onConfirm={() => {
            setShowPptxHint(false);
            loadPdf();
          }}
        />
      )}

      {/* PDF presenter overlay */}
      {pdfPresentation && presentationGroup && presentationCurrent && (
        <div className="absolute inset-0 z-50 bg-black">
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#1a1a1a" }}>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{presentationGroup.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "#666" }}>
                  Seite {presentationIndex + 1}/{presentationPages.length} · ESC zum Beenden
                </div>
              </div>
              <button
                onClick={closePresentation}
                className="text-xs px-3 py-1.5 rounded"
                style={{ background: "#2a0a0a", color: "#ef4444" }}
                title="Schließen (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-4 p-4">
              {/* Current Slide */}
              <div
                className="col-span-2 rounded-lg overflow-hidden flex items-center justify-center relative"
                style={{ background: "#000", border: "1px solid #1e1e1e" }}
              >
                <img
                  src={presentationCurrent.src}
                  alt=""
                  className="w-full h-full object-contain transition-all duration-300 ease-out draggable-false"
                  style={{
                    opacity: isTransitioning ? 0.5 : 1,
                    transform: isTransitioning ? "scale(0.98)" : "scale(1)",
                    filter: isTransitioning ? "blur(2px)" : "none",
                  }}
                  draggable={false}
                />
              </div>

              <div className="col-span-1 flex flex-col gap-3">
                {/* Next Slide Preview */}
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
                  Nächste Folie
                </div>
                <div
                  className="aspect-video rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                >
                  {presentationNext ? (
                    <img
                      src={presentationNext.src}
                      alt=""
                      className="w-full h-full object-contain transition-all duration-300 draggable-false"
                      style={{
                        opacity: isTransitioning ? 0.7 : 1,
                        transform: isTransitioning ? "scale(1.05)" : "scale(1)",
                      }}
                      draggable={false}
                    />
                  ) : (
                    <span className="text-xs" style={{ color: "#444" }}>
                      Ende
                    </span>
                  )}
                </div>

                {/* Presenter Notes */}
                <div className="flex-1 flex flex-col">
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#555" }}>
                    Notizen
                  </div>
                  <div
                    className="flex-1 rounded-lg p-3 overflow-y-auto text-sm transition-all duration-300"
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #1e1e1e",
                      color: presentationCurrent.notes ? "#ccc" : "#444",
                      opacity: isTransitioning ? 0.7 : 1,
                      transform: isTransitioning ? "translateX(5px)" : "translateX(0)",
                    }}
                  >
                    {presentationCurrent.notes ? (
                      <p className="whitespace-pre-wrap">{presentationCurrent.notes}</p>
                    ) : (
                      <p className="italic">Keine Notizen für diese Folie</p>
                    )}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => stepPresentation(-1)}
                    disabled={presentationIndex <= 0}
                    className="flex-1 py-3 rounded font-semibold text-sm transition-all disabled:opacity-40"
                    style={{ background: "#141414", color: "#ddd", border: "1px solid #252525" }}
                  >
                    ← Zurück
                  </button>
                  <button
                    onClick={() => stepPresentation(1)}
                    disabled={presentationIndex >= presentationPages.length - 1}
                    className="flex-1 py-3 rounded font-semibold text-sm transition-all disabled:opacity-40"
                    style={{ background: "#f97316", color: "white" }}
                  >
                    Weiter →
                  </button>
                </div>

                <div className="text-[11px]" style={{ color: "#555" }}>
                  Tastatur: ←/→, PageUp/PageDown, Space, ESC
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowResetConfirm(false)}>
          <div
            className="w-[400px] rounded-xl overflow-hidden"
            style={{ background: "#1a1a1a", border: "1px solid #333" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "#333" }}>
              <h3 className="text-sm font-semibold text-white">Alle Medien entfernen?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm" style={{ color: "#ccc" }}>
                Dies entfernt alle Bilder und Videos aus der Bibliothek. Diese Aktion kann nicht rückgängig gemacht werden.
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
                onClick={() => { resetMedia(); setShowResetConfirm(false); }}
                className="text-xs px-4 py-2 rounded font-medium"
                style={{ background: "#ef4444", color: "white" }}
              >
                Entfernen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded font-medium transition-all"
      style={{
        background: active ? "#f9731620" : "#141414",
        color: active ? "#f97316" : "#666",
        border: active ? "1px solid #f9731640" : "1px solid #222",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon,
  text,
  sub,
  onAction,
  actionLabel,
}: {
  icon: string;
  text: string;
  sub: string;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center px-8">
      <span className="text-5xl">{icon}</span>
      <div>
        <p className="text-white font-medium">{text}</p>
        <p className="text-sm mt-1" style={{ color: "#555" }}>
          {sub}
        </p>
      </div>
      <button
        onClick={onAction}
        className="text-sm px-4 py-2 rounded"
        style={{ background: "#1f1f1f", color: "#888", border: "1px solid #333" }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function PptxHintModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded flex items-center justify-center text-xl"
            style={{ background: "#7c3aed30" }}
          >
            📄
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">PowerPoint importieren</h3>
            <p className="text-xs" style={{ color: "#888" }}>
              Als PDF exportieren für beste Qualität
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-2">
            <span className="text-[#f97316] font-bold">1.</span>
            <p className="text-sm text-gray-300">Öffne deine PowerPoint-Präsentation</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#f97316] font-bold">2.</span>
            <p className="text-sm text-gray-300">
              Gehe zu <strong className="text-white">Datei → Exportieren → PDF/XPS erstellen</strong>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#f97316] font-bold">3.</span>
            <p className="text-sm text-gray-300">Speichere die PDF-Datei</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#f97316] font-bold">4.</span>
            <p className="text-sm text-gray-300">Klicke unten auf "PDF auswählen" und wähle die exportierte Datei</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded font-medium"
            style={{ background: "#2a2a2a", color: "#888" }}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="text-xs px-4 py-2 rounded font-medium"
            style={{ background: "#7c3aed", color: "white" }}
          >
            PDF auswählen
          </button>
        </div>
      </div>
    </div>
  );
}
