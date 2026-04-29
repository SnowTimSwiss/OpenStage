import type { Song } from "../types";

function formatCombinedSlideText(song: Song): string {
  return song.slides
    .map((slide) => {
      const parts = [];

      if (slide.label?.trim()) {
        parts.push(slide.label.trim());
      }

      if (slide.text?.trim()) {
        parts.push(slide.text.trim());
      }

      return parts.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function getSongEffectiveSlideCount(song: Song): number {
  if (song.combineSlides) {
    return song.slides.length > 0 ? 1 : 0;
  }

  return song.slides.length;
}

export function getSongPresentation(song: Song, requestedIndex = 0) {
  if (song.combineSlides) {
    return {
      text: formatCombinedSlideText(song),
      index: 0,
      total: song.slides.length > 0 ? 1 : 0,
    };
  }

  const safeIndex = Math.max(0, Math.min(requestedIndex, Math.max(0, song.slides.length - 1)));
  const slide = song.slides[safeIndex];

  return {
    text: slide?.text ?? "",
    index: safeIndex,
    total: song.slides.length,
  };
}
