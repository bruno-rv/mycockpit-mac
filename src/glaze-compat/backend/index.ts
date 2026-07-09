/**
 * @glaze/core/backend compat.
 *
 * NOTE (Phase-0 deviation): PORT_PLAN Phase 0 lists this as an empty stub, but
 * the mandatory Phase-0 verification ("npm run dev launches an Electron window,
 * main process does not crash") cannot pass with an empty backend — main/index.ts
 * calls app.whenReady(), new BrowserWindow(...), Menu.*, ipcMain.handle(...) at
 * boot. So this file is functional (real Electron passthrough) rather than `any`.
 * It front-loads the core of Phase 1.1; the richer pieces (windowKey frame
 * persistence, structured logger, initDevToolsButtonState behavior) stay deferred.
 */
import {
  app,
  Menu as ElectronMenu,
  safeStorage,
  shell,
  ipcMain as electronIpcMain,
  BrowserWindow as ElectronBrowserWindow,
} from "electron";
import type {
  BrowserWindowConstructorOptions,
  IpcMain,
  Menu as ElectronMenuInstance,
  MenuItemConstructorOptions,
} from "electron";

export { app, safeStorage, shell };

/**
 * Menu wrapper. Glaze menu templates use SF-Symbol string `icon`s (e.g.
 * "gearshape") that Electron's Menu cannot parse (it expects a NativeImage or
 * image path) and which otherwise throw during buildFromTemplate. Strip string
 * icons so the app menu builds; real symbol rendering is out of MVP scope.
 */
function stripStringIcons(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return template.map((item) => {
    const next: MenuItemConstructorOptions = { ...item };
    if (typeof next.icon === "string") delete next.icon;
    if (Array.isArray(next.submenu)) next.submenu = stripStringIcons(next.submenu);
    return next;
  });
}

export const Menu = {
  buildFromTemplate(template: MenuItemConstructorOptions[]): ElectronMenuInstance {
    return ElectronMenu.buildFromTemplate(stripStringIcons(template));
  },
  setApplicationMenu(menu: ElectronMenuInstance | null): void {
    ElectronMenu.setApplicationMenu(menu);
  },
};

/**
 * BrowserWindow wrapper accepting Glaze's extra constructor options (e.g.
 * `windowKey`). `windowKey` is dropped for the MVP (no frame persistence);
 * everything else is passed straight through to Electron.
 *
 * Defaults `vibrancy: 'sidebar'` + `titleBarStyle: 'hiddenInset'` (PORT_PLAN
 * Phase 4 drag-region bullet): WKWebView under Glaze rendered on a vibrant,
 * inset-title-bar host window for free. Plain Electron windows are flat gray
 * with a full native title bar unless told otherwise. Callers can still
 * override either option explicitly.
 */
type GlazeWindowOptions = BrowserWindowConstructorOptions & {
  windowKey?: string;
  [key: string]: unknown;
};

export class BrowserWindow extends ElectronBrowserWindow {
  constructor(options: GlazeWindowOptions = {}) {
    const { windowKey: _windowKey, ...electronOptions } = options;
    super({
      vibrancy: "sidebar",
      titleBarStyle: "hiddenInset",
      ...electronOptions,
    } as BrowserWindowConstructorOptions);
  }
}

/**
 * Electron's ipcMain plus Glaze's `broadcast` extension (send a channel to every
 * open window's webContents).
 */
export const ipcMain: IpcMain & {
  broadcast(channel: string, ...args: unknown[]): void;
} = Object.assign(electronIpcMain, {
  broadcast(channel: string, ...args: unknown[]): void {
    for (const win of ElectronBrowserWindow.getAllWindows()) {
      win.webContents.send(channel, ...args);
    }
  },
});

type LogFn = (scope: string, message: string, meta?: unknown) => void;

export const logger: { info: LogFn; debug: LogFn; warn: LogFn; error: LogFn } = {
  info: (scope, message, meta) => console.info(`[${scope}] ${message}`, meta ?? ""),
  debug: (scope, message, meta) => console.debug(`[${scope}] ${message}`, meta ?? ""),
  warn: (scope, message, meta) => console.warn(`[${scope}] ${message}`, meta ?? ""),
  error: (scope, message, meta) => console.error(`[${scope}] ${message}`, meta ?? ""),
};

export async function initDevToolsButtonState(): Promise<void> {}
