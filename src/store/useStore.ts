import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  sendToOutput,
  getLastOutputPayload,
  openOutputWindowForMonitor,
  assignOutputWindowToMonitor,
  closeOutputWindowForMonitor,
  closeAllOutputWindows as closeAllOutputFn,
  OUTPUT_READY_EVENT,
} from "../lib/events";
import { secondsUntilTargetTime } from "../lib/formatTime";
import {
  fetchRepoContents,
  downloadSong,
  processRepositoryContents,
} from "../lib/github";
import type {
  Song, MediaItem, MusicItem, Playlist, MusicSource,
  Monitor, TabId, OutputMode, PdfGroup, CountdownTheme, ShowItem,
  RepositorySong,
} from "../types";

const STORAGE_KEY = "openstage-settings-v1";
const PLAYLISTS_KEY = "openstage-playlists-v1";
const MEDIA_STORAGE_KEY = "openstage-media-v1";
const SHOW_STORAGE_KEY = "openstage-show-v1";

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let musicAudio: HTMLAudioElement | null = null;
let musicAudioSrc: string | null = null;
let backgroundMusicAudio: HTMLAudioElement | null = null;
let countdownBgPlaylistId: string | null = null;
let countdownBgQueue: MusicItem[] = [];
let countdownBgIndex = 0;
let countdownBgBound = false;
let countdownBgStarted = false;
let countdownBgStarting = false;
let countdownBgStartOffsetSeconds = 0;
let countdownEndTime: number | null = null;
let countdownFadeOutTimeout: ReturnType<typeof setTimeout> | null = null;
let outputReadyListenerInitialized = false;

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as any).message ?? (err as any).error ?? (err as any).reason;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function isOutputWebview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("window") === "output";
  } catch {
    return false;
  }
}

function initOutputReplayListener() {
  if (outputReadyListenerInitialized || isOutputWebview() || typeof window === "undefined") return;
  outputReadyListenerInitialized = true;

  void listen(OUTPUT_READY_EVENT, () => {
    void sendToOutput(getLastOutputPayload());
  });
}

function ensureMusicAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (isOutputWebview()) return null;
  if (musicAudio) return musicAudio;
  musicAudio = new Audio();
  musicAudio.preload = "metadata";
  return musicAudio;
}

function ensureBackgroundMusicAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (isOutputWebview()) return null;
  if (backgroundMusicAudio) return backgroundMusicAudio;
  backgroundMusicAudio = new Audio();
  backgroundMusicAudio.preload = "metadata";
  return backgroundMusicAudio;
}

function stopCountdownBackgroundMusic() {
  const a = ensureBackgroundMusicAudio();
  countdownBgPlaylistId = null;
  countdownBgQueue = [];
  countdownBgIndex = 0;
  countdownBgStarted = false;
  countdownBgStarting = false;
  countdownBgStartOffsetSeconds = 0;
  if (!a) return;
  try {
    a.pause();
  } catch {
    // ignore
  }
  try {
    a.src = "";
  } catch {
    // ignore
  }
}

function normalizeMinutes(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(240, n));
}

function normalizeVolume(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Lädt die Metadaten einer Audio-Datei und gibt die Dauer in Sekunden zurück.
 */
function getAudioDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
    };

    audio.onloadedmetadata = () => {
      cleanup();
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      resolve(duration);
    };

    audio.onerror = (err) => {
      cleanup();
      reject(new Error(`Failed to load audio metadata: ${err}`));
    };

    audio.src = src;
  });
}

/**
 * Berechnet die aktuelle Lautstärke basierend auf der verbleibenden Zeit und den Fade-Einstellungen.
 *
 * Logik:
 * - musicStartMinutes: X Minuten vor 00 startet die Musik mit startVolumePercent
 * - fadeInStartMinutes: Ab hier fängt die Musik an lauter zu werden
 * - fullVolumeMinutes: Ab hier ist die Musik auf 100%
 *
 * @param remainingSeconds Verbleibende Sekunden bis 00
 */
function calculateCountdownMusicVolume(remainingSeconds: number): number {
  const a = ensureBackgroundMusicAudio();
  if (!a) return 0;

  const {
    countdownBackgroundMusicVolume,
    countdownBackgroundMusicStartMinutes,
    countdownBackgroundMusicFadeInStartMinutes,
    countdownBackgroundMusicFullVolumeMinutes,
    countdownBackgroundMusicStartVolumePercent,
  } = useStore.getState();

  // Convert minutes to seconds
  const startSec = Math.max(0, countdownBackgroundMusicStartMinutes) * 60;
  const fadeInStartSec = Math.max(0, countdownBackgroundMusicFadeInStartMinutes) * 60;
  const fullSec = Math.max(0, countdownBackgroundMusicFullVolumeMinutes) * 60;

  // Target volume (max volume, typically 1.0 = 100%)
  const targetVolume = normalizeVolume(countdownBackgroundMusicVolume, 1.0);

  // Start volume as percentage (0-100% of targetVolume)
  const startVolumePercent = Math.max(0, Math.min(100, countdownBackgroundMusicStartVolumePercent)) / 100;
  const startVolume = startVolumePercent * targetVolume;

  // Before music starts: silent
  if (remainingSeconds > startSec) {
    return 0;
  }

  // Music has started but before fade-in: use start volume
  if (remainingSeconds > fadeInStartSec) {
    return startVolume;
  }

  // In fade-in period: ramp from startVolume to targetVolume
  if (remainingSeconds > fullSec) {
    // Calculate progress through fade-in (0 at fadeInStart, 1 at fullSec)
    const fadeRange = fadeInStartSec - fullSec;
    if (fadeRange <= 0) {
      return targetVolume;
    }
    const t = (fadeInStartSec - remainingSeconds) / fadeRange; // 0..1
    return startVolume + (targetVolume - startVolume) * t;
  }

  // At full volume
  return targetVolume;
}

function getEffectiveTrackDuration(track: MusicItem): number {
  const rawDuration = Number(track.duration || 0);
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
    return 0;
  }

  return rawDuration;
}

async function resolveCountdownQueueDurations(queue: MusicItem[]): Promise<MusicItem[]> {
  const resolved = await Promise.all(
    queue.map(async (track) => {
      const effective = getEffectiveTrackDuration(track);
      if (effective > 0) {
        return { ...track, duration: effective };
      }

      if (!track.src) {
        return track;
      }

      try {
        const duration = await getAudioDuration(track.src);
        return { ...track, duration };
      } catch {
        return track;
      }
    })
  );

  return resolved;
}

/**
 * Berechnet die optimale Startposition in der Playlist, sodass das letzte Lied genau bei 00 endet.
 *
 * @param remainingSeconds Verbleibende Sekunden bis 00
 * @param queue Playlist mit Liedern
 * @param startIndex Aktueller Index in der Playlist
 * @returns Objekt mit startIndex und skipTracks (Anzahl der zu überspringenden Sekunden im ersten Track)
 */
function calculateOptimalPlaylistStart(
  remainingSeconds: number,
  queue: MusicItem[],
  startIndex: number
): { startIndex: number; skipSeconds: number } {
  if (queue.length === 0 || remainingSeconds <= 0) {
    return { startIndex: 0, skipSeconds: 0 };
  }

  const totalDuration = queue.reduce((sum, track) => sum + getEffectiveTrackDuration(track), 0);
  if (totalDuration <= 0) {
    return { startIndex: 0, skipSeconds: 0 };
  }

  const loopsNeeded = Math.ceil(remainingSeconds / totalDuration);
  const effectiveDuration = loopsNeeded * totalDuration;
  const secondsToFill = effectiveDuration - remainingSeconds;
  let accumulatedTime = 0;
  let optimalIndex = startIndex;
  let skipSeconds = 0;

  for (let i = 0; i < queue.length; i++) {
    const trackIndex = (startIndex + i) % queue.length;
    const track = queue[trackIndex];
    const trackDuration = getEffectiveTrackDuration(track);

    if (accumulatedTime + trackDuration >= secondsToFill) {
      optimalIndex = trackIndex;
      skipSeconds = Math.max(0, secondsToFill - accumulatedTime);
      break;
    }

    accumulatedTime += trackDuration;
  }

  return { startIndex: optimalIndex, skipSeconds };
}

