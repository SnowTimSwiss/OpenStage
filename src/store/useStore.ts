import { create } from "zustand";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { sendToOutput, openOutputWindow, assignOutputToMonitor, closeOutputWindow as closeOutputFn } from "../lib/events";
import type {
	  Song, SongSlide, MediaItem, MusicItem,
	  Monitor, TabId, OutputMode, PptxGroup, CountdownTheme,
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
	  loadMedia: () => Promise<void>;
	  loadSlides: () => Promise<void>;
	  goLiveSlide: (id: string) => void;
	  reorderSlides: (fromIndex: number, toIndex: number) => void;
	  removeSlide: (id: string) => void;

  // ── PPTX Groups ────────────────────────────────────────────────────────
  pptxGroups: PptxGroup[];
  expandedGroupId: string | null;
  loadPptx: () => Promise<void>;
  toggleExpandGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  goLiveSlideFromGroup: (groupId: string, slideIndex: number) => void;

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
	  countdownTargetTime: string | null; // "HH:MM" (local time)
	  countdownTheme: CountdownTheme;
	  setCountdownDuration: (s: number) => void;
	  setCountdownLabel: (l: string) => void;
	  setCountdownTargetTime: (t: string | null) => void;
	  applyCountdownTargetTime: () => void;
	  setCountdownTheme: (theme: CountdownTheme) => void;
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
  outputMonitorIndex: number | null; // null = kein Output-Monitor ausgewählt
  outputWindowOpen: boolean;
  fetchMonitors: () => Promise<void>;
  setOutputMonitor: (i: number | null) => Promise<void>;
  closeOutputWindow: () => Promise<void>;

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

  // ── PPTX Groups ────────────────────────────────────────────────────────
  pptxGroups: [],
  expandedGroupId: null,

	  loadPptx: async () => {
	    const { setLoading, setError, clearError } = get();
	    try {
	      setLoading(true);
	      clearError();
	      const files = await openDialog({
	        multiple: true,
	        filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
	      });
	      if (!files) return;
	      const arr = Array.isArray(files) ? files : [files];
	      
	      for (const file of arr) {
	        const filePath = file as string;
	        const pptxFile = await invoke<any>("import_pptx", { path: filePath });
	        const groupId = crypto.randomUUID();
	        
	        const slides: MediaItem[] = pptxFile.slides.map((slide: any) => ({
	          id: crypto.randomUUID(),
	          name: slide.name,
	          path: filePath,
	          src: convertFileSrc(slide.image_path),
	          type: "image",
	          groupId,
	        }));
	        
	        set((s) => ({
	          pptxGroups: [...s.pptxGroups, { id: groupId, name: pptxFile.name, slides }],
	        }));
	      }
	    } catch (err) {
	      setError(err instanceof Error ? err.message : "Fehler beim Laden der PowerPoint-Datei");
	    } finally {
	      setLoading(false);
	    }
	  },

  toggleExpandGroup: (groupId) =>
    set((s) => ({ expandedGroupId: s.expandedGroupId === groupId ? null : groupId })),

  removeGroup: (groupId) =>
    set((s) => ({
      pptxGroups: s.pptxGroups.filter((g) => g.id !== groupId),
      slides: s.slides.filter((x) => x.groupId !== groupId),
    })),

  goLiveSlideFromGroup: (groupId, slideIndex) => {
    const group = get().pptxGroups.find((g) => g.id === groupId);
    if (!group || !group.slides[slideIndex]) return;
    const slide = group.slides[slideIndex];
    set({ activeSlideId: slide.id, outputMode: "image", isBlackout: false });
    sendToOutput({ mode: "image", image: { src: slide.src } });
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

  // ── Countdown ──────────────────────────────────────────────────────────
	  countdownDuration: 300,
	  countdownRemaining: 300,
	  countdownLabel: "Gottesdienst beginnt in",
	  countdownRunning: false,
	  countdownLive: false,
	  countdownTargetTime: null,
	  countdownTheme: "minimal",

	  setCountdownDuration: (s) => set({ countdownDuration: s, countdownRemaining: s }),
	  setCountdownLabel: (l) => set({ countdownLabel: l }),
	  setCountdownTargetTime: (t) => set({ countdownTargetTime: t }),

	  applyCountdownTargetTime: () => {
	    const t = get().countdownTargetTime;
	    if (!t) return;
	    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
	    if (!m) return;
	    const hh = Number(m[1]);
	    const mm = Number(m[2]);
	    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return;

	    const now = new Date();
	    const target = new Date(now);
	    target.setHours(hh, mm, 0, 0);
	    if (target.getTime() <= now.getTime()) {
	      target.setDate(target.getDate() + 1);
	    }
	    const diffSeconds = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));

	    if (countdownInterval) {
	      clearInterval(countdownInterval);
	      countdownInterval = null;
	    }
	    set({ countdownRunning: false, countdownDuration: diffSeconds, countdownRemaining: diffSeconds });

	    if (get().countdownLive) {
	      sendToOutput({
	        mode: "countdown",
	        countdown: {
	          remaining: diffSeconds,
	          label: get().countdownLabel,
	          running: false,
	          theme: get().countdownTheme,
	        },
	      });
	    }
	  },

	  setCountdownTheme: (theme) => {
	    set({ countdownTheme: theme });
	    if (get().countdownLive) {
	      sendToOutput({
	        mode: "countdown",
	        countdown: {
	          remaining: get().countdownRemaining,
	          label: get().countdownLabel,
	          running: get().countdownRunning,
	          theme,
	        },
	      });
	    }
	  },

	  startCountdown: () => {
	    if (get().countdownRunning) return;
	    set({ countdownRunning: true });
	    countdownInterval = setInterval(() => {
	      const { countdownRemaining, countdownLabel, countdownLive, stopCountdown, countdownTheme } = get();
	      const next = countdownRemaining - 1;
	      set({ countdownRemaining: Math.max(next, 0) });
	      if (countdownLive) {
	        sendToOutput({
	          mode: "countdown",
	          countdown: { remaining: Math.max(next, 0), label: countdownLabel, running: true, theme: countdownTheme },
	        });
	      }
	      if (next <= 0) stopCountdown();
	    }, 1000);
	  },

	  stopCountdown: () => {
	    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
	    set({ countdownRunning: false });
	    const { countdownRemaining, countdownLabel, countdownTheme } = get();
	    if (get().countdownLive) {
	      sendToOutput({
	        mode: "countdown",
	        countdown: { remaining: countdownRemaining, label: countdownLabel, running: false, theme: countdownTheme },
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
	        countdown: { remaining: d, label: get().countdownLabel, running: false, theme: get().countdownTheme },
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
	          theme: get().countdownTheme,
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
  outputMonitorIndex: null,
  outputWindowOpen: false,

	  fetchMonitors: async () => {
	    try {
	      const monitors = await invoke<Monitor[]>("get_monitors");
	      set({ monitors });

	      // If a monitor is already configured, (re)open and place the output window.
	      const configured = get().outputMonitorIndex;
	      if (configured !== null) {
	        if (configured >= 0 && configured < monitors.length) {
	          await get().setOutputMonitor(configured);
	        } else {
	          set({ outputMonitorIndex: null, outputWindowOpen: false });
	        }
	      }
	    } catch (err) {
	      console.warn("Could not fetch monitors:", err);
	      set({ monitors: [] });
	    }
  },

  setOutputMonitor: async (i) => {
    set({ outputMonitorIndex: i });
    if (i === null) {
      // Close output window
      await closeOutputFn();
      set({ outputWindowOpen: false });
    } else {
      // Open/reposition output window on selected monitor
      try {
        const m = get().monitors[i];
        if (m) {
          await openOutputWindow();
          await assignOutputToMonitor(m.x, m.y, m.width, m.height);
          set({ outputWindowOpen: true, error: null });
        }
      } catch (err) {
        console.error("Failed to set output monitor:", err);
        set({ error: "Ausgabefenster konnte nicht geöffnet werden" });
      }
    }
  },

  closeOutputWindow: async () => {
    try {
      await closeOutputFn();
    } catch (err) {
      console.error("Failed to close output window:", err);
    }
    set({ outputWindowOpen: false });
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
	          countdownTargetTime: parsed.countdownTargetTime ?? null,
	          countdownTheme: parsed.countdownTheme ?? "minimal",
	          outputMonitorIndex: parsed.outputMonitorIndex ?? null,
	        });
	      }
	    } catch {
	      console.warn("Could not load settings");
    }
  },

	  saveSettings: () => {
	    try {
	      const { countdownDuration, countdownLabel, countdownTargetTime, countdownTheme, outputMonitorIndex } = get();
	      localStorage.setItem(
	        STORAGE_KEY,
	        JSON.stringify({ countdownDuration, countdownLabel, countdownTargetTime, countdownTheme, outputMonitorIndex })
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
