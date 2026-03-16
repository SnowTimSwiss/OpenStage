import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import type { OutputPayload } from "../types";

export const OUTPUT_EVENT = "openstage:output";
export const VIDEO_CTRL_EVENT = "openstage:video-ctrl";

let outputWindowOpening: Promise<WebviewWindow> | null = null;

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
  if (outputWindowOpening) return outputWindowOpening;
  outputWindowOpening = openOutputWindowInternal();
  try {
    return await outputWindowOpening;
  } finally {
    outputWindowOpening = null;
  }
}

async function openOutputWindowInternal() {
  const existing = await WebviewWindow.getByLabel("output");
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return existing;
  }

  let w: WebviewWindow;

  try {
    w = new WebviewWindow("output", {
    url: "/?window=output",
    title: "OpenStage — Output",
    decorations: false,
    alwaysOnTop: false,
    resizable: true,
    width: 1280,
    height: 720,
    });
  } catch (err) {
    const existingAfter = await WebviewWindow.getByLabel("output");
    if (existingAfter) return existingAfter;
    throw err;
  }

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
    // Fallback: sometimes the created event races; poll for the label briefly.
    for (let i = 0; i < 20; i++) {
      const recovered = await WebviewWindow.getByLabel("output");
      if (recovered) return recovered;
      await new Promise((r) => setTimeout(r, 50));
    }
    console.error("Failed to create output window:", err);
    throw err;
  }

  await w.show();
  await w.setFocus();
  return w;
}

/** Move the output window to a specific monitor and fullscreen it */
export async function assignOutputToMonitor(
  x: number,
  y: number,
  width: number,
  height: number
) {
  let windowInstance = await WebviewWindow.getByLabel("output");
  if (!windowInstance) {
    console.warn("Output window not found, trying to create it...");
    await openOutputWindow();
  }

  for (let i = 0; i < 20 && !windowInstance; i++) {
    await new Promise((r) => setTimeout(r, 50));
    windowInstance = await WebviewWindow.getByLabel("output");
  }

  if (!windowInstance) throw new Error("Could not create output window");

  const apply = async () => {
    await windowInstance!.show();
    await windowInstance!.setPosition(new PhysicalPosition(x, y));
    await windowInstance!.setSize(new PhysicalSize(width, height));
    try {
      await windowInstance!.setFullscreen(true);
    } catch (err) {
      console.warn("Failed to fullscreen output window:", err);
    }
    await windowInstance!.setFocus();
  };

  try {
    await apply();
  } catch (err) {
    await new Promise((r) => setTimeout(r, 100));
    await apply();
  }
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
