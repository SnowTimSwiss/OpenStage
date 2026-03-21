import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import type { OutputPayload } from "../types";

export const OUTPUT_EVENT = "openstage:output";
export const OUTPUT_READY_EVENT = "openstage:output-ready";
export const VIDEO_CTRL_EVENT = "openstage:video-ctrl";

let outputWindowOpening: Promise<WebviewWindow> | null = null;
let lastOutputPayload: OutputPayload = { mode: "blank" };

/** Broadcast a state update to all output windows */
export async function sendToOutput(payload: OutputPayload) {
  try {
    lastOutputPayload = payload;
    console.log("[sendToOutput] Sending payload:", payload);

    // Emit to all listeners (this is the main way)
    await emit(OUTPUT_EVENT, payload);
  } catch (err) {
    console.warn("Failed to send to output:", err);
  }
}

/** Get the most recently broadcast output payload */
export function getLastOutputPayload(): OutputPayload {
  return lastOutputPayload;
}

/** Send video control: play | pause to all output windows */
export async function sendVideoControl(action: "play" | "pause") {
  try {
    await emit(VIDEO_CTRL_EVENT, { action });
  } catch (err) {
    console.warn("Failed to send video control:", err);
  }
}

/** Get the label for an output window for a specific monitor */
export function getOutputWindowLabel(monitorIndex: number): string {
  return `output-${monitorIndex}`;
}

/** Open the output window (or focus if already open) - legacy single window */
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

/** Open an output window for a specific monitor */
export async function openOutputWindowForMonitor(monitorIndex: number): Promise<WebviewWindow> {
  const label = getOutputWindowLabel(monitorIndex);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return existing;
  }

  let w: WebviewWindow;

  try {
    w = new WebviewWindow(label, {
      url: `/?window=output&monitor=${monitorIndex}`,
      title: `OpenStage — Output ${monitorIndex + 1}`,
      decorations: false,
      alwaysOnTop: false,
      resizable: true,
      width: 1280,
      height: 720,
    });
  } catch (err) {
    const existingAfter = await WebviewWindow.getByLabel(label);
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
      const recovered = await WebviewWindow.getByLabel(label);
      if (recovered) return recovered;
      await new Promise((r) => setTimeout(r, 50));
    }
    console.error(`Failed to create output window for monitor ${monitorIndex}:`, err);
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

/** Move a specific monitor's output window to that monitor and fullscreen it */
export async function assignOutputWindowToMonitor(
  monitorIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const label = getOutputWindowLabel(monitorIndex);
  let windowInstance = await WebviewWindow.getByLabel(label);
  
  if (!windowInstance) {
    console.warn(`Output window for monitor ${monitorIndex} not found, creating it...`);
    windowInstance = await openOutputWindowForMonitor(monitorIndex);
  }

  // Wait for window to be ready
  for (let i = 0; i < 20 && !windowInstance; i++) {
    await new Promise((r) => setTimeout(r, 50));
    windowInstance = await WebviewWindow.getByLabel(label);
  }

  if (!windowInstance) throw new Error(`Could not create output window for monitor ${monitorIndex}`);

  const apply = async () => {
    await windowInstance!.show();
    await windowInstance!.setPosition(new PhysicalPosition(x, y));
    await windowInstance!.setSize(new PhysicalSize(width, height));
    try {
      await windowInstance!.setFullscreen(true);
    } catch (err) {
      console.warn(`Failed to fullscreen output window for monitor ${monitorIndex}:`, err);
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

/** Close the output window - legacy single window */
export async function closeOutputWindow() {
  const w = await WebviewWindow.getByLabel("output");
  if (!w) return;
  try {
    await w.close();
  } catch (err) {
    console.error("Failed to close output window:", err);
  }
}

/** Close the output window for a specific monitor */
export async function closeOutputWindowForMonitor(monitorIndex: number) {
  const label = getOutputWindowLabel(monitorIndex);
  const w = await WebviewWindow.getByLabel(label);
  if (!w) return;
  try {
    await w.close();
  } catch (err) {
    console.error(`Failed to close output window for monitor ${monitorIndex}:`, err);
  }
}

/** Close all output windows */
export async function closeAllOutputWindows() {
  const allWindows = await WebviewWindow.getAll();
  for (const w of allWindows) {
    if (w.label.startsWith("output-")) {
      try {
        await w.close();
      } catch (err) {
        console.error(`Failed to close output window ${w.label}:`, err);
      }
    }
  }
  // Also close legacy single window if exists
  await closeOutputWindow();
}
