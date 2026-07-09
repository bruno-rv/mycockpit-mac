/**
 * Native host handlers.
 *
 * Glaze's runtime provided nativeTheme/shell handlers for free; standalone
 * Electron has no equivalent. This registers the minimal set the renderer
 * (via window.glazeAPI, see renderer/preload.ts) actually calls:
 * nativeTheme:getInfo, nativeTheme:setThemeSource, shell:openExternalWithResult.
 */
import { nativeTheme } from "electron";
import type { OpenExternalOptions } from "electron";

import { ipcMain, logger, shell } from "@glaze/core/backend";
import type { NativeThemeInfo } from "@glaze/core/ipc";

function getNativeThemeInfo(): NativeThemeInfo {
  return {
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    themeSource: nativeTheme.themeSource,
  };
}

export function registerNativeHandlers(): void {
  ipcMain.handle("nativeTheme:getInfo", async (): Promise<NativeThemeInfo> => getNativeThemeInfo());

  ipcMain.handle(
    "nativeTheme:setThemeSource",
    async (_event, source: "system" | "light" | "dark"): Promise<boolean> => {
      nativeTheme.themeSource = source;
      return true;
    },
  );

  ipcMain.handle(
    "shell:openExternalWithResult",
    async (_event, url: string, options?: OpenExternalOptions): Promise<boolean> => {
      try {
        await shell.openExternal(url, options);
        return true;
      } catch (error) {
        logger.error("native", "shell:openExternalWithResult failed", { url, error });
        return false;
      }
    },
  );

  logger.info("native", "Native handlers registered");
}
