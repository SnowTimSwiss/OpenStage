import { useStore } from "../../store/useStore";

export default function SlidesTab() {
  const slides = useStore((s) => s.slides);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const loadSlides = useStore((s) => s.loadSlides);
  const goLiveSlide = useStore((s) => s.goLiveSlide);
  const removeSlide = useStore((s) => s.removeSlide);
  const reorderSlides = useStore((s) => s.reorderSlides);

  const dragIndex = useStore((s) => (s as any).dragIndex ?? -1);
  const setDragIndex = (i: number) => (useStore as any).setState({ dragIndex: i });

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Folien / Bilder</h2>
        <button
          onClick={loadSlides}
          className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
          style={{ background: "#f97316", color: "white" }}
        >
          + Hinzufügen
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {slides.length === 0 ? (
          <EmptyState
            icon="🖼️"
            text="Keine Folien geladen"
            sub="Klicke auf '+ Hinzufügen' um Bilder oder exportierte PPT-Folien zu laden"
            onAction={loadSlides}
            actionLabel="Bilder laden"
          />
        ) : (
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
                  <img
                    src={slide.src}
                    alt={slide.name}
                    className="w-full aspect-video object-cover"
                    draggable={false}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                  {/* Number badge */}
                  <div
                    className="absolute top-1.5 left-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: "#000000aa", color: "#888" }}
                  >
                    {i + 1}
                  </div>
                  {/* Active badge */}
                  {active && (
                    <div
                      className="absolute top-1.5 right-1.5 text-[10px] font-bold px-2 py-0.5 rounded live-dot"
                      style={{ background: "#f97316", color: "white" }}
                    >
                      LIVE
                    </div>
                  )}
                  {/* Delete button */}
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
        )}
      </div>

      <Hint text="Tipp: Exportiere PowerPoint-Folien als PNG (Datei → Exportieren → Jede Folie als Bild)" />
    </div>
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
