import { useState } from "react";
import { useStore } from "../../store/useStore";
import { sendVideoControl } from "../../lib/events";

type FilterType = "all" | "image" | "video" | "pptx";

export default function MediaTab() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Slides (images)
  const slides = useStore((s) => s.slides);
  const activeSlideId = useStore((s) => s.activeSlideId);
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
    <div className="flex flex-col h-full">
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
            onClick={() => { loadSlides(); loadVideos(); }}
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
                                  src={slide.src}
                                  alt={slide.name}
                                  className="w-full h-full object-contain"
                                  draggable={false}
                                  onError={() => {
                                    console.warn("Failed to load image:", slide.name, slide.src?.substring(0, 50));
                                    setImageErrors((prev) => ({ ...prev, [slide.id]: true }));
                                  }}
                                />
                                {imageErrors[slide.id] && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                    <div className="text-center">
                                      <span className="text-2xl">⚠️</span>
                                      <p className="text-xs text-zinc-500 mt-1">Vorschau nicht verfügbar</p>
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
                        src={slide.src}
                        alt={slide.name}
                        className="w-full h-full object-contain"
                        draggable={false}
                        onError={() => {
                          console.warn("Failed to load image:", slide.name, slide.src?.substring(0, 50));
                          setImageErrors((prev) => ({ ...prev, [slide.id]: true }));
                        }}
                      />
                      {imageErrors[slide.id] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                          <div className="text-center">
                            <span className="text-2xl">⚠️</span>
                            <p className="text-xs text-zinc-500 mt-1">Vorschau nicht verfügbar</p>
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
            onAction={loadSlides}
            actionLabel="Medien laden"
          />
        )}
      </div>

      <Hint text="Tipp: PowerPoint-Dateien werden automatisch in einzelne Folien zerlegt" />
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
