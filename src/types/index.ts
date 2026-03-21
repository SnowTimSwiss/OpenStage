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

export type MediaType = "image" | "video" | "pdf";

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  src: string; // convertFileSrc or base64 result
  type: MediaType;
  groupId?: string; // For PDF groups
  pageNumber?: number; // For PDF pages
  duration?: number; // For videos (seconds)
  notes?: string; // Private notes for operator
}

export interface PdfGroup {
  id: string;
  name: string;
  pages: MediaItem[];
}

export type MusicSource = "local";

export interface MusicItem {
  id: string;
  name: string;
  path: string;
  src: string;
  source: MusicSource;
  artist?: string;
  album?: string;
  albumArt?: string;
  duration?: number;
  playlistId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: MusicItem[];
  source: MusicSource;
  coverArt?: string;
  createdAt: number;
  updatedAt: number;
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
  | "html"
  | "video"
  | "song"
  | "countdown"
  | "music";

export type CountdownTheme = "default" | "minimal" | "bold";

export interface OutputPayload {
  mode: OutputMode;
  image?: { src: string };
  html?: { content: string };
  video?: { src: string; playing?: boolean; startTime?: number; endTime?: number };
  song?: { text: string; title: string; index: number; total: number };
  countdown?: {
    remaining: number;
    label: string;
    running: boolean;
    theme?: CountdownTheme;
    targetTime?: string | null;
    isFadingOut?: boolean;
  };
  music?: {
    src: string;
    playing?: boolean;
    trackName?: string;
    artist?: string;
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

export type TabId =
  | "media"
  | "songs"
  | "countdown"
  | "music"
  | "display"
  | "show";

export type TransitionType = "none" | "fade" | "slide" | "zoom";

// ── Show Mode ────────────────────────────────────────────────────────────────

export type ShowItemType = "image" | "video" | "song" | "countdown" | "pdf" | "music" | "playlist";

export interface ShowItem {
  id: string;
  type: ShowItemType;
  refId?: string; // reference to existing media/song/pdf group
  label: string;
  slideIndex?: number; // for songs/pdf: current page number
  musicTrackId?: string; // for music: specific track to play
  playlistId?: string; // for playlist: which playlist to play
  showMusicOverlay?: boolean; // show title/artist on output (default: true)
}
