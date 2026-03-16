import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { OutputPayload } from "../types";

export const OUTPUT_EVENT = "openstage:output";
export const VIDEO_CTRL_EVENT = "openstage:video-ctrl";

/** Broadcast a state update to the output window */
export async function sendToOutput(payload: OutputPayload) {
  try {
    await emit(OUTPUT_EVENT, payload);
  } catch (err) {
    console.warn("Failed to send to output:", err);
  }
}

/** Send video control: play | pause */
export async function sendVideoControl(action: "play" | "pause") {
  try {
    await emit(VIDEO_CTRL_EVENT, { action });
  } catch (err) {
    console.warn("Failed to send video control:", err);
  }
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
      const timeout = setTimeout(() => reject(new Error("Window creation timeout")), 10000);
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
    throw err;
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
  if (!w) {
    console.warn("Output window not found, trying to create it...");
    await openOutputWindow();
  }
  const windowInstance = await WebviewWindow.getByLabel("output");
  if (!windowInstance) {
    throw new Error("Could not create output window");
  }
  await windowInstance.setPosition({ type: "Physical", x, y } as any);
  await windowInstance.setSize({ type: "Physical", width, height } as any);
  await windowInstance.setFullscreen(true);
  await windowInstance.setFocus();
}

/** Close the output window */
export async function closeOutputWindow() {
  const w = await WebviewWindow.getByLabel("output");
  if (!w) return;
  try {
    await w.close();
  } catch (err) {
    console.error("Failed to close output window:", err);
  }
}
