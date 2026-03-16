import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import { sendVideoControl } from "../../lib/events";

type FilterType = "all" | "image" | "video" | "pptx";

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
	  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	  const [pptxPresentation, setPptxPresentation] = useState<{ groupId: string; index: number } | null>(null);

  // Slides (images)
	  const slides = useStore((s) => s.slides);
	  const activeSlideId = useStore((s) => s.activeSlideId);
	  const loadMedia = useStore((s) => s.loadMedia);
	  const loadSlides = useStore((s) => s.loadSlides);
	  const goLiveSlide = useStore((s) => s.goLiveSlide);
	  const removeSlide = useStore((s) => s.removeSlide);
	  const reorderSlides = useStore((s) => s.reorderSlides);

  // Videos
  const videos = useStore((s) => s.videos);
  const activeVideoId = useStore((s) => s.activeVideoId);
  const loadVideos = useStore((s) => s.loadVideos);
  const goLiveVideo = useStore((s) => s.goLiveVideo);
  const removeVideo = useStore((s) => s.removeVideo);

  // PPTX Groups
  const pptxGroups = useStore((s) => s.pptxGroups);
  const expandedGroupId = useStore((s) => s.expandedGroupId);
  const loadPptx = useStore((s) => s.loadPptx);
  const toggleExpandGroup = useStore((s) => s.toggleExpandGroup);
  const removeGroup = useStore((s) => s.removeGroup);
	  const goLiveSlideFromGroup = useStore((s) => s.goLiveSlideFromGroup);

  // Drag & Drop State
  const dragIndex = useStore((s) => (s as any).dragIndex ?? -1);
  const setDragIndex = (i: number) => (useStore as any).setState({ dragIndex: i });

  // Image error tracking
	  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
	  const [retryImages, setRetryImages] = useState<Record<string, boolean>>({});

	  const presentationGroup = useMemo(() => {
	    if (!pptxPresentation) return null;
	    return pptxGroups.find((g) => g.id === pptxPresentation.groupId) ?? null;
	  }, [pptxGroups, pptxPresentation]);

	  const presentationSlides = presentationGroup?.slides ?? [];
	  const presentationIndex = pptxPresentation?.index ?? 0;
	  const presentationCurrent = presentationSlides[presentationIndex];
	  const presentationNext = presentationSlides[presentationIndex + 1];

	  function closePresentation() {
	    setPptxPresentation(null);
	  }

	  function startPresentation(groupId: string) {
	    const group = pptxGroups.find((g) => g.id === groupId);
	    if (!group || group.slides.length === 0) return;
	    setPptxPresentation({ groupId, index: 0 });
	    goLiveSlideFromGroup(groupId, 0);
	  }

	  function stepPresentation(delta: number) {
	    if (!pptxPresentation) return;
	    const group = pptxGroups.find((g) => g.id === pptxPresentation.groupId);
	    if (!group) return;
	    const nextIndex = Math.max(0, Math.min(group.slides.length - 1, pptxPresentation.index + delta));
	    if (nextIndex === pptxPresentation.index) return;
	    setPptxPresentation({ groupId: pptxPresentation.groupId, index: nextIndex });
	    goLiveSlideFromGroup(pptxPresentation.groupId, nextIndex);
	  }

	  useEffect(() => {
	    if (!pptxPresentation) return;
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
	  }, [pptxPresentation, pptxGroups]);

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

  function handleDragOver(e: React.DragEvent, index: number) {
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
  const filteredSlides = slides.filter((s) => filter === "all" || filter === "image" ? true : false);
  const filteredVideos = videos.filter((v) => filter === "all" || filter === "video" ? true : false);
  const filteredGroups = pptxGroups.filter((g) => filter === "all" || filter === "pptx" ? true : false);

  const totalImages = slides.length + pptxGroups.reduce((acc, g) => acc + g.slides.length, 0);
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
            <FilterButton active={filter === "pptx"} onClick={() => setFilter("pptx")}>
              📁 PPTX ({pptxGroups.length})
            </FilterButton>
          </div>

          {/* Add buttons */}
          <button
            onClick={loadPptx}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
            style={{ background: "#7c3aed", color: "white" }}
            title="PowerPoint importieren"
          >
            + PPTX
          </button>
          <button
	            onClick={loadMedia}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
            style={{ background: "#f97316", color: "white" }}
            title="Bilder oder Videos hinzufügen"
          >
            + Medien
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PPTX Groups */}
        {(filter === "all" || filter === "pptx") && pptxGroups.length > 0 && (
          <div className="flex flex-col gap-4 mb-6">
            {pptxGroups.map((group) => {
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
                        📁
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{group.name}</div>
                        <div className="text-xs" style={{ color: "#666" }}>
                          {group.slides.length} Folien
                        </div>
                      </div>
	                    </div>
	                    <div className="flex items-center gap-2">
	                      <button
	                        onClick={(e) => { e.stopPropagation(); startPresentation(group.id); }}
	                        className="text-xs px-2 py-1 rounded"
	                        style={{ background: "#1a1a1a", color: "#f97316", border: "1px solid #333" }}
	                        title="Präsentation starten (ESC zum Beenden)"
	                      >
	                        Start
	                      </button>
	                      <span
	                        className="text-xs px-2 py-1 rounded"
	                        style={{ background: "#1a1a1a", color: "#666" }}
	                      >
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }}
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
                        {group.slides.map((slide, i) => {
                          const active = slide.id === activeSlideId;
                          return (
                            <button
                              key={slide.id}
                              onClick={() => goLiveSlideFromGroup(group.id, i)}
                              className="relative group rounded-lg overflow-hidden cursor-pointer transition-all"
                              style={{
                                border: active ? "2px solid #f97316" : "2px solid #252525",
                                boxShadow: active ? "0 0 16px #f9731640" : "none",
                              }}
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
                const isActive = video.id === activeVideoId;
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
                        <div className="text-xs live-dot" style={{ color: "#22c55e" }}>● Live</div>
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
              <button
                onClick={loadSlides}
                className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: "#1f1f1f", color: "#f97316", border: "1px solid #333" }}
              >
                + Bild
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {slides.map((slide, i) => {
                const active = slide.id === activeSlideId;
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
                      onClick={(e) => { e.stopPropagation(); removeSlide(slide.id); }}
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
        {slides.length === 0 && videos.length === 0 && pptxGroups.length === 0 && (
          <EmptyState
            icon="📁"
            text="Keine Medien geladen"
            sub="Füge Bilder, Videos oder PowerPoint-Präsentationen hinzu"
	            onAction={loadMedia}
            actionLabel="Medien laden"
          />
        )}
      </div>

	      <Hint text="Tipp: PowerPoint-Dateien werden automatisch in einzelne Folien zerlegt" />

	      {/* PPTX presenter overlay */}
	      {pptxPresentation && presentationGroup && presentationCurrent && (
	        <div className="absolute inset-0 z-50 bg-black">
	          <div className="h-full flex flex-col">
	            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#1a1a1a" }}>
	              <div className="min-w-0">
	                <div className="text-sm font-semibold text-white truncate">{presentationGroup.name}</div>
	                <div className="text-[11px] mt-0.5" style={{ color: "#666" }}>
	                  Folie {presentationIndex + 1}/{presentationSlides.length} · ESC zum Beenden
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
	              <div
	                className="col-span-2 rounded-lg overflow-hidden flex items-center justify-center"
	                style={{ background: "#000", border: "1px solid #1e1e1e" }}
	              >
	                <img src={presentationCurrent.src} alt="" className="w-full h-full object-contain" draggable={false} />
	              </div>

	              <div className="col-span-1 flex flex-col gap-3">
	                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
	                  Nächste Folie
	                </div>
	                <div
	                  className="aspect-video rounded-lg overflow-hidden flex items-center justify-center"
	                  style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
	                >
	                  {presentationNext ? (
	                    <img src={presentationNext.src} alt="" className="w-full h-full object-contain" draggable={false} />
	                  ) : (
	                    <span className="text-xs" style={{ color: "#444" }}>Ende</span>
	                  )}
	                </div>

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
	                    disabled={presentationIndex >= presentationSlides.length - 1}
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
	    </div>
	  );
	}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function EmptyState({ icon, text, sub, onAction, actionLabel }: {
  icon: string; text: string; sub: string; onAction: () => void; actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center px-8">
      <span className="text-5xl">{icon}</span>
      <div>
        <p className="text-white font-medium">{text}</p>
        <p className="text-sm mt-1" style={{ color: "#555" }}>{sub}</p>
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

function Hint({ text }: { text: string }) {
  return (
    <div className="px-4 py-2 border-t text-[11px]" style={{ borderColor: "#1a1a1a", color: "#444" }}>
      💡 {text}
    </div>
  );
}
