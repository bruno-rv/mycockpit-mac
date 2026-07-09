/**
 * Window Handlers
 *
 * Implements window:openWebsite — opens a URL in a native in-app BrowserWindow
 * with vibrancy (sidebar material), frame:true, hidden traffic lights.
 */

import { BrowserWindow, ipcMain, logger } from "@glaze/core/backend";
import { getPreloadPath } from "../windows/window-paths.js";

// Track open website windows to avoid duplicating the same URL
const websiteWindows = new Map<string, BrowserWindow>();

export function registerWindowHandlers(): void {
  ipcMain.handle("window:openWebsite", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("url" in params) ||
      typeof (params as { url: unknown }).url !== "string"
    ) {
      throw new Error("window:openWebsite requires { url: string, title?: string }");
    }

    const { url, title } = params as { url: string; title?: string };

    logger.info("window", `[window:openWebsite] url=${url} title=${title ?? "(none)"}`);

    // If a window for this URL is already open, focus it
    const existing = websiteWindows.get(url);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { ok: true };
    }

    const win = new BrowserWindow({
      windowKey: `website-${encodeURIComponent(url).slice(0, 40)}`,
      width: 1200,
      height: 800,
      minWidth: 600,
      minHeight: 400,
      title: title ?? url,
      frame: true,
      titleBarStyle: "hidden",
      backgroundColor: "#00000000",
      vibrancy: "sidebar",
      show: false,
      webPreferences: {
        preload: getPreloadPath(),
      },
    });

    win.setWindowButtonVisibility(false);

    win.once("ready-to-show", () => {
      win.show();
    });

    win.on("closed", () => {
      websiteWindows.delete(url);
    });

    websiteWindows.set(url, win);

    await win.loadURL(url);
    logger.info("window", `[window:openWebsite] opened window for url=${url}`);

    return { ok: true };
  });

  logger.info("window", "Window handlers registered");
}
