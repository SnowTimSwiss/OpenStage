import { create } from "zustand";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { sendToOutput, openOutputWindow, assignOutputToMonitor, closeOutputWindow as closeOutputFn } from "../lib/events";
import { secondsUntilTargetTime } from "../lib/formatTime";
import type {
  Song, MediaItem, MusicItem,
  Monitor, TabId, OutputMode, PptxGroup, CountdownTheme,
} from "../types";

const STORAGE_KEY = "openstage-settings-v1";

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let musicAudio: HTMLAudioElement | null = null;
let musicAudioSrc: string | null = null;
let backgroundMusicAudio: HTMLAudioElement | null = null;

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
  countdownRemaining: number;
  countdownLabel: string;
  countdownRunning: boolean;
  countdownLive: boolean;
  countdownTargetTime: string | null;
  countdownTheme: CountdownTheme;
  countdownBackgroundMusicId: string | null;
  setCountdownLabel: (l: string) => void;
  setCountdownTargetTime: (t: string | null) => void;
  applyCountdownTargetTime: () => void;
  setCountdownTheme: (theme: CountdownTheme) => void;
  setCountdownBackgroundMusic: (id: string | null) => void;
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
  loadMusic: () => Promise<void>;
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

  // ── Display ────────────────────────────────────────────────────────────
  monitors: Monitor[];
  outputMonitorIndex: number | null;
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
  countdownRemaining: 0,
  countdownLabel: "Gottesdienst beginnt in",
  countdownRunning: false,
  countdownLive: false,
  countdownTargetTime: null,
  countdownTheme: "minimal",
  countdownBackgroundMusicId: null,

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

    if (get().countdownLive) {
      sendToOutput({
        mode: "countdown",
        countdown: {
          remaining: diffSeconds,
          label: get().countdownLabel,
          running: false,
          theme: get().countdownTheme,
          targetTime: t,
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
          targetTime: get().countdownTargetTime,
        },
      });
    }
  },

  setCountdownBackgroundMusic: (id) => {
    set({ countdownBackgroundMusicId: id });
  },

  startCountdown: () => {
    const { countdownTargetTime, countdownBackgroundMusicId, songs } = get();

    // Start background music if configured
    if (countdownBackgroundMusicId && countdownTargetTime) {
      const song = songs.find((s) => s.id === countdownBackgroundMusicId);
      if (song && song.slides.length > 0) {
        // Use first slide text as file path (user should paste file path there)
        const audioPath = song.slides[0]?.text;
        if (audioPath) {
          const a = ensureBackgroundMusicAudio();
          if (a) {
            const bgMusicSrc = convertFileSrc(audioPath);
            a.src = bgMusicSrc;
            
            // Calculate delay so music ends at 0:00
            const remainingSeconds = secondsUntilTargetTime(countdownTargetTime);
            
            a.addEventListener("loadedmetadata", () => {
              const musicDuration = a.duration;
              const delayMs = (remainingSeconds - musicDuration) * 1000;
              
              if (delayMs > 0) {
                setTimeout(() => {
                  a.play().catch(() => {});
                }, delayMs);
              } else {
                a.play().catch(() => {});
              }
            });
          }
        }
      }
    }

    if (get().countdownRunning) return;

    // Recalculate remaining time based on target
    const t = get().countdownTargetTime;
    if (t) {
      const diffSeconds = secondsUntilTargetTime(t);
      set({ countdownRemaining: diffSeconds });
    }

    set({ countdownRunning: true });
    countdownInterval = setInterval(() => {
      const { countdownRemaining, countdownLabel, countdownLive, stopCountdown, countdownTheme, countdownTargetTime } = get();
      const next = countdownRemaining - 1;
      set({ countdownRemaining: Math.max(next, 0) });
      if (countdownLive) {
        sendToOutput({
          mode: "countdown",
          countdown: { remaining: Math.max(next, 0), label: countdownLabel, running: true, theme: countdownTheme, targetTime: countdownTargetTime },
        });
      }
      if (next <= 0) stopCountdown();
    }, 1000);
  },

  stopCountdown: () => {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    set({ countdownRunning: false });
    const { countdownRemaining, countdownLabel, countdownTheme, countdownTargetTime } = get();
    if (get().countdownLive) {
      sendToOutput({
        mode: "countdown",
        countdown: { remaining: countdownRemaining, label: countdownLabel, running: false, theme: countdownTheme, targetTime: countdownTargetTime },
      });
    }
  },

  resetCountdown: () => {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    const t = get().countdownTargetTime;
    let diffSeconds = 0;
    if (t) {
      diffSeconds = secondsUntilTargetTime(t);
    }
    set({ countdownRunning: false, countdownRemaining: diffSeconds });
    if (get().countdownLive) {
      sendToOutput({
        mode: "countdown",
        countdown: { remaining: diffSeconds, label: get().countdownLabel, running: false, theme: get().countdownTheme, targetTime: t },
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
          targetTime: get().countdownTargetTime,
        },
      });
    } else {
      sendToOutput({ mode: "blank" });
    }
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
        name: (f as string).split(/[\\/]/).pop() ?? f as string,
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
  setMusicPlaying: (p) => {
    const fadeDuration = get().musicFadeDuration;
    const a = ensureMusicAudio();
    if (!a) return;

    if (p) {
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
    const { music, musicIndex, setMusicIndex, setMusicPlaying } = get();
    if (music.length === 0) return;
    const next = (musicIndex + 1) % music.length;
    setMusicIndex(next);
    set({ musicCurrentTime: 0 });
    setMusicPlaying(true);
  },

  playPrevMusic: () => {
    const { music, musicIndex, setMusicIndex, setMusicPlaying } = get();
    if (music.length === 0) return;
    const prev = (musicIndex - 1 + music.length) % music.length;
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

  // ── Display ──────────────────────────────────────────────────────────────
  monitors: [],
  outputMonitorIndex: null,
  outputWindowOpen: false,

  fetchMonitors: async () => {
    try {
      const monitors = await invoke<Monitor[]>("get_monitors");
      set({ monitors });

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
      await closeOutputFn();
      set({ outputWindowOpen: false });
    } else {
      try {
        const m = get().monitors[i];
        if (m) {
          await openOutputWindow();
          await assignOutputToMonitor(m.x, m.y, m.width, m.height);
          set({ outputWindowOpen: true, error: null });
        }
      } catch (err) {
        console.error("Failed to set output monitor:", err);
        const msg = formatUnknownError(err);
        set({ error: `Ausgabefenster konnte nicht geöffnet werden: ${msg}` });
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
      const { countdownLabel, countdownTargetTime, countdownTheme, outputMonitorIndex } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ countdownLabel, countdownTargetTime, countdownTheme, outputMonitorIndex })
      );
    } catch {
      console.warn("Could not save settings");
    }
  },
}));

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
  if (!prevState) {
    state.saveSettings();
    return;
  }

  const changed =
    state.countdownLabel !== prevState.countdownLabel ||
    state.countdownTargetTime !== prevState.countdownTargetTime ||
    state.countdownTheme !== prevState.countdownTheme ||
    state.outputMonitorIndex !== prevState.outputMonitorIndex;

  if (changed) state.saveSettings();
});

// Load settings on init
(() => {
  if (typeof window !== "undefined") {
    useStore.getState().loadSettings();
    initMusicEngine();
  }
})();
