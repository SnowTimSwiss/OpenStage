import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import OutputRenderer from "../../output/OutputRenderer";
import type { OutputPayload } from "../../types";

const ACCENT = "#f97316";

export default function SlideshowTab() {
  const slideshows = useStore((s) => s.slideshows);
  const slides = useStore((s) => s.slides);
  const playlists = useStore((s) => s.playlists);
  const activeSlideshowId = useStore((s) => s.activeSlideshowId);
  const slideshowRunIndex = useStore((s) => s.slideshowRunIndex);
  const slideshowPlaying = useStore((s) => s.slideshowPlaying);

  const createSlideshow = useStore((s) => s.createSlideshow);
  const updateSlideshow = useStore((s) => s.updateSlideshow);
  const removeSlideshow = useStore((s) => s.removeSlideshow);
  const addImagesToSlideshow = useStore((s) => s.addImagesToSlideshow);
  const removeSlideshowItem = useStore((s) => s.removeSlideshowItem);
  const reorderSlideshowItems = useStore((s) => s.reorderSlideshowItems);
  const setSlideshowItemDuration = useStore((s) => s.setSlideshowItemDuration);
  const startSlideshow = useStore((s) => s.startSlideshow);
  const stopSlideshow = useStore((s) => s.stopSlideshow);
  const pauseSlideshow = useStore((s) => s.pauseSlideshow);
  const resumeSlideshow = useStore((s) => s.resumeSlideshow);
  const slideshowNext = useStore((s) => s.slideshowNext);
  const slideshowPrev = useStore((s) => s.slideshowPrev);
  const goToSlideshowFrame = useStore((s) => s.goToSlideshowFrame);
  const addToShowQueue = useStore((s) => s.addToShowQueue);

  const [selectedId, setSelectedId] = useState<string | null>(slideshows[0]?.id ?? null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const selected = slideshows.find((s) => s.id === selectedId) ?? null;
  const isLive = activeSlideshowId === selectedId && selectedId !== null;

  // Keep a valid selection as slideshows change.
  useEffect(() => {
    if (selectedId && slideshows.some((s) => s.id === selectedId)) return;
    setSelectedId(slideshows[0]?.id ?? null);
  }, [slideshows, selectedId]);

  // Follow the live position when the selected slideshow is running.
  useEffect(() => {
    if (isLive) setPreviewIndex(slideshowRunIndex);
  }, [isLive, slideshowRunIndex]);

  // Keyboard navigation while a slideshow is live.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!useStore.getState().activeSlideshowId) return;
      if (e.code === "ArrowRight") {
        e.preventDefault();
        slideshowNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        slideshowPrev();
      } else if (e.code === "Space") {
        e.preventDefault();
        if (useStore.getState().slideshowPlaying) pauseSlideshow();
        else resumeSlideshow();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideshowNext, slideshowPrev, pauseSlideshow, resumeSlideshow]);

  const previewSrc = useMemo(() => {
    if (!selected || selected.items.length === 0) return null;
    const idx = Math.min(previewIndex, selected.items.length - 1);
    const item = selected.items[idx];
    const slide = slides.find((s) => s.id === item?.mediaId);
    return slide?.src ?? null;
  }, [selected, previewIndex, slides]);

  const previewPayload: OutputPayload = previewSrc
    ? { mode: "image", image: { src: previewSrc } }
    : { mode: "blank" };

  const totalDuration = useMemo(
    () => (selected ? selected.items.reduce((sum, item) => sum + item.duration, 0) : 0),
    [selected]
  );

  function handleCreate() {
    const show = createSlideshow("Neue Diashow");
    setSelectedId(show.id);
    setPreviewIndex(0);
  }

  function handleAddToShow() {
    if (!selected) return;
    addToShowQueue({
      id: crypto.randomUUID(),
      type: "slideshow",
      slideshowId: selected.id,
      label: `Diashow: ${selected.name}`,
    });
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Slideshow list */}
      <aside className="w-64 shrink-0 flex flex-col border-r" style={{ borderColor: "#252525", background: "#0d0d0d" }}>
        <div className="px-3 py-3 border-b flex items-center justify-between" style={{ borderColor: "#1a1a1a" }}>
          <span className="text-[11px] uppercase tracking-widest font-medium" style={{ color: "#444" }}>
            Diashows
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {slideshows.length === 0 && (
            <p className="text-xs text-center mt-6" style={{ color: "#444" }}>
              Noch keine Diashow.
            </p>
          )}
          {slideshows.map((show) => {
            const active = show.id === selectedId;
            const running = show.id === activeSlideshowId;
            return (
              <button
                key={show.id}
                onClick={() => {
                  setSelectedId(show.id);
                  setPreviewIndex(0);
                }}
                className="text-left rounded-lg px-3 py-2 transition-all"
                style={{
                  background: active ? "#f9731615" : "#141414",
                  border: active ? `1px solid ${ACCENT}` : "1px solid #222",
                  color: active ? ACCENT : "#ccc",
                }}
              >
                <div className="flex items-center gap-2">
                  <span>🎞️</span>
                  <span className="text-sm font-medium truncate flex-1">{show.name}</span>
                  {running && <span className="text-[9px] font-bold" style={{ color: ACCENT }}>● LIVE</span>}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "#666" }}>
                  {show.items.length} {show.items.length === 1 ? "Bild" : "Bilder"}
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-2 border-t" style={{ borderColor: "#1a1a1a" }}>
          <button
            onClick={handleCreate}
            className="w-full py-2 rounded-lg font-semibold text-sm"
            style={{ background: ACCENT, color: "white" }}
          >
            + Neue Diashow
          </button>
        </div>
      </aside>

      {/* Editor */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "#444" }}>
              Wähle links eine Diashow oder erstelle eine neue.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: "#252525" }}>
              <input
                value={selected.name}
                onChange={(e) => updateSlideshow(selected.id, { name: e.target.value })}
                className="flex-1 bg-transparent text-base font-semibold text-white outline-none"
                style={{ borderBottom: "1px solid transparent" }}
              />
              <span className="text-xs" style={{ color: "#555" }}>
                {selected.items.length} Bilder · {formatDuration(totalDuration)}
              </span>
              <button
                onClick={() => {
                  if (confirm(`Diashow "${selected.name}" löschen?`)) removeSlideshow(selected.id);
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "#b91c1c", background: "#1a1a1a" }}
              >
                🗑 Löschen
              </button>
            </div>

            {/* Settings */}
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-4" style={{ borderColor: "#1a1a1a" }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.loop}
                  onChange={(e) => updateSlideshow(selected.id, { loop: e.target.checked })}
                  className="w-4 h-4"
                  style={{ accentColor: ACCENT }}
                />
                <span className="text-xs text-gray-300">🔁 Endlos-Schleife</span>
              </label>

              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-300">Standard-Dauer</span>
                <input
                  type="number"
                  min={1}
                  value={selected.defaultDuration}
                  onChange={(e) =>
                    updateSlideshow(selected.id, { defaultDuration: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-16 px-2 py-1 rounded text-xs text-white"
                  style={{ background: "#141414", border: "1px solid #2a2a2a" }}
                />
                <span className="text-xs" style={{ color: "#666" }}>Sek.</span>
              </label>

              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-300">🎧 Hintergrundmusik</span>
                <select
                  value={selected.backgroundPlaylistId ?? ""}
                  onChange={(e) =>
                    updateSlideshow(selected.id, { backgroundPlaylistId: e.target.value || null })
                  }
                  className="px-2 py-1 rounded text-xs text-white"
                  style={{ background: "#141414", border: "1px solid #2a2a2a" }}
                >
                  <option value="">— keine —</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Items list */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-widest" style={{ color: "#555" }}>
                    Bilder
                  </span>
                  <button
                    onClick={() => setIsPickerOpen(true)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: "#141414", color: ACCENT, border: `1px solid ${ACCENT}40` }}
                  >
                    + Bilder hinzufügen
                  </button>
                </div>

                {selected.items.length === 0 ? (
                  <p className="text-xs text-center mt-8" style={{ color: "#444" }}>
                    {slides.length === 0
                      ? "Keine Bilder in der Medien-Bibliothek. Importiere zuerst Bilder im Medien-Tab."
                      : "Noch keine Bilder. Klicke auf „+ Bilder hinzufügen“."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selected.items.map((item, index) => {
                      const slide = slides.find((s) => s.id === item.mediaId);
                      const isCurrentFrame = isLive && index === slideshowRunIndex;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg p-2"
                          style={{
                            background: isCurrentFrame ? "#f9731615" : "#141414",
                            border: isCurrentFrame ? `1px solid ${ACCENT}` : "1px solid #222",
                          }}
                        >
                          <span className="text-xs w-5 text-center" style={{ color: "#555" }}>
                            {index + 1}
                          </span>
                          <button
                            onClick={() => (isLive ? goToSlideshowFrame(index) : setPreviewIndex(index))}
                            className="w-20 h-12 rounded overflow-hidden shrink-0 bg-black flex items-center justify-center"
                            style={{ border: "1px solid #2a2a2a" }}
                            title={isLive ? "Live zu diesem Bild springen" : "Vorschau"}
                          >
                            {slide ? (
                              <img src={slide.src} alt="" className="w-full h-full object-cover" draggable={false} />
                            ) : (
                              <span className="text-[9px]" style={{ color: "#b91c1c" }}>fehlt</span>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate text-gray-300">{slide?.name ?? "Bild fehlt"}</div>
                          </div>
                          <label className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={item.duration}
                              onChange={(e) =>
                                setSlideshowItemDuration(selected.id, item.id, Number(e.target.value) || 1)
                              }
                              className="w-14 px-2 py-1 rounded text-xs text-white"
                              style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}
                            />
                            <span className="text-[10px]" style={{ color: "#666" }}>s</span>
                          </label>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => index > 0 && reorderSlideshowItems(selected.id, index, index - 1)}
                              disabled={index === 0}
                              className="text-[10px] px-1 rounded disabled:opacity-30"
                              style={{ color: "#888", background: "#1a1a1a" }}
                            >
                              ▲
                            </button>
                            <button
                              onClick={() =>
                                index < selected.items.length - 1 &&
                                reorderSlideshowItems(selected.id, index, index + 1)
                              }
                              disabled={index === selected.items.length - 1}
                              className="text-[10px] px-1 rounded disabled:opacity-30"
                              style={{ color: "#888", background: "#1a1a1a" }}
                            >
                              ▼
                            </button>
                          </div>
                          <button
                            onClick={() => removeSlideshowItem(selected.id, item.id)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: "#b91c1c", background: "#1a1a1a" }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Preview + controls */}
              <div className="w-80 shrink-0 border-l flex flex-col" style={{ borderColor: "#252525", background: "#0d0d0d" }}>
                <div className="p-3">
                  <div
                    className="w-full rounded-lg overflow-hidden relative"
                    style={{ aspectRatio: "16/9", background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                  >
                    <OutputRenderer state={previewPayload} embedded compact muteVideo />
                  </div>
                  {selected.items.length > 0 && (
                    <div className="text-center text-[11px] mt-2" style={{ color: "#666" }}>
                      Bild {Math.min(previewIndex + 1, selected.items.length)} / {selected.items.length}
                    </div>
                  )}
                </div>

                {/* Live controls */}
                <div className="px-3 pb-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={slideshowPrev}
                      disabled={!isLive}
                      className="flex-1 py-2 rounded-lg text-sm disabled:opacity-30"
                      style={{ background: "#141414", color: "#aaa", border: "1px solid #222" }}
                    >
                      ⏮
                    </button>
                    {isLive && slideshowPlaying ? (
                      <button
                        onClick={pauseSlideshow}
                        className="flex-[2] py-2 rounded-lg font-bold text-sm"
                        style={{ background: ACCENT, color: "white" }}
                      >
                        ⏸ Pause
                      </button>
                    ) : isLive ? (
                      <button
                        onClick={resumeSlideshow}
                        className="flex-[2] py-2 rounded-lg font-bold text-sm"
                        style={{ background: ACCENT, color: "white" }}
                      >
                        ▶ Weiter
                      </button>
                    ) : (
                      <button
                        onClick={() => startSlideshow(selected.id)}
                        disabled={selected.items.length === 0}
                        className="flex-[2] py-2 rounded-lg font-bold text-sm disabled:opacity-30"
                        style={{ background: ACCENT, color: "white" }}
                      >
                        ▶ Live starten
                      </button>
                    )}
                    <button
                      onClick={slideshowNext}
                      disabled={!isLive}
                      className="flex-1 py-2 rounded-lg text-sm disabled:opacity-30"
                      style={{ background: "#141414", color: "#aaa", border: "1px solid #222" }}
                    >
                      ⏭
                    </button>
                  </div>

                  {isLive && (
                    <button
                      onClick={stopSlideshow}
                      className="w-full py-2 rounded-lg text-sm"
                      style={{ background: "#1a1a1a", color: "#b91c1c", border: "1px solid #2a2a2a" }}
                    >
                      ⏹ Stoppen (Output leeren)
                    </button>
                  )}

                  <button
                    onClick={handleAddToShow}
                    disabled={selected.items.length === 0}
                    className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-30"
                    style={{ background: "#141414", color: "#4ade80", border: "1px solid #14532d" }}
                  >
                    ＋ Zur Show hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Image picker modal */}
      {isPickerOpen && selected && (
        <ImagePickerModal
          onClose={() => setIsPickerOpen(false)}
          onAdd={(ids) => {
            addImagesToSlideshow(selected.id, ids);
            setIsPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ImagePickerModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (mediaIds: string[]) => void;
}) {
  const slides = useStore((s) => s.slides);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-[640px] max-h-[80vh] rounded-xl flex flex-col" style={{ background: "#111", border: "1px solid #2a2a2a" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#252525" }}>
          <span className="text-sm font-semibold text-white">Bilder auswählen</span>
          <button onClick={onClose} className="text-gray-400 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {slides.length === 0 ? (
            <p className="text-xs text-center" style={{ color: "#444" }}>
              Keine Bilder vorhanden. Importiere Bilder im Medien-Tab.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slides.map((slide) => {
                const checked = selectedIds.includes(slide.id);
                const order = selectedIds.indexOf(slide.id) + 1;
                return (
                  <button
                    key={slide.id}
                    onClick={() => toggle(slide.id)}
                    className="relative rounded-lg overflow-hidden aspect-video bg-black"
                    style={{ border: checked ? `2px solid ${ACCENT}` : "1px solid #2a2a2a" }}
                  >
                    <img src={slide.src} alt="" className="w-full h-full object-cover" draggable={false} />
                    {checked && (
                      <span
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: ACCENT, color: "white" }}
                      >
                        {order}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "#252525" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#1a1a1a", color: "#aaa" }}>
            Abbrechen
          </button>
          <button
            onClick={() => onAdd(selectedIds)}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-30"
            style={{ background: ACCENT, color: "white" }}
          >
            {selectedIds.length > 0 ? `${selectedIds.length} hinzufügen` : "Hinzufügen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")} min`;
}