function updateCountdownBgVolume(remainingSeconds: number) {
  const a = ensureBackgroundMusicAudio();
  if (!a) return;

  const { outputMode, isBlackout } = useStore.getState();
  const shouldBeAudible = outputMode === "countdown" && !isBlackout;
  const desired = shouldBeAudible ? calculateCountdownMusicVolume(remainingSeconds) : 0;

  if (Number.isFinite(desired)) {
    a.volume = desired;
  }
}

function isCountdownOutputActive() {
  const { outputMode, isBlackout } = useStore.getState();
  return outputMode === "countdown" && !isBlackout;
}

function sendCurrentCountdownToOutput(
  overrides: {
    remaining?: number;
    label?: string;
    running?: boolean;
    theme?: CountdownTheme;
    targetTime?: string | null;
    isFadingOut?: boolean;
  } = {},
  force = false
) {
  const state = useStore.getState();
  if (!force && !isCountdownOutputActive()) return;

  sendToOutput({
    mode: "countdown",
    countdown: {
      remaining: state.countdownRemaining,
      label: state.countdownLabel,
      running: state.countdownRunning,
      theme: state.countdownTheme,
      targetTime: state.countdownTargetTime,
      ...overrides,
    },
  });
}

function clearCountdownFadeOutTimeout() {
  if (countdownFadeOutTimeout) {
    clearTimeout(countdownFadeOutTimeout);
    countdownFadeOutTimeout = null;
  }
}

function playCountdownBackgroundTrack(track: MusicItem | undefined, startSeconds = 0) {
  const a = ensureBackgroundMusicAudio();
  if (!a || !track?.src) return;

  const safeStartSeconds = Math.max(0, startSeconds);

  const beginPlayback = () => {
    try {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        a.currentTime = Math.min(safeStartSeconds, Math.max(0, a.duration - 0.05));
      } else {
        a.currentTime = safeStartSeconds;
      }
    } catch {
      // ignore seek issues until metadata is available
    }

    updateCountdownBgVolume(useStore.getState().countdownRemaining || 0);
    a.play().catch(() => {});
  };

  try {
    a.pause();
  } catch {
    // ignore
  }

  a.src = track.src;
  a.load();

  if (safeStartSeconds > 0) {
    a.addEventListener("loadedmetadata", beginPlayback, { once: true });
    return;
  }

  beginPlayback();
}

function maybeStartCountdownBackgroundMusic(remainingSeconds: number) {
  if (countdownBgStarted || countdownBgStarting || !countdownBgQueue.length) return;

  const startSec = Math.max(0, useStore.getState().countdownBackgroundMusicStartMinutes) * 60;
  if (remainingSeconds > startSec) return;

  countdownBgStarting = true;
  void (async () => {
    try {
      const hydratedQueue = await resolveCountdownQueueDurations(countdownBgQueue);
      countdownBgQueue = hydratedQueue;

      const state = useStore.getState();
      if (!state.countdownRunning) return;

      const liveRemaining = countdownEndTime
        ? Math.max(0, Math.ceil((countdownEndTime - Date.now()) / 1000))
        : Math.max(0, remainingSeconds);

      if (liveRemaining <= 0) return;

      const optimalStart = calculateOptimalPlaylistStart(liveRemaining, countdownBgQueue, 0);
      countdownBgIndex = optimalStart.startIndex;
      countdownBgStartOffsetSeconds = optimalStart.skipSeconds;
      countdownBgStarted = true;
      playCountdownBackgroundTrack(countdownBgQueue[countdownBgIndex], countdownBgStartOffsetSeconds);
    } finally {
      countdownBgStarting = false;
    }
  })();
}

function ensureCountdownBgHandlers() {
  const a = ensureBackgroundMusicAudio();
  if (!a || countdownBgBound) return;
  countdownBgBound = true;

  a.addEventListener("ended", () => {
    if (!countdownBgQueue.length) return;
    const { countdownRunning, countdownRemaining } = useStore.getState();
    const reachedEndTime = countdownEndTime !== null && Date.now() >= countdownEndTime - 150;
    if (!countdownRunning || countdownRemaining <= 0 || reachedEndTime) return;

    // Move to next track in loop
    countdownBgIndex = (countdownBgIndex + 1) % countdownBgQueue.length;
    const next = countdownBgQueue[countdownBgIndex];

    playCountdownBackgroundTrack(next, 0);
  });
}

interface Store {
  // ── UI ─────────────────────────────────────────────────────────────────
  activeTab: TabId;
  outputWindowReady: boolean;
  setActiveTab: (tab: TabId) => void;

  // ── Loading / Error States ─────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // ── Output state ────────────────────────────────────────────────────────
  outputMode: OutputMode;
  isBlackout: boolean;
  toggleBlackout: () => void;
  clearOutput: () => void;

