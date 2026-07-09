/**
 * Global type declarations for the Glaze compat layer.
 *
 * Moved out of the Glaze SDK's global.d.ts. `window.glazeAPI` is the ONLY way
 * the renderer reaches IPC (see renderer/preload.ts for the full surface).
 *
 * Phase 0 stub: only the surfaces the app actually uses are typed, just enough
 * to keep the alias-swapped renderer type-checking (generic `invoke<T>` and the
 * `onNotification` callback param in particular). Tightened in Phase 1/2.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface GlazeCompatIpc {
  invoke<T = any>(channel: string, ...args: any[]): Promise<T>;
  send(channel: string, ...args: any[]): void;
  on(channel: string, callback: (...args: any[]) => void): () => void;
  once(channel: string, callback: (...args: any[]) => void): () => void;
  onNotification(channel: string, callback: (params: any) => void): () => void;
  isConnected(): boolean;
  waitForReady(): Promise<void>;
  disconnect(): void;
}

interface GlazeCompatAPI {
  glaze: { ipc: GlazeCompatIpc };
  shell: { openExternal(url: string, options?: any): Promise<void>; [key: string]: any };
  nativeTheme: {
    getInfo(): Promise<any>;
    setThemeSource(source: "system" | "light" | "dark"): Promise<boolean>;
    [key: string]: any;
  };
  [key: string]: any;
}

declare global {
  interface Window {
    /** Glaze API exposed via contextBridge — the ONLY way to access IPC from renderer */
    glazeAPI: GlazeCompatAPI;
  }
}

export {};
