// ── Data models ─────────────────────────────────────────────────────────────

export interface SongSlide {
  id: string;
  text: string;
  label?: string; // e.g. "Strophe 1", "Refrain"
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  slides: SongSlide[];
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  src: string; // convertFileSrc result
  type: "image" | "video";
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

export interface OutputPayload {
  mode: OutputMode;
  image?: { src: string };
  video?: { src: string; playing?: boolean };
  song?: { text: string; title: string; index: number; total: number };
  countdown?: { remaining: number; label: string; running: boolean };
}

// ── Store ────────────────────────────────────────────────────────────────────

export type TabId =
  | "slides"
  | "songs"
  | "countdown"
  | "video"
  | "music"
  | "display";