  // ── Slides (images) ────────────────────────────────────────────────────
  slides: MediaItem[];
  activeSlideId: string | null;
  loadMedia: () => Promise<void>;
  loadSlides: () => Promise<void>;
  goLiveSlide: (id: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  removeSlide: (id: string) => void;

  // ── PDF Groups ────────────────────────────────────────────────────────
  pdfGroups: PdfGroup[];
  expandedGroupId: string | null;
  loadPdf: () => Promise<void>;
  toggleExpandGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  goLivePageFromGroup: (groupId: string, pageIndex: number) => void;

  // ── Songs ──────────────────────────────────────────────────────────────
  songs: Song[];
  activeSongId: string | null;
  activeSongSlide: number;
  addSong: (song: Omit<Song, "id">) => void;
  updateSong: (id: string, song: Omit<Song, "id">) => void;
  removeSong: (id: string) => void;
  selectSong: (id: string) => void;
  goLiveSongSlide: (songId: string, index: number) => void;
  nextSongSlide: () => void;
  prevSongSlide: () => void;

  // ── GitHub Repository ─────────────────────────────────────────────────
  githubRepoOwner: string;
  githubRepoName: string;
  fetchRepositorySongs: () => Promise<RepositorySong[]>;
  downloadRepositorySong: (song: RepositorySong) => Promise<Song>;

  // ── Countdown ──────────────────────────────────────────────────────────
  countdownRemaining: number;
  countdownLabel: string;
  countdownRunning: boolean;
  countdownLive: boolean;
  countdownTargetTime: string | null;
  countdownTheme: CountdownTheme;
  countdownBackgroundMusicId: string | null; // deprecated (song-as-audio-path)
  countdownBackgroundPlaylistId: string | null;
  countdownBackgroundMusicVolume: number;
  countdownBackgroundMusicStartMinutes: number; // Musik startet X Minuten vor 00
  countdownBackgroundMusicStartVolumePercent: number; // Startlautstärke in Prozent (0-100)
  countdownBackgroundMusicFadeInStartMinutes: number; // Fade-In beginnt X Minuten vor 00
  countdownBackgroundMusicFullVolumeMinutes: number; // 100% Lautstärke ab X Minuten vor 00
  countdownDisplayAfterZeroSeconds: number; // Countdown-Anzeige bleibt X Sekunden nach 00 sichtbar
  setCountdownLabel: (l: string) => void;
  setCountdownTargetTime: (t: string | null) => void;
  applyCountdownTargetTime: () => void;
  setCountdownTheme: (theme: CountdownTheme) => void;
  setCountdownBackgroundMusic: (id: string | null) => void;
  setCountdownBackgroundPlaylist: (id: string | null) => void;
  setCountdownBackgroundMusicVolume: (v: number) => void;
  setCountdownBackgroundMusicStartMinutes: (m: number) => void;
  setCountdownBackgroundMusicStartVolumePercent: (p: number) => void;
  setCountdownBackgroundMusicFadeInStartMinutes: (m: number) => void;
  setCountdownBackgroundMusicFullVolumeMinutes: (m: number) => void;
  setCountdownDisplayAfterZeroSeconds: (s: number) => void;
  startCountdown: () => void;
  stopCountdown: () => void;
  resetCountdown: () => void;
  setCountdownLive: (live: boolean) => void;

  // ── Video ──────────────────────────────────────────────────────────────
  videos: MediaItem[];
  activeVideoId: string | null;
  videoStartTime: number | null; // seconds
  videoEndTime: number | null; // seconds
  loadVideos: () => Promise<void>;
  goLiveVideo: (id: string) => void;
  removeVideo: (id: string) => void;
  setVideoStartTime: (s: number | null) => void;
  setVideoEndTime: (s: number | null) => void;

  // ── Music ──────────────────────────────────────────────────────────────
  music: MusicItem[];
  musicIndex: number;
  musicPlaying: boolean;
  musicVolume: number;
  musicCurrentTime: number;
  musicDuration: number;
  musicFadeDuration: number; // seconds for fade in/out
  loadMusic: (playlistId?: string | null) => Promise<void>;
  loadMusicFromFolder: (playlistId?: string | null) => Promise<void>;
  resetAllMusic: () => void;
  setMusicIndex: (i: number) => void;
  setMusicPlaying: (p: boolean) => void;
  toggleMusicPlaying: () => void;
  playNextMusic: () => void;
  playPrevMusic: () => void;
  seekMusic: (time: number) => void;
  setMusicVolume: (v: number) => void;
  reorderMusic: (fromIndex: number, toIndex: number) => void;
  removeMusic: (id: string) => void;
  setMusicFadeDuration: (s: number) => void;

  // ── Playlists ──────────────────────────────────────────────────────────
  playlists: Playlist[];
  activePlaylistId: string | null;
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (id: string) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  addTrackToPlaylist: (playlistId: string, track: MusicItem) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  setActivePlaylist: (id: string | null) => void;
  loadPlaylist: (playlistId: string) => void;

  // ── Display ────────────────────────────────────────────────────────────
  monitors: Monitor[];
  outputMonitorIndices: number[]; // Array of monitor indices that have output windows open
  outputWindowsOpen: Record<number, boolean>; // Map of monitor index -> window open state
  fetchMonitors: () => Promise<void>;
  toggleOutputMonitor: (i: number) => Promise<void>;
  closeAllOutputWindows: () => Promise<void>;

  // ── Show Mode ──────────────────────────────────────────────────────────
  showQueue: ShowItem[];
  showCurrentIndex: number;
  addToShowQueue: (item: ShowItem) => void;
  removeFromShowQueue: (id: string) => void;
  setShowCurrentIndex: (index: number) => void;
  updateShowItemSlideIndex: (itemId: string, slideIndex: number) => void;
  showNext: () => void;
  showPrevious: () => void;
  showNextSlide: () => void; // next slide within current item (for songs/pdf)
  showPreviousSlide: () => void; // previous slide within current item
  reorderShowQueue: (fromIndex: number, toIndex: number) => void;
  clearShowQueue: () => void;
  advanceShowOnMusicEnd: () => void; // advance show when music track ends

  // ── Persist & Reset ─────────────────────────────────────────────────────
  resetMedia: () => void;
  resetShow: () => void;

  // ── Persist settings ────────────────────────────────────────────────────
  loadSettings: () => void;
  saveSettings: () => void;
}

export const useStore = create<Store>((set, get) => ({
  // ── UI ──────────────────────────────────────────────────────────────────
  activeTab: "media" as TabId,
  outputWindowReady: false,
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Loading / Error ─────────────────────────────────────────────────────
  isLoading: false,
  error: null,
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // ── Output ──────────────────────────────────────────────────────────────
  outputMode: "blank",
  isBlackout: false,

  toggleBlackout: () => {
    const next = !get().isBlackout;
    set({ isBlackout: next });
    sendToOutput({ mode: next ? "blackout" : "blank" });
  },

  clearOutput: () => {
    set({ outputMode: "blank", isBlackout: false, activeSlideId: null, activeVideoId: null });
    sendToOutput({ mode: "blank" });
  },

  // ── Slides ──────────────────────────────────────────────────────────────
  slides: [],
  activeSlideId: null,

  loadMedia: async () => {
    const { setLoading, setError, clearError } = get();
    const imageExt = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
    const videoExt = new Set(["mp4", "mov", "avi", "mkv", "webm"]);
    const allExt = [...imageExt, ...videoExt];

    const extOf = (p: string) => {
      const file = p.split(/[\\/]/).pop() ?? p;
      const idx = file.lastIndexOf(".");
      return idx >= 0 ? file.slice(idx + 1).toLowerCase() : "";
    };

    try {
      setLoading(true);
      clearError();
      const files = await openDialog({
        multiple: true,
        filters: [
          { name: "Medien", extensions: allExt },
          { name: "Bilder", extensions: [...imageExt] },
          { name: "Videos", extensions: [...videoExt] },
        ],
      });
      if (!files) return;
      const arr = Array.isArray(files) ? files : [files];

      const slidesToAdd: MediaItem[] = [];
      const videosToAdd: MediaItem[] = [];

      for (const f of arr) {
        const path = f as string;
        const name = path.split(/[\\/]/).pop() ?? path;
        const ext = extOf(path);
        if (imageExt.has(ext)) {
          slidesToAdd.push({
            id: crypto.randomUUID(),
            name,
            path,
            src: convertFileSrc(path),
            type: "image",
          });
        } else if (videoExt.has(ext)) {
          videosToAdd.push({
            id: crypto.randomUUID(),
            name,
            path,
            src: convertFileSrc(path),
            type: "video",
          });
        }
      }

      set((s) => ({
        slides: slidesToAdd.length ? [...s.slides, ...slidesToAdd] : s.slides,
        videos: videosToAdd.length ? [...s.videos, ...videosToAdd] : s.videos,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Medien");
    } finally {
      setLoading(false);
    }
  },

  loadSlides: async () => {
    const { setLoading, setError, clearError } = get();
    try {
      setLoading(true);
      clearError();
      const files = await openDialog({
        multiple: true,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
      });
      if (!files) return;
      const arr = Array.isArray(files) ? files : [files];
      const items: MediaItem[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        name: (f as string).split(/[\\/]/).pop() ?? f as string,
        path: f as string,
        src: convertFileSrc(f as string),
        type: "image",
      }));
      set((s) => ({ slides: [...s.slides, ...items] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Folien");
    } finally {
      setLoading(false);
    }
  },

  goLiveSlide: (id) => {
    const slide = get().slides.find((s) => s.id === id);
    if (!slide) return;
    set({ activeSlideId: id, outputMode: "image", isBlackout: false });
    sendToOutput({ mode: "image", image: { src: slide.src } });
  },

  reorderSlides: (fromIndex: number, toIndex: number) => {
    set((s) => {
      const newSlides = [...s.slides];
      const [removed] = newSlides.splice(fromIndex, 1);
      newSlides.splice(toIndex, 0, removed);
      return { slides: newSlides };
    });
  },

  removeSlide: (id) =>
    set((s) => ({ slides: s.slides.filter((x) => x.id !== id) })),

  // ── PDF Groups ────────────────────────────────────────────────────────
  pdfGroups: [],
  expandedGroupId: null,

  loadPdf: async () => {
    const { setLoading, setError, clearError } = get();

    try {
      setLoading(true);
      clearError();
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const pdfjsLib = await import("pdfjs-dist");

      // Configure PDF.js worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).toString();

      const files = await openDialog({
        multiple: true,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!files) return;
      const arr = Array.isArray(files) ? files : [files];

      for (const file of arr) {
        const filePath = file as string;

        const raw = await readFile(filePath);
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayLike<number>);

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        if (pdf.numPages === 0) {
          throw new Error("Keine Seiten gefunden. Bitte pruefe die PDF-Datei. (PowerPoint als PDF exportieren)");
        }

        const groupId = crypto.randomUUID();
        const fileName =
          filePath.split("\\").pop() ??
          filePath.split("/").pop() ??
          "Document";

        // Render all pages to canvas
        const pages: MediaItem[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 }); // HiDPI scale

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");

          if (!context) continue;

          await page.render({
            canvasContext: context,
            canvas,
            viewport,
          }).promise;

          // Convert canvas to base64 data URL
          const dataUrl = canvas.toDataURL("image/png");

          pages.push({
            id: crypto.randomUUID(),
            name: `Seite ${i}`,
            path: filePath,
            src: dataUrl,
            type: "pdf",
            groupId,
            pageNumber: i,
          });
        }

        set((s) => ({
          pdfGroups: [...s.pdfGroups, { id: groupId, name: fileName, pages }],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der PDF-Datei");
    } finally {
      setLoading(false);
    }
  },

  toggleExpandGroup: (groupId) =>
    set((s) => ({ expandedGroupId: s.expandedGroupId === groupId ? null : groupId })),

  removeGroup: (groupId) =>
    set((s) => ({
      pdfGroups: s.pdfGroups.filter((g) => g.id !== groupId),
      slides: s.slides.filter((x) => x.groupId !== groupId),
    })),

  goLivePageFromGroup: (groupId, pageIndex) => {
    const group = get().pdfGroups.find((g) => g.id === groupId);
    if (!group || !group.pages[pageIndex]) return;
    const page = group.pages[pageIndex];
    set({ activeSlideId: page.id, outputMode: "image", isBlackout: false });
    sendToOutput({ mode: "image", image: { src: page.src } });
  },

  // ── Songs ──────────────────────────────────────────────────────────────
  songs: [],
  activeSongId: null,
  activeSongSlide: 0,

  addSong: (song) =>
    set((s) => ({ songs: [...s.songs, { ...song, id: crypto.randomUUID() }] })),

  updateSong: (id, song) =>
    set((s) => ({ songs: s.songs.map((x) => (x.id === id ? { ...song, id } : x)) })),

  removeSong: (id) =>
    set((s) => ({
      songs: s.songs.filter((x) => x.id !== id),
      activeSongId: s.activeSongId === id ? null : s.activeSongId,
    })),

  selectSong: (id) => set({ activeSongId: id, activeSongSlide: 0 }),

  goLiveSongSlide: (songId, index) => {
    const song = get().songs.find((s) => s.id === songId);
    if (!song || !song.slides[index]) return;
    set({ activeSongId: songId, activeSongSlide: index, outputMode: "song", isBlackout: false });
    sendToOutput({
      mode: "song",
      song: {
        text: song.slides[index].text,
        title: song.title,
        index,
        total: song.slides.length,
      },
    });
  },

  nextSongSlide: () => {
    const { activeSongId, activeSongSlide, songs, goLiveSongSlide } = get();
    if (!activeSongId) return;
    const song = songs.find((s) => s.id === activeSongId);
    if (!song) return;
    const next = Math.min(activeSongSlide + 1, song.slides.length - 1);
    goLiveSongSlide(activeSongId, next);
  },

  prevSongSlide: () => {
    const { activeSongId, activeSongSlide, songs, goLiveSongSlide } = get();
    if (!activeSongId) return;
    const song = songs.find((s) => s.id === activeSongId);
    if (!song) return;
    const prev = Math.max(activeSongSlide - 1, 0);
    goLiveSongSlide(activeSongId, prev);
  },

  // ── GitHub Repository ─────────────────────────────────────────────────
  githubRepoOwner: "SnowTimSwiss",
  githubRepoName: "OpenStage-songs",

  fetchRepositorySongs: async () => {
    const { songs: localSongs } = get();
    try {
      const contents = await fetchRepoContents();
      return await processRepositoryContents(contents, localSongs);
    } catch (err) {
      console.error("Failed to fetch repository songs:", err);
      throw err;
    }
  },

  downloadRepositorySong: async (repositorySong: RepositorySong) => {
    const { addSong } = get();
    try {
      const songData = await downloadSong(repositorySong.apiUrl);
      addSong(songData);
      return songData;
    } catch (err) {
      console.error("Failed to download song:", err);
      throw err;
    }
  },

  // ── Countdown ──────────────────────────────────────────────────────────
  countdownRemaining: 0,
  countdownLabel: "Gottesdienst beginnt in",
  countdownRunning: false,
  countdownLive: false,
  countdownTargetTime: null,
  countdownTheme: "minimal",
  countdownBackgroundMusicId: null,
  countdownBackgroundPlaylistId: null,
  countdownBackgroundMusicVolume: 1.0,
  countdownBackgroundMusicStartMinutes: 10,
  countdownBackgroundMusicStartVolumePercent: 30,
  countdownBackgroundMusicFadeInStartMinutes: 5,
  countdownBackgroundMusicFullVolumeMinutes: 2,
  countdownDisplayAfterZeroSeconds: 10,

  setCountdownLabel: (l) => set({ countdownLabel: l }),
  setCountdownTargetTime: (t) => set({ countdownTargetTime: t }),

  applyCountdownTargetTime: () => {
    const t = get().countdownTargetTime;
    if (!t) return;
    const diffSeconds = secondsUntilTargetTime(t);
    if (diffSeconds <= 0) return;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    set({ countdownRunning: false, countdownRemaining: diffSeconds });
    stopCountdownBackgroundMusic();
    updateCountdownBgVolume(diffSeconds);

    sendCurrentCountdownToOutput({
      remaining: diffSeconds,
      running: false,
      targetTime: t,
    });
    get().startCountdown();
  },

  setCountdownTheme: (theme) => {
    set({ countdownTheme: theme });
    sendCurrentCountdownToOutput({ theme });
  },

  setCountdownBackgroundMusic: (id) => {
    set({ countdownBackgroundMusicId: id });
  },
  setCountdownBackgroundPlaylist: (id) => set({ countdownBackgroundPlaylistId: id }),
  setCountdownBackgroundMusicVolume: (v) => set({ countdownBackgroundMusicVolume: normalizeVolume(v, 1.0) }),
  setCountdownBackgroundMusicStartMinutes: (m) => set({ countdownBackgroundMusicStartMinutes: normalizeMinutes(m, 10) }),
  setCountdownBackgroundMusicStartVolumePercent: (p) => set({ countdownBackgroundMusicStartVolumePercent: Math.max(0, Math.min(100, p)) }),
  setCountdownBackgroundMusicFadeInStartMinutes: (m) => set({ countdownBackgroundMusicFadeInStartMinutes: normalizeMinutes(m, 5) }),
  setCountdownBackgroundMusicFullVolumeMinutes: (m) => set({ countdownBackgroundMusicFullVolumeMinutes: normalizeMinutes(m, 2) }),
  setCountdownDisplayAfterZeroSeconds: (s) => set({ countdownDisplayAfterZeroSeconds: Math.max(0, Math.min(60, s)) }),

  startCountdown: () => {
    const {
      countdownTargetTime,
      countdownBackgroundPlaylistId,
      playlists,
    } = get();

    clearCountdownFadeOutTimeout();

    // Start background playlist if configured
    if (countdownBackgroundPlaylistId && countdownTargetTime) {
      const playlist = playlists.find((p) => p.id === countdownBackgroundPlaylistId);
      const tracks = playlist?.tracks ?? [];
      const playable = tracks.filter((t) => typeof t.src === "string" && t.src.trim());

      if (playlist && playable.length > 0) {
        const a = ensureBackgroundMusicAudio();
        if (a) {
          ensureCountdownBgHandlers();
          countdownBgPlaylistId = playlist.id;
          countdownBgQueue = playable;
          countdownBgIndex = 0;
          countdownBgStarted = false;
          countdownBgStarting = false;
          countdownBgStartOffsetSeconds = 0;

          a.volume = 0;
          maybeStartCountdownBackgroundMusic(secondsUntilTargetTime(countdownTargetTime));
        }
      }
    }

    if (get().countdownRunning) return;

    // Recalculate remaining time based on target
    const t = get().countdownTargetTime;
    if (t) {
      const diffSeconds = secondsUntilTargetTime(t);
      set({ countdownRemaining: diffSeconds });
      updateCountdownBgVolume(diffSeconds);
    }

    set({ countdownRunning: true });

    countdownEndTime = Date.now() + (get().countdownRemaining * 1000);
    sendCurrentCountdownToOutput({ running: true });

    countdownInterval = setInterval(() => {
      const { stopCountdown } = get();
      const next = Math.max(0, Math.ceil(((countdownEndTime ?? Date.now()) - Date.now()) / 1000));

      set({ countdownRemaining: next });
      maybeStartCountdownBackgroundMusic(next);
      updateCountdownBgVolume(next);

      sendCurrentCountdownToOutput({ remaining: next, running: true });

      if (next <= 0) {
        stopCountdown();
      }
    }, 1000);
  },

  stopCountdown: () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const { countdownRemaining, countdownLabel, countdownTheme, countdownTargetTime, countdownDisplayAfterZeroSeconds } = get();

    set({ countdownRunning: false });

    // Manual stop before 0 should also stop the countdown background music.
    if (countdownRemaining > 0) {
      stopCountdownBackgroundMusic();
    }

    // If countdown reached 0, keep display visible for configured seconds, then fade to black.
    // This only affects output when countdown is currently the active output mode.
    if (countdownRemaining <= 0 && isCountdownOutputActive()) {
      sendCurrentCountdownToOutput({
        remaining: 0,
        label: countdownLabel,
        running: false,
        theme: countdownTheme,
        targetTime: countdownTargetTime,
      });

      // After displayAfterZeroSeconds, fade out to black
      clearCountdownFadeOutTimeout();

      countdownFadeOutTimeout = setTimeout(() => {
        sendCurrentCountdownToOutput({
          remaining: 0,
          label: countdownLabel,
          running: false,
          theme: countdownTheme,
          targetTime: countdownTargetTime,
          isFadingOut: true,
        });

        countdownFadeOutTimeout = setTimeout(() => {
          sendToOutput({ mode: "blackout" });
          set({ outputMode: "blackout", isBlackout: false });
          countdownFadeOutTimeout = null;
        }, 1200);
      }, countdownDisplayAfterZeroSeconds * 1000);

      return;
    }

    // Countdown was stopped manually (not at 0)
    sendCurrentCountdownToOutput({
      remaining: countdownRemaining,
      label: countdownLabel,
      running: false,
      theme: countdownTheme,
      targetTime: countdownTargetTime,
    });
  },

  resetCountdown: () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Stop background music
    stopCountdownBackgroundMusic();

    clearCountdownFadeOutTimeout();

    const t = get().countdownTargetTime;
    let diffSeconds = 0;
    if (t) {
      diffSeconds = secondsUntilTargetTime(t);
    }
    set({ countdownRunning: false, countdownRemaining: diffSeconds });
    sendCurrentCountdownToOutput({ remaining: diffSeconds, running: false, targetTime: t });
  },

  setCountdownLive: (live) => {
    if (!live) {
      clearCountdownFadeOutTimeout();
      set({ countdownLive: false });
      updateCountdownBgVolume(get().countdownRemaining);
      return;
    }
    set({ countdownLive: true, outputMode: "countdown", isBlackout: false });
    sendCurrentCountdownToOutput({}, true);
    updateCountdownBgVolume(get().countdownRemaining);
  },

  // ── Video ──────────────────────────────────────────────────────────────
  videos: [],
  activeVideoId: null,
  videoStartTime: null,
  videoEndTime: null,

  setVideoStartTime: (s) => set({ videoStartTime: s }),
  setVideoEndTime: (s) => set({ videoEndTime: s }),

  loadVideos: async () => {
    const { setLoading, setError, clearError } = get();
    try {
      setLoading(true);
      clearError();
      const files = await openDialog({
        multiple: true,
        filters: [{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] }],
      });
      if (!files) return;
      const arr = Array.isArray(files) ? files : [files];
      const items: MediaItem[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        name: (f as string).split(/[\\/]/).pop() ?? f as string,
        path: f as string,
        src: convertFileSrc(f as string),
        type: "video",
      }));
      set((s) => ({ videos: [...s.videos, ...items] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Videos");
    } finally {
      setLoading(false);
    }
  },

  goLiveVideo: (id) => {
    const video = get().videos.find((v) => v.id === id);
    const startTime = get().videoStartTime ?? undefined;
    const endTime = get().videoEndTime ?? undefined;
    if (!video) return;
    set({ activeVideoId: id, outputMode: "video", isBlackout: false });
    sendToOutput({ mode: "video", video: { src: video.src, playing: true, startTime, endTime } });
  },

  removeVideo: (id) =>
    set((s) => ({ videos: s.videos.filter((x) => x.id !== id) })),

  // ── Music ──────────────────────────────────────────────────────────────
  music: [],
  musicIndex: 0,
  musicPlaying: false,
  musicVolume: 1,
  musicCurrentTime: 0,
  musicDuration: 0,
  musicFadeDuration: 2, // 2 seconds default fade

  setMusicFadeDuration: (s) => set({ musicFadeDuration: s }),

  loadMusic: async (playlistId?: string | null) => {
    const { setLoading, setError, clearError, playlists, addTrackToPlaylist } = get();
    try {
      setLoading(true);
      clearError();
      const files = await openDialog({
        multiple: true,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a"] }],
      });
      if (!files) return;
      const arr = Array.isArray(files) ? files : [files];

      // Load files and get duration
      const items: MusicItem[] = await Promise.all(arr.map(async (f) => {
        const path = f as string;
        const name = path.split(/[\\/]/).pop() ?? f as string;
        const src = convertFileSrc(path);

        // Get duration by loading audio metadata
        let duration: number | undefined;
        try {
          duration = await getAudioDuration(src);
        } catch (err) {
          console.warn(`Could not get duration for ${name}:`, err);
        }

        return {
          id: crypto.randomUUID(),
          name,
          path,
          src,
          source: "local" as MusicSource,
          duration,
        };
      }));

      set((s) => ({ music: [...s.music, ...items] }));

      // Add to playlist if specified
      if (playlistId) {
        const playlist = playlists.find((p) => p.id === playlistId);
        if (playlist) {
          items.forEach((item) => addTrackToPlaylist(playlistId, item));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Musik");
    } finally {
      setLoading(false);
    }
  },

  loadMusicFromFolder: async (playlistId?: string | null) => {
    const { setLoading, setError, clearError, playlists, addTrackToPlaylist } = get();
    try {
      setLoading(true);
      clearError();
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({
        multiple: false,
        directory: true,
        title: "Musik-Ordner auswählen",
      });
      if (!folder) return;

      const { readDir } = await import("@tauri-apps/plugin-fs");
      const audioExts = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);

      const entries = await readDir(folder as string);
      const audioFiles = entries.filter((entry) => {
        if (!entry.isFile) return false;
        const ext = entry.name.split(".").pop()?.toLowerCase() || "";
        return audioExts.has(ext);
      });

      // Load files and get duration
      const items: MusicItem[] = await Promise.all(audioFiles.map(async (entry) => {
        const fullPath = `${folder}/${entry.name}`;
        const src = convertFileSrc(fullPath);

        // Get duration by loading audio metadata
        let duration: number | undefined;
        try {
          duration = await getAudioDuration(src);
        } catch (err) {
          console.warn(`Could not get duration for ${entry.name}:`, err);
        }

        return {
          id: crypto.randomUUID(),
          name: entry.name,
          path: fullPath,
          src,
          source: "local" as MusicSource,
          duration,
        };
      }));

      // Sort alphabetically by name
      items.sort((a, b) => a.name.localeCompare(b.name));
      set((s) => ({ music: [...s.music, ...items] }));

      // Add to playlist if specified
      if (playlistId) {
        const playlist = playlists.find((p) => p.id === playlistId);
        if (playlist) {
          items.forEach((item) => addTrackToPlaylist(playlistId, item));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden des Ordners");
    } finally {
      setLoading(false);
    }
  },

  resetAllMusic: () => {
    const a = ensureMusicAudio();
    if (a) {
      try {
        a.pause();
        a.src = "";
      } catch {
        // ignore
      }
    }
    set({
      music: [],
      musicIndex: 0,
      musicPlaying: false,
      musicCurrentTime: 0,
      musicDuration: 0,
      playlists: [],
      activePlaylistId: null,
    });
    try {
      localStorage.removeItem(PLAYLISTS_KEY);
    } catch {
      // ignore
    }
  },

  setMusicIndex: (i) => set({ musicIndex: i }),
  setMusicPlaying: (p) => {
    const fadeDuration = get().musicFadeDuration;
    const a = ensureMusicAudio();
    if (!a) return;

    if (p) {
      const current = get().music[get().musicIndex];
      if (!current?.src) {
        set({ error: "Dieser Track kann nicht abgespielt werden (keine Audio-Quelle).", musicPlaying: false });
        return;
      }
      // Fade in
      a.volume = 0;
      a.play().catch(() => {});
      set({ musicPlaying: true });

      // Fade in over fadeDuration seconds
      const fadeSteps = 20;
      const stepTime = (fadeDuration * 1000) / fadeSteps;
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        const newVolume = Math.min(1, step / fadeSteps);
        if (a && !a.paused) {
          a.volume = newVolume;
        }
        if (step >= fadeSteps) {
          clearInterval(fadeInterval);
        }
      }, stepTime);
    } else {
      // Fade out
      set({ musicPlaying: false });
      const startVolume = a.volume;
      const fadeSteps = 20;
      const stepTime = (fadeDuration * 1000) / fadeSteps;
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        const newVolume = Math.max(0, startVolume * (1 - step / fadeSteps));
        if (a) {
          a.volume = newVolume;
        }
        if (step >= fadeSteps) {
          clearInterval(fadeInterval);
          if (a) a.pause();
          // Reset volume for next track
          setTimeout(() => {
            if (a) a.volume = get().musicVolume;
          }, 100);
        }
      }, stepTime);
    }
  },

  toggleMusicPlaying: () => get().setMusicPlaying(!get().musicPlaying),

  playNextMusic: () => {
    const { music, musicIndex, setMusicIndex, setMusicPlaying, showQueue, advanceShowOnMusicEnd } = get();
    if (music.length === 0) return;
    
    // Check if we're in a playlist context (for show mode)
    // If current music is part of a playlist item in show, handle playlist advancement
    const { playlists } = get();
    const currentShowItem = showQueue.length > 0 ? showQueue[get().showCurrentIndex] : null;
    
    // If we're in show mode with a playlist item, check if we should advance show
    if (currentShowItem && currentShowItem.type === "playlist" && currentShowItem.playlistId) {
      const playlist = playlists.find((p) => p.id === currentShowItem.playlistId);
      if (playlist) {
        const currentTrackIndex = playlist.tracks.findIndex((t) => t.id === music[musicIndex]?.id);
        const nextTrackIndex = currentTrackIndex + 1;
        
        // If there's a next track in the playlist, play it
        if (nextTrackIndex < playlist.tracks.length) {
          const nextTrack = playlist.tracks[nextTrackIndex];
          const nextTrackGlobalIndex = music.findIndex((m) => m.id === nextTrack.id);
          if (nextTrackGlobalIndex >= 0) {
            setMusicIndex(nextTrackGlobalIndex);
            set({ musicCurrentTime: 0 });
            setMusicPlaying(true);
            return;
          }
        }
        
        // Last track in playlist - advance show
        advanceShowOnMusicEnd();
        return;
      }
    }
    
    // Default behavior: cycle through all music
    let next = musicIndex;
    for (let i = 0; i < music.length; i++) {
      next = (next + 1) % music.length;
      if (music[next]?.src) break;
    }
    setMusicIndex(next);
    set({ musicCurrentTime: 0 });
    setMusicPlaying(true);
  },

  playPrevMusic: () => {
    const { music, musicIndex, setMusicIndex, setMusicPlaying } = get();
    if (music.length === 0) return;
    let prev = musicIndex;
    for (let i = 0; i < music.length; i++) {
      prev = (prev - 1 + music.length) % music.length;
      if (music[prev]?.src) break;
    }
    setMusicIndex(prev);
    set({ musicCurrentTime: 0 });
    setMusicPlaying(true);
  },

  seekMusic: (time) => {
    const a = ensureMusicAudio();
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    set({ musicCurrentTime: t });
    if (a) {
      try {
        a.currentTime = t;
      } catch {
        // ignore
      }
    }
  },

  setMusicVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    set({ musicVolume: vol });
    const a = ensureMusicAudio();
    if (a) a.volume = vol;
  },

  reorderMusic: (fromIndex: number, toIndex: number) => {
    set((s) => {
      const newMusic = [...s.music];
      const [removed] = newMusic.splice(fromIndex, 1);
      newMusic.splice(toIndex, 0, removed);
      let newIndex = s.musicIndex;
      if (fromIndex === s.musicIndex) {
        newIndex = toIndex;
      } else if (fromIndex < s.musicIndex && toIndex >= s.musicIndex) {
        newIndex--;
      } else if (fromIndex > s.musicIndex && toIndex <= s.musicIndex) {
        newIndex++;
      }
      return { music: newMusic, musicIndex: newIndex };
    });
  },

  removeMusic: (id) =>
    set((s) => {
      const nextMusic = s.music.filter((x) => x.id !== id);
      if (nextMusic.length === 0) {
        const a = ensureMusicAudio();
        if (a) a.pause();
        return {
          music: [],
          musicIndex: 0,
          musicPlaying: false,
          musicCurrentTime: 0,
          musicDuration: 0,
        };
      }

      const nextIndex = Math.min(s.musicIndex, nextMusic.length - 1);
      return { music: nextMusic, musicIndex: nextIndex };
    }),

  // ── Playlists ──────────────────────────────────────────────────────────
  playlists: [],
  activePlaylistId: null,

  createPlaylist: (name, description) => {
    const newPlaylist: Playlist = {
      id: crypto.randomUUID(),
      name,
      description,
      tracks: [],
      source: "local",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({ playlists: [...s.playlists, newPlaylist] }));
    savePlaylists();
    return newPlaylist;
  },

  deletePlaylist: (id) => {
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
    if (get().activePlaylistId === id) {
      set({ activePlaylistId: null, music: [], musicIndex: 0, musicPlaying: false });
    }
    savePlaylists();
  },

  updatePlaylist: (id, updates) => {
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
    }));
    savePlaylists();
  },

  addTrackToPlaylist: (playlistId, track) => {
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId
          ? { ...p, tracks: [...p.tracks, track], updatedAt: Date.now() }
          : p
      ),
    }));
    savePlaylists();
  },

  removeTrackFromPlaylist: (playlistId, trackId) => {
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId
          ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId), updatedAt: Date.now() }
          : p
      ),
    }));
    savePlaylists();
  },

  setActivePlaylist: (id) => {
    set({ activePlaylistId: id });
    if (id) {
      const playlist = get().playlists.find((p) => p.id === id);
      if (playlist) {
        set({ music: playlist.tracks, musicIndex: 0, musicPlaying: false });
      }
    }
  },

  loadPlaylist: (playlistId) => {
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (playlist) {
      set({ music: playlist.tracks, musicIndex: 0, musicPlaying: false, activePlaylistId: playlistId });
    }
  },

  // ── Display ──────────────────────────────────────────────────────────────
  monitors: [],
  outputMonitorIndices: [],
  outputWindowsOpen: {},

  fetchMonitors: async () => {
    try {
      const monitors = await invoke<Monitor[]>("get_monitors");
      set({ monitors });

      // Restore output windows for previously configured monitors
      const configuredIndices = get().outputMonitorIndices;
      if (configuredIndices.length > 0) {
        for (const idx of configuredIndices) {
          if (idx >= 0 && idx < monitors.length) {
            const m = monitors[idx];
            try {
              await openOutputWindowForMonitor(idx);
              await assignOutputWindowToMonitor(idx, m.x, m.y, m.width, m.height);
              set((s) => ({ outputWindowsOpen: { ...s.outputWindowsOpen, [idx]: true } }));
            } catch (err) {
              console.warn(`Failed to open output window for monitor ${idx}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch monitors:", err);
      set({ monitors: [] });
    }
  },

  toggleOutputMonitor: async (i) => {
    const currentIndices = get().outputMonitorIndices;
    const isCurrentlyOpen = currentIndices.includes(i);

    if (isCurrentlyOpen) {
      // Close this output window
      await closeOutputWindowForMonitor(i);
      set((s) => ({
        outputMonitorIndices: s.outputMonitorIndices.filter((idx) => idx !== i),
        outputWindowsOpen: { ...s.outputWindowsOpen, [i]: false },
      }));
    } else {
      // Open output window on this monitor
      try {
        const m = get().monitors[i];
        if (m) {
          await openOutputWindowForMonitor(i);
          await assignOutputWindowToMonitor(i, m.x, m.y, m.width, m.height);
          set((s) => ({
            outputMonitorIndices: [...s.outputMonitorIndices, i],
            outputWindowsOpen: { ...s.outputWindowsOpen, [i]: true },
            error: null,
          }));
        }
      } catch (err) {
        console.error("Failed to open output window:", err);
        const msg = formatUnknownError(err);
        set({ error: `Ausgabefenster konnte nicht geöffnet werden: ${msg}` });
      }
    }
  },

  closeAllOutputWindows: async () => {
    await closeAllOutputFn();
    set({ outputMonitorIndices: [], outputWindowsOpen: {} });
  },

  // ── Show Mode ──────────────────────────────────────────────────────────
  showQueue: [],
  showCurrentIndex: -1,

  addToShowQueue: (item) => {
    set((s) => ({ showQueue: [...s.showQueue, item] }));
  },

  removeFromShowQueue: (id) => {
    set((s) => ({ showQueue: s.showQueue.filter((item) => item.id !== id) }));
  },

  setShowCurrentIndex: (index) => {
    set({ showCurrentIndex: index });
  },

  updateShowItemSlideIndex: (itemId, slideIndex) => {
    set((s) => ({
      showQueue: s.showQueue.map((item) =>
        item.id === itemId ? { ...item, slideIndex } : item
      ),
    }));
  },

  showNext: () => {
    const { showQueue, showCurrentIndex, music, playlists } = get();
    if (showQueue.length === 0) return;
    const nextIndex = Math.min(showQueue.length - 1, showCurrentIndex + 1);
    
    // Handle music playback for music/playlist items
    const nextItem = showQueue[nextIndex];
    if (nextItem && (nextItem.type === "music" || nextItem.type === "playlist")) {
      let trackToPlay: MusicItem | undefined;
      
      if (nextItem.type === "music" && nextItem.musicTrackId) {
        trackToPlay = music.find((m) => m.id === nextItem.musicTrackId);
      } else if (nextItem.type === "playlist" && nextItem.playlistId) {
        const playlist = playlists.find((p) => p.id === nextItem.playlistId);
        if (playlist && playlist.tracks.length > 0) {
          trackToPlay = playlist.tracks[0];
        }
      }
      
      if (trackToPlay) {
        const trackIndex = music.findIndex((m) => m.id === trackToPlay!.id);
        if (trackIndex >= 0) {
          set({ musicIndex: trackIndex, musicPlaying: true });
        }
      }
    }
    
    set({ showCurrentIndex: nextIndex });
  },

  showPrevious: () => {
    const { showQueue, showCurrentIndex, music, playlists } = get();
    if (showQueue.length === 0) return;
    const prevIndex = Math.max(0, showCurrentIndex - 1);
    
    // Handle music playback for music/playlist items
    const prevItem = showQueue[prevIndex];
    if (prevItem && (prevItem.type === "music" || prevItem.type === "playlist")) {
      let trackToPlay: MusicItem | undefined;
      
      if (prevItem.type === "music" && prevItem.musicTrackId) {
        trackToPlay = music.find((m) => m.id === prevItem.musicTrackId);
      } else if (prevItem.type === "playlist" && prevItem.playlistId) {
        const playlist = playlists.find((p) => p.id === prevItem.playlistId);
        if (playlist && playlist.tracks.length > 0) {
          trackToPlay = playlist.tracks[0];
        }
      }
      
      if (trackToPlay) {
        const trackIndex = music.findIndex((m) => m.id === trackToPlay!.id);
        if (trackIndex >= 0) {
          set({ musicIndex: trackIndex, musicPlaying: true });
        }
      }
    }
    
    set({ showCurrentIndex: prevIndex });
  },

  // Advance show to next item (called when music track ends)
  advanceShowOnMusicEnd: () => {
    const { showQueue, showCurrentIndex, music, musicIndex, playlists, showNext } = get();
    if (showQueue.length === 0) return;
    
    const currentItem = showQueue[showCurrentIndex];
    if (!currentItem) return;
    
    // Check if current item is music/playlist
    if (currentItem.type === "music" || currentItem.type === "playlist") {
      // Check if we should advance to next item
      let currentTrackId: string | undefined;
      
      if (currentItem.type === "music" && currentItem.musicTrackId) {
        currentTrackId = currentItem.musicTrackId;
      } else if (currentItem.type === "playlist" && currentItem.playlistId) {
        const playlist = playlists.find((p) => p.id === currentItem.playlistId);
        const currentMusicTrack = music[musicIndex];
        // Find current track in playlist
        const playlistTrackIndex = playlist?.tracks.findIndex((t) => t.id === currentMusicTrack?.id);
        // If this is the last track in the playlist, advance show
        if (playlistTrackIndex !== undefined && playlistTrackIndex >= 0 && 
            playlistTrackIndex === (playlist?.tracks.length ?? 0) - 1) {
          showNext();
        }
        return;
      }

      if (currentItem.type === "music" && currentTrackId) {
        const nextIndex = Math.min(showQueue.length - 1, showCurrentIndex + 1);
        if (nextIndex > showCurrentIndex) {
          showNext();
        }
      }
    }
  },

  showNextSlide: () => {
    const state = get();
    const { showQueue, showCurrentIndex, songs, pdfGroups } = state;
    if (showQueue.length === 0 || showCurrentIndex < 0) return;

    const currentItem = showQueue[showCurrentIndex];

    // For songs: increment slide index
    if (currentItem.type === "song" && currentItem.refId) {
      const song = songs.find((s) => s.id === currentItem.refId);
      if (song) {
        const currentSlideIndex = currentItem.slideIndex ?? 0;
        const nextSlideIndex = Math.min(song.slides.length - 1, currentSlideIndex + 1);
        state.updateShowItemSlideIndex(currentItem.id, nextSlideIndex);
        return;
      }
    }

    // For pdf: increment page index
    if (currentItem.type === "pdf" && currentItem.refId) {
      const group = pdfGroups.find((g) => g.id === currentItem.refId);
      if (group) {
        const currentPageIndex = currentItem.slideIndex ?? 0;
        const nextPageIndex = Math.min(group.pages.length - 1, currentPageIndex + 1);
        state.updateShowItemSlideIndex(currentItem.id, nextPageIndex);
        return;
      }
    }

    // Otherwise: go to next item
    state.showNext();
  },

  showPreviousSlide: () => {
    const state = get();
    const { showQueue, showCurrentIndex, songs, pdfGroups } = state;
    if (showQueue.length === 0 || showCurrentIndex < 0) return;

    const currentItem = showQueue[showCurrentIndex];

    // For songs: decrement slide index
    if (currentItem.type === "song" && currentItem.refId) {
      const song = songs.find((s) => s.id === currentItem.refId);
      if (song) {
        const currentSlideIndex = currentItem.slideIndex ?? 0;
        const prevSlideIndex = Math.max(0, currentSlideIndex - 1);
        state.updateShowItemSlideIndex(currentItem.id, prevSlideIndex);
        return;
      }
    }

    // For pdf: decrement page index
    if (currentItem.type === "pdf" && currentItem.refId) {
      const group = pdfGroups.find((g) => g.id === currentItem.refId);
      if (group) {
        const currentPageIndex = currentItem.slideIndex ?? 0;
        const prevPageIndex = Math.max(0, currentPageIndex - 1);
        state.updateShowItemSlideIndex(currentItem.id, prevPageIndex);
        return;
      }
    }

    // Otherwise: go to previous item
    state.showPrevious();
  },

  clearShowQueue: () => {
    set({ showQueue: [], showCurrentIndex: -1 });
  },

  resetMedia: () => resetMedia(),
  resetShow: () => resetShow(),

  reorderShowQueue: (fromIndex, toIndex) => {
    set((s) => {
      const newQueue = [...s.showQueue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { showQueue: newQueue };
    });
  },

  // ── Persist settings ────────────────────────────────────────────────────
  loadSettings: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        set({
          countdownLabel: parsed.countdownLabel ?? "Gottesdienst beginnt in",
          countdownTargetTime: parsed.countdownTargetTime ?? null,
          countdownTheme: parsed.countdownTheme ?? "minimal",
          countdownBackgroundPlaylistId: parsed.countdownBackgroundPlaylistId ?? null,
          countdownBackgroundMusicVolume: normalizeVolume(parsed.countdownBackgroundMusicVolume, 1.0),
          countdownBackgroundMusicStartMinutes: normalizeMinutes(parsed.countdownBackgroundMusicStartMinutes, 10),
          countdownBackgroundMusicStartVolumePercent: parsed.countdownBackgroundMusicStartVolumePercent ?? 30,
          countdownBackgroundMusicFadeInStartMinutes: normalizeMinutes(parsed.countdownBackgroundMusicFadeInStartMinutes, 5),
          countdownBackgroundMusicFullVolumeMinutes: normalizeMinutes(parsed.countdownBackgroundMusicFullVolumeMinutes, 2),
          countdownDisplayAfterZeroSeconds: parsed.countdownDisplayAfterZeroSeconds ?? 10,
          outputMonitorIndices: parsed.outputMonitorIndices ?? [],
        });
      }
    } catch {
      console.warn("Could not load settings");
    }
    loadPlaylists();
    loadMedia();
    loadShow();
  },

  saveSettings: () => {
    try {
      const {
        countdownLabel,
        countdownTargetTime,
        countdownTheme,
        countdownBackgroundPlaylistId,
        countdownBackgroundMusicVolume,
        countdownBackgroundMusicStartMinutes,
        countdownBackgroundMusicStartVolumePercent,
        countdownBackgroundMusicFadeInStartMinutes,
        countdownBackgroundMusicFullVolumeMinutes,
        countdownDisplayAfterZeroSeconds,
        outputMonitorIndices,
      } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          countdownLabel,
          countdownTargetTime,
          countdownTheme,
          countdownBackgroundPlaylistId,
          countdownBackgroundMusicVolume,
          countdownBackgroundMusicStartMinutes,
          countdownBackgroundMusicStartVolumePercent,
          countdownBackgroundMusicFadeInStartMinutes,
          countdownBackgroundMusicFullVolumeMinutes,
          countdownDisplayAfterZeroSeconds,
          outputMonitorIndices,
        })
      );
    } catch {
      console.warn("Could not save settings");
    }
  },
}));

// ── Playlist Persistence ────────────────────────────────────────

function savePlaylists() {
  try {
    const { playlists } = useStore.getState();
    const toPersist = playlists;
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(toPersist));
  } catch {
    console.warn("Could not save playlists");
  }
}

function loadPlaylists() {
  try {
    const saved = localStorage.getItem(PLAYLISTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const loadedPlaylists: Playlist[] = parsed.map((p: Playlist) => ({
        ...p,
        createdAt: p.createdAt || Date.now(),
        updatedAt: p.updatedAt || Date.now(),
      }));
      useStore.setState({ playlists: loadedPlaylists });
    }
  } catch {
    console.warn("Could not load playlists");
  }
}

// ── Media & Show Persistence ────────────────────────────────────

function saveMedia() {
  try {
    const { slides, videos } = useStore.getState();
    // Only persist metadata (paths), not binary data
    const toPersist = {
      slides: slides.map(s => ({ id: s.id, name: s.name, path: s.path, src: s.src, type: s.type })),
      videos: videos.map(v => ({ id: v.id, name: v.name, path: v.path, src: v.src, type: v.type, duration: v.duration })),
    };
    localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(toPersist));
  } catch {
    console.warn("Could not save media");
  }
}

function loadMedia() {
  try {
    const saved = localStorage.getItem(MEDIA_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      useStore.setState({
        slides: parsed.slides || [],
        videos: parsed.videos || [],
      });
    }
  } catch {
    console.warn("Could not load media");
  }
}

function saveShow() {
  try {
    const { showQueue, showCurrentIndex } = useStore.getState();
    localStorage.setItem(SHOW_STORAGE_KEY, JSON.stringify({ showQueue, showCurrentIndex }));
  } catch {
    console.warn("Could not save show");
  }
}

function loadShow() {
  try {
    const saved = localStorage.getItem(SHOW_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      useStore.setState({
        showQueue: parsed.showQueue || [],
        showCurrentIndex: parsed.showCurrentIndex ?? -1,
      });
    }
  } catch {
    console.warn("Could not load show");
  }
}

function resetMedia() {
  try {
    localStorage.removeItem(MEDIA_STORAGE_KEY);
    const { outputMode } = useStore.getState();
    useStore.setState((s) => ({
      slides: [],
      videos: [],
      activeSlideId: null,
      activeVideoId: null,
      showQueue: s.showQueue.filter((item) => item.type !== "image" && item.type !== "video"),
      showCurrentIndex:
        s.showCurrentIndex >= 0 && s.showQueue[s.showCurrentIndex] &&
        (s.showQueue[s.showCurrentIndex].type === "image" || s.showQueue[s.showCurrentIndex].type === "video")
          ? -1
          : s.showCurrentIndex,
      outputMode: outputMode === "image" || outputMode === "video" ? "blank" : s.outputMode,
    }));
    if (outputMode === "image" || outputMode === "video") {
      void sendToOutput({ mode: "blank" });
    }
  } catch {
    console.warn("Could not reset media");
  }
}

function resetShow() {
  try {
    localStorage.removeItem(SHOW_STORAGE_KEY);
    useStore.setState({ showQueue: [], showCurrentIndex: -1 });
  } catch {
    console.warn("Could not reset show");
  }
}

function initMusicEngine() {
  const a = ensureMusicAudio();
  if (!a) return;

  const syncFromState = () => {
    const s = useStore.getState();
    const current = s.music[s.musicIndex];

    const nextSrc = current?.src ?? "";
    if (nextSrc && musicAudioSrc !== nextSrc) {
      a.src = nextSrc;
      musicAudioSrc = nextSrc;
      try {
        a.currentTime = 0;
      } catch {
        // ignore
      }
      useStore.setState({ musicCurrentTime: 0, musicDuration: 0 });
      if (s.musicPlaying && a.paused) a.play().catch(() => {});
    }

    if (Number.isFinite(s.musicVolume) && a.volume !== s.musicVolume) {
      a.volume = s.musicVolume;
    }

    if (s.musicPlaying) {
      if (a.paused) a.play().catch(() => {});
    } else if (!a.paused) {
      a.pause();
    }
  };

  a.addEventListener("timeupdate", () => {
    useStore.setState({ musicCurrentTime: a.currentTime });
  });

  a.addEventListener("loadedmetadata", () => {
    useStore.setState({ musicDuration: Number.isFinite(a.duration) ? a.duration : 0 });
  });

  a.addEventListener("play", () => {
    useStore.setState({ musicPlaying: true });
  });

  a.addEventListener("pause", () => {
    useStore.setState({ musicPlaying: false });
  });

  a.addEventListener("ended", () => {
    useStore.getState().playNextMusic();
  });

  syncFromState();
  useStore.subscribe(syncFromState);
}

// Auto-save settings on changes
useStore.subscribe((state, prevState) => {
  if (!prevState) return;

  const changed =
    state.countdownLabel !== prevState.countdownLabel ||
    state.countdownTargetTime !== prevState.countdownTargetTime ||
    state.countdownTheme !== prevState.countdownTheme ||
    state.outputMonitorIndices !== prevState.outputMonitorIndices ||
    state.countdownBackgroundPlaylistId !== prevState.countdownBackgroundPlaylistId ||
    state.countdownBackgroundMusicVolume !== prevState.countdownBackgroundMusicVolume ||
    state.countdownBackgroundMusicStartMinutes !== prevState.countdownBackgroundMusicStartMinutes ||
    state.countdownBackgroundMusicStartVolumePercent !== prevState.countdownBackgroundMusicStartVolumePercent ||
    state.countdownBackgroundMusicFadeInStartMinutes !== prevState.countdownBackgroundMusicFadeInStartMinutes ||
    state.countdownBackgroundMusicFullVolumeMinutes !== prevState.countdownBackgroundMusicFullVolumeMinutes ||
    state.countdownDisplayAfterZeroSeconds !== prevState.countdownDisplayAfterZeroSeconds;

  if (changed) state.saveSettings();

  // Auto-save playlists on change
  if (state.playlists !== prevState.playlists) {
    savePlaylists();
  }

  // Auto-save media on change
  if (state.slides !== prevState.slides || state.videos !== prevState.videos) {
    saveMedia();
  }

  // Auto-save show on change
  if (state.showQueue !== prevState.showQueue || state.showCurrentIndex !== prevState.showCurrentIndex) {
    saveShow();
  }
});

// Keep countdown output/audio in sync with global output selection.
useStore.subscribe((state, prevState) => {
  if (!prevState) return;

  const outputSelectionChanged =
    state.outputMode !== prevState.outputMode || state.isBlackout !== prevState.isBlackout;

  if (!outputSelectionChanged) return;

  updateCountdownBgVolume(state.countdownRemaining);

  const becameActive = state.outputMode === "countdown" && !state.isBlackout;
  const wasActive = prevState.outputMode === "countdown" && !prevState.isBlackout;
  if (wasActive && !becameActive) {
    clearCountdownFadeOutTimeout();
  }
  if (becameActive && !wasActive) {
    sendCurrentCountdownToOutput({}, true);
  }
});

// Load settings on init
(() => {
  if (typeof window !== "undefined") {
    initOutputReplayListener();
    useStore.getState().loadSettings();
    initMusicEngine();
  }
})();
