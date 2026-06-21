import { useLayoutEffect, useRef, useState } from "react";

interface SongAllSlidesViewProps {
  /** Combined song text, verse blocks separated by blank lines. */
  text: string;
  /** Smaller min/max font range for embedded previews. */
  compact?: boolean;
}

interface FitLayout {
  fontSize: number;
  columns: number;
}

/**
 * Renders a whole song on a single slide and automatically picks the largest
 * font size (and 1- vs 2-column layout) that fits the available space without
 * overflowing. Verse blocks are kept intact (never split across columns).
 */
export default function SongAllSlidesView({ text, compact = false }: SongAllSlidesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FitLayout>({ fontSize: compact ? 14 : 32, columns: 1 });

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const availW = container.clientWidth;
      const availH = container.clientHeight;
      if (availW === 0 || availH === 0) return;

      const MIN = compact ? 7 : 14;
      const MAX = Math.max(MIN, Math.min(compact ? 30 : 96, availH * 0.16));

      const prevFontSize = content.style.fontSize;
      const prevColumns = content.style.columnCount;

      // Returns true if the content fits within the available box at the
      // given font size / column count. Mutates the node and forces a reflow.
      const fits = (fontSize: number, columns: number) => {
        content.style.fontSize = `${fontSize}px`;
        content.style.columnCount = String(columns);
        return content.scrollHeight <= availH + 1 && content.scrollWidth <= availW + 1;
      };

      // Largest font size (within [MIN, MAX]) that fits for a given column count.
      const bestFontFor = (columns: number) => {
        if (!fits(MIN, columns)) return MIN; // even minimum overflows → clamp
        let lo = MIN;
        let hi = MAX;
        let best = MIN;
        while (hi - lo > 0.5) {
          const mid = (lo + hi) / 2;
          if (fits(mid, columns)) {
            best = mid;
            lo = mid;
          } else {
            hi = mid;
          }
        }
        return best;
      };

      const oneCol = { columns: 1, fontSize: bestFontFor(1) };
      const twoCol = { columns: 2, fontSize: blocks.length > 1 ? bestFontFor(2) : 0 };

      // Prefer a single column unless two columns are meaningfully larger.
      const chosen = twoCol.fontSize > oneCol.fontSize * 1.15 ? twoCol : oneCol;

      content.style.fontSize = prevFontSize;
      content.style.columnCount = prevColumns;

      setLayout((prev) =>
        prev.fontSize === chosen.fontSize && prev.columns === chosen.columns ? prev : chosen
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text, compact, blocks.length]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div
        ref={contentRef}
        className="text-white"
        style={{
          fontSize: `${layout.fontSize}px`,
          columnCount: layout.columns,
          columnGap: compact ? "1.5rem" : "4rem",
          columnFill: "balance",
          textAlign: "center",
          maxWidth: "100%",
          fontFamily: "'Sora', sans-serif",
          fontWeight: 300,
          lineHeight: 1.3,
          textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          letterSpacing: "0.01em",
        }}
      >
        {blocks.map((block, index) => (
          <p
            key={index}
            className="whitespace-pre-line"
            style={{ breakInside: "avoid", margin: index === 0 ? 0 : "0.9em 0 0" }}
          >
            {block}
          </p>
        ))}
      </div>
    </div>
  );
}
