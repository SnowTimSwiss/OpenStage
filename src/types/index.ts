// ── Data models ─────────────────────────────────────────────────────────────

export interface SongSlide {
  id: string;
  text: string;
  label?: string; // e.g. "Strophe 1", "Refrain"
  notes?: string; // Private notes for operator (not shown on output)
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  slides: SongSlide[];
}

export type MediaType = "image" | "video";

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  src: string; // convertFileSrc or base64 result
  type: MediaType;
  groupId?: string; // For PPTX groups
  duration?: number; // For videos (seconds)
  notes?: string; // Private notes for operator
}

export interface PptxGroup {
  id: string;
  name: string;
  slides: MediaItem[];
}

export interface MusicItem {
  id: string;
  name: string;
  path: string;
  src: string;
}

export interface Monitor {
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

// ── Output state ─────────────────────────────────────────────────────────────

export type OutputMode =
  | "blank"
  | "blackout"
  | "image"
  | "video"
  | "song"
  | "countdown";

export type CountdownTheme = "default" | "minimal" | "bold";

export interface OutputPayload {
  mode: OutputMode;
  image?: { src: string };
  video?: { src: string; playing?: boolean; startTime?: number; endTime?: number };
  song?: { text: string; title: string; index: number; total: number };
  countdown?: { remaining: number; label: string; running: boolean; theme?: CountdownTheme; targetTime?: string | null };
}

// ── Store ────────────────────────────────────────────────────────────────────

export type TabId =
  | "media"
  | "songs"
  | "countdown"
  | "music"
  | "display";

export type TransitionType = "none" | "fade" | "slide" | "zoom";
