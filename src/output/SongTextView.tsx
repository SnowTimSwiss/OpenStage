import { useLayoutEffect, useMemo, useRef, useState } from "react";

interface SongTextViewProps {
  /** Song text; blank lines separate verse blocks (never split across columns). */
  text: string;
  /** Smaller font range and gaps for the embedded operator previews. */
  compact?: boolean;
}

interface FitLayout {
  fontSize: number;
  columns: number;
}

/**
 * Renders song text at the largest font size that still fits the box it is
 * given. Used for single-verse slides as well as "whole song on one slide":
 * blank-line separated verse blocks stay intact and are only split into two
 * columns when that buys a noticeably larger font. Because the text is always
 * fitted to its box it can never grow past the screen or run over the
 * title/artist footer.
 */
export default function SongTextView({ text, compact = false }: SongTextViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FitLayout>({ fontSize: compact ? 13 : 32, columns: 1 });

  const blocks = useMemo(
    () =>
      text
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean),
    [text]
  );
  const canUseTwoColumns = blocks.length > 1;
  const minFont = compact ? 7 : 14;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const availW = container.clientWidth;
      const availH = container.clientHeight;
      if (availW <= 0 || availH <= 0) return;

      const maxFont = Math.max(minFont, Math.min(compact ? 30 : 96, availH * 0.16));

      const prevFontSize = content.style.fontSize;
      const prevColumns = content.style.columnCount;

      // True when the content fits the box at the given font size / columns.
      // Mutates the node and forces a reflow.
      const fits = (fontSize: number, columns: number) => {
        content.style.fontSize = `${fontSize}px`;
        content.style.columnCount = String(columns);
        return content.scrollHeight <= availH + 1 && content.scrollWidth <= availW + 1;
      };

      // Largest font size (within [minFont, maxFont]) that fits for a column count.
      const bestFontFor = (columns: number) => {
        if (!fits(minFont, columns)) return minFont; // even the minimum overflows → clamp
        let lo = minFont;
        let hi = maxFont;
        let best = minFont;
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
      const twoCol = { columns: 2, fontSize: canUseTwoColumns ? bestFontFor(2) : 0 };

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

    // Re-fit once the webfont is loaded: measuring against the fallback font
    // would pick a size that overflows with the real one.
    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) measure();
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text, compact, canUseTwoColumns, minFont]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div
        ref={contentRef}
        className="text-white"
        style={{
          width: "100%",
          fontSize: `${layout.fontSize}px`,
          columnCount: layout.columns,
          columnGap: compact ? "1.5rem" : "4rem",
          columnFill: "balance",
          textAlign: "center",
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
