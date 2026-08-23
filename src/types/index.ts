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
  combineSlides?: boolean;
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

// ── Slideshow ────────────────────────────────────────────────────────────────

export interface SlideshowItem {
  id: string;
  mediaId: string; // references an image MediaItem in the slides library
  duration: number; // seconds to display this image
}

export interface Slideshow {
  id: string;
  name: string;
  items: SlideshowItem[];
  loop: boolean;
  defaultDuration: number; // default seconds applied to newly added images
  backgroundPlaylistId?: string | null; // optional background music playlist
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
  song?: { text: string; title: string; artist?: string; index: number; total: number; backgroundImage?: string | null; allSlides?: boolean };
  countdown?: {
    remaining: number;
    label: string;
    running: boolean;
    theme?: CountdownTheme;
    targetTime?: string | null;
    isFadingOut?: boolean;
  };
  // Music output is deliberately anonymous: the audience sees the background
  // image (or plain black), never the track/file name.
  music?: {
    src: string;
    playing?: boolean;
    backgroundImage?: string | null;
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

export type TabId =
  | "media"
  | "songs"
  | "countdown"
  | "music"
  | "display"
  | "show"
  | "slideshow";

export type TransitionType = "none" | "fade" | "slide" | "zoom";

// ── Show Mode ────────────────────────────────────────────────────────────────

export type ShowItemType =
  | "image"
  | "video"
  | "song"
  | "countdown"
  | "pdf"
  | "music"
  | "playlist"
  | "slideshow"
  | "blank";

/** Ready-made filler slide: plain black or the configured background image. */
export type BlankVariant = "black" | "background";

export interface ShowItem {
  id: string;
  type: ShowItemType;
  refId?: string; // reference to existing media/song/pdf group
  label: string;
  slideIndex?: number; // for songs/pdf: current page number
  musicTrackId?: string; // for music: specific track to play
  playlistId?: string; // for playlist: which playlist to play
  slideshowId?: string; // for slideshow: which slideshow to play
  blankVariant?: BlankVariant; // for blank: black screen or background image
}

