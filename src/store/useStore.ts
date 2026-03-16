import { create } from "zustand";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { sendToOutput, openOutputWindow } from "../lib/events";
import type {
  Song, SongSlide, MediaItem, MusicItem,
  Monitor, TabId, OutputMode,
} from "../types";

const STORAGE_KEY = "openstage-settings-v1";

let countdownInterval: ReturnType<typeof setInterval> | null = null;

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
  loadSlides: () => Promise<void>;
  goLiveSlide: (id: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  removeSlide: (id: string) => void;

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

  // ── Countdown ──────────────────────────────────────────────────────────
  countdownDuration: number; // seconds
  countdownRemaining: number;
  countdownLabel: string;
  countdownRunning: boolean;
  countdownLive: boolean;
  setCountdownDuration: (s: number) => void;
  setCountdownLabel: (l: string) => void;
  startCountdown: () => void;
  stopCountdown: () => void;
  resetCountdown: () => void;
  setCountdownLive: (live: boolean) => void;

  // ── Video ──────────────────────────────────────────────────────────────
  videos: MediaItem[];
  activeVideoId: string | null;
  loadVideos: () => Promise<void>;
  goLiveVideo: (id: string) => void;
  removeVideo: (id: string) => void;

  // ── Music ──────────────────────────────────────────────────────────────
  music: MusicItem[];
  musicIndex: number;
  musicPlaying: boolean;
  loadMusic: () => Promise<void>;
  setMusicIndex: (i: number) => void;
  setMusicPlaying: (p: boolean) => void;
  reorderMusic: (fromIndex: number, toIndex: number) => void;
  removeMusic: (id: string) => void;

  // ── Display ────────────────────────────────────────────────────────────
  monitors: Monitor[];
  selectedMonitor: number;
  fetchMonitors: () => Promise<void>;
  setSelectedMonitor: (i: number) => void;
  openOutput: () => Promise<void>;

  // ── Persist settings ────────────────────────────────────────────────────
  loadSettings: () => void;
  saveSettings: () => void;
}

export const useStore = create<Store>((set, get) => ({
  // ── UI ──────────────────────────────────────────────────────────────────
  activeTab: "slides",
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

  // ── Countdown ──────────────────────────────────────────────────────────
  countdownDuration: 300,
  countdownRemaining: 300,
  countdownLabel: "Gottesdienst beginnt in",
  countdownRunning: false,
  countdownLive: false,

  setCountdownDuration: (s) => set({ countdownDuration: s, countdownRemaining: s }),
  setCountdownLabel: (l) => set({ countdownLabel: l }),

  startCountdown: () => {
    if (get().countdownRunning) return;
    set({ countdownRunning: true });
    countdownInterval = setInterval(() => {
      const { countdownRemaining, countdownLabel, countdownLive, stopCountdown } = get();
      const next = countdownRemaining - 1;
      set({ countdownRemaining: Math.max(next, 0) });
      if (countdownLive) {
        sendToOutput({
          mode: "countdown",
          countdown: { remaining: Math.max(next, 0), label: countdownLabel, running: true },
        });
      }
      if (next <= 0) stopCountdown();
    }, 1000);
  },

  stopCountdown: () => {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    set({ countdownRunning: false });
    const { countdownRemaining, countdownLabel } = get();
    if (get().countdownLive) {
      sendToOutput({
        mode: "countdown",
        countdown: { remaining: countdownRemaining, label: countdownLabel, running: false },
      });
    }
  },

  resetCountdown: () => {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    const d = get().countdownDuration;
    set({ countdownRunning: false, countdownRemaining: d });
    if (get().countdownLive) {
      sendToOutput({
        mode: "countdown",
        countdown: { remaining: d, label: get().countdownLabel, running: false },
      });
    }
  },

  setCountdownLive: (live) => {
    set({ countdownLive: live, outputMode: live ? "countdown" : get().outputMode, isBlackout: false });
    if (live) {
      sendToOutput({
        mode: "countdown",
        countdown: {
          remaining: get().countdownRemaining,
          label: get().countdownLabel,
          running: get().countdownRunning,
        },
      });
    } else {
      sendToOutput({ mode: "blank" });
    }
  },

  // ── Video ──────────────────────────────────────────────────────────────
  videos: [],
  activeVideoId: null,

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
        name: (f as string).split(/[\\/]/).pop() ?? (f as string),
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
    if (!video) return;
    set({ activeVideoId: id, outputMode: "video", isBlackout: false });
    sendToOutput({ mode: "video", video: { src: video.src, playing: true } });
  },

  removeVideo: (id) =>
    set((s) => ({ videos: s.videos.filter((x) => x.id !== id) })),

  // ── Music ──────────────────────────────────────────────────────────────
  music: [],
  musicIndex: 0,
  musicPlaying: false,

  loadMusic: async () => {
    const { setLoading, setError, clearError } = get();
    try {
      setLoading(true);
      clearError();
      const files = await openDialog({
        multiple: true,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a"] }],
      });
      if (!files) return;
      const arr = Array.isArray(files) ? files : [files];
      const items: MusicItem[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        name: (f as string).split(/[\\/]/).pop() ?? (f as string),
        path: f as string,
        src: convertFileSrc(f as string),
      }));
      set((s) => ({ music: [...s.music, ...items] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Musik");
    } finally {
      setLoading(false);
    }
  },

  setMusicIndex: (i) => set({ musicIndex: i }),
  setMusicPlaying: (p) => set({ musicPlaying: p }),

  reorderMusic: (fromIndex: number, toIndex: number) => {
    set((s) => {
      const newMusic = [...s.music];
      const [removed] = newMusic.splice(fromIndex, 1);
      newMusic.splice(toIndex, 0, removed);
      // Adjust musicIndex if needed
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
    set((s) => ({
      music: s.music.filter((x) => x.id !== id),
      musicIndex: 0,
      musicPlaying: false,
    })),

  // ── Display ──────────────────────────────────────────────────────────────
  monitors: [],
  selectedMonitor: 0,

  fetchMonitors: async () => {
    try {
      const monitors = await invoke<Monitor[]>("get_monitors");
      set({ monitors });
    } catch (err) {
      console.warn("Could not fetch monitors:", err);
      set({ monitors: [] });
    }
  },

  setSelectedMonitor: (i) => set({ selectedMonitor: i }),

  openOutput: async () => {
    await openOutputWindow();
    set({ outputWindowReady: true });
  },

  // ── Persist settings ────────────────────────────────────────────────────
  loadSettings: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        set({
          countdownDuration: parsed.countdownDuration ?? 300,
          countdownRemaining: parsed.countdownDuration ?? 300,
          countdownLabel: parsed.countdownLabel ?? "Gottesdienst beginnt in",
          selectedMonitor: parsed.selectedMonitor ?? 0,
        });
      }
    } catch {
      console.warn("Could not load settings");
    }
  },

  saveSettings: () => {
    try {
      const { countdownDuration, countdownLabel, selectedMonitor } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ countdownDuration, countdownLabel, selectedMonitor })
      );
    } catch {
      console.warn("Could not save settings");
    }
  },
}));

// Auto-save settings on changes
useStore.subscribe((state) => {
  state.saveSettings();
});

// Load settings on init
(() => {
  if (typeof window !== "undefined") {
    useStore.getState().loadSettings();
  }
})();
