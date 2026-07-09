/**
 * @glaze/core/preload compat — Phase 0 stub.
 *
 * Typed `any` placeholders so renderer/preload.ts (unchanged) type-checks and
 * bundles. Real contextBridge/ipcRenderer wrapping (incl. onNotification,
 * waitForReady) lands in Phase 1.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const ipcRenderer: any = {};
export const contextBridge: any = {};
export const createWebUtilsAPI: any = () => ({});
export const installDisplayMediaCompat: any = () => {};
