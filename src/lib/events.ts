import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { OutputPayload } from "../types";

export const OUTPUT_EVENT = "openstage:output";
export const VIDEO_CTRL_EVENT = "openstage:video-ctrl";

/** Broadcast a state update to the output window */
export async function sendToOutput(payload: OutputPayload) {
  await emit(OUTPUT_EVENT, payload);
}

/** Send video control: play | pause */
export async function sendVideoControl(action: "play" | "pause") {
  await emit(VIDEO_CTRL_EVENT, { action });
}

/** Open the output window (or focus if already open) */
export async function openOutputWindow() {
  const existing = await WebviewWindow.getByLabel("output");
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return existing;
  }

  const w = new WebviewWindow("output", {
    url: "/?window=output",
    title: "OpenStage — Output",
    decorations: false,
    alwaysOnTop: false,
    resizable: true,
    width: 1280,
    height: 720,
  });

  // Wait for window to be created with timeout
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Window creation timeout")), 5000);
      w.once("tauri://created", () => {
        clearTimeout(timeout);
        resolve();
      });
      w.once("tauri://error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });
  } catch (err) {
    console.error("Failed to create output window:", err);
  }

  return w;
}

/** Move the output window to a specific monitor and fullscreen it */
export async function assignOutputToMonitor(
  x: number,
  y: number,
  width: number,
  height: number
) {
  const w = await WebviewWindow.getByLabel("output");
  if (!w) return;
  await w.setPosition({ type: "Physical", x, y } as any);
  await w.setSize({ type: "Physical", width, height } as any);
  await w.setFullscreen(true);
}

/** Close the output window */
export async function closeOutputWindow() {
  const w = await WebviewWindow.getByLabel("output");
  if (!w) return;
  await w.close();
}
