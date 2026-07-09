/**
 * @glaze/core/preload compat.
 *
 * Real Electron `contextBridge` plus a thin wrapper around `ipcRenderer` that
 * adds Glaze's non-standard extensions used by renderer/preload.ts:
 * `onNotification` (subscribe to backend push notifications) and simple
 * connection-state helpers. A same-process Electron IPC channel is always
 * "connected" once the renderer exists, so isConnected/waitForReady/
 * disconnect are trivial here (see PORT_PLAN 1.2).
 *
 * `createWebUtilsAPI` / `installDisplayMediaCompat` are exposed but unused by
 * the app (Electron ships its own `webUtils`; no `getDisplayMedia` handler is
 * registered) — stubbed as no-ops per PORT_PLAN 1.2.
 *
 * Typed loosely (`any`) to match the real Glaze `ipcRenderer`'s own signature
 * (`invoke(channel, ...args): Promise<any>`, listeners typed against Glaze's
 * own `IpcRendererEvent`, not Electron's) — renderer/preload.ts's per-call
 * generics (`invoke<T>`) and its own `GlazeIpcEvent` listener shape are what
 * actually narrow the type at each call site.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge as electronContextBridge, ipcRenderer as electronIpcRenderer } from "electron";

export const contextBridge = electronContextBridge;

type IpcListener = (event: any, ...args: any[]) => void;
type NotificationListener = (params: unknown) => void;

export const ipcRenderer = {
  invoke: (channel: string, ...args: unknown[]): Promise<any> => electronIpcRenderer.invoke(channel, ...args),

  send: (channel: string, ...args: unknown[]): void => {
    electronIpcRenderer.send(channel, ...args);
  },

  on: (channel: string, listener: IpcListener): void => {
    electronIpcRenderer.on(channel, listener);
  },

  once: (channel: string, listener: IpcListener): void => {
    electronIpcRenderer.once(channel, listener);
  },

  removeListener: (channel: string, listener: IpcListener): void => {
    electronIpcRenderer.removeListener(channel, listener);
  },

  /** Glaze extension: subscribe to a backend push notification. */
  onNotification: (channel: string, callback: NotificationListener): (() => void) => {
    const listener: IpcListener = (_event, payload) => callback(payload);
    electronIpcRenderer.on(channel, listener);
    return () => electronIpcRenderer.removeListener(channel, listener);
  },

  isConnected: (): boolean => true,
  waitForReady: (): Promise<void> => Promise.resolve(),
  disconnect: (): void => {},
};

/** Unused by the app; Electron ships its own `webUtils`. */
export function createWebUtilsAPI(): Record<string, never> {
  return {};
}

/** Unused by the app (no `setDisplayMediaRequestHandler` registered). */
export function installDisplayMediaCompat(): void {}
