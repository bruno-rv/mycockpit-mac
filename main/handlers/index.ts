/**
 * Handler Registration
 *
 * Register all IPC handlers here.
 */

import * as path from "path";
import { fileURLToPath } from "url";

import { ipcMain, logger } from "@glaze/core/backend";

import { appHandlers } from "./app.js";
import { getSettingsWindow, openSettingsWindow } from "../windows/settings-window.js";
import { registerConfigHandlers } from "./config.js";
import { registerGitHubHandlers } from "./github.js";
import { registerRssHandlers } from "./rss.js";
import { registerAiHandlers } from "./ai.js";
import { registerGoogleHandlers } from "./google.js";
import { registerYouTubeHandlers } from "./youtube.js";
import { registerWindowHandlers } from "./window.js";
import { registerNativeHandlers } from "./native.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function registerHandlers(): void {
  logger.info("handlers", "Registering IPC handlers...");

  // ── App info ───────────────────────────────────────────────────────────
  ipcMain.handle("app:getInfo", async (_event) => {
    return await appHandlers.getInfo();
  });

  // Return the .glaze project path (used for deep links back to the host)
  // __dirname = build/main, so two levels up is the app root
  ipcMain.handle("app:getProjectPath", async () => {
    return path.join(__dirname, "..", "..");
  });

  // ── Settings window ────────────────────────────────────────────────────
  ipcMain.handle("window:openSettings", async (_event) => {
    await openSettingsWindow();
  });

  ipcMain.handle("window:closeSettings", async (_event) => {
    getSettingsWindow()?.close();
  });

  // ── Feature handlers ───────────────────────────────────────────────────
  registerConfigHandlers();
  registerGitHubHandlers();
  registerRssHandlers();
  registerAiHandlers();
  registerGoogleHandlers();
  registerYouTubeHandlers();
  registerWindowHandlers();
  registerNativeHandlers();

  logger.info("handlers", "✓ All IPC handlers registered");
}
