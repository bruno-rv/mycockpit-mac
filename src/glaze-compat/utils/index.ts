/**
 * @glaze/core/utils compat — Phase 1 (PORT_PLAN 2.3).
 *
 * `cn` is the standard clsx + tailwind-merge combinator (both already
 * dependencies). `initLogging` is a near-no-op console setup — the app never
 * did more than call it once at boot.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function initLogging(): void {
  // ponytail: no-op + upgrade path — wire to a real renderer logger if/when needed.
}

/**
 * Glaze's native build could gate a few cosmetic corner-radius/pill-size branches
 * (toolbar.tsx, split-view.tsx) on macOS 26+ ("Tahoe" and later). There's no Electron
 * renderer API for OS version without a round trip to the main process, and the
 * affected branches are purely cosmetic (they still render correctly on any macOS
 * version) — so this hard-codes the pre-Tahoe styling.
 * ponytail: no real OS-version detection + upgrade path — pipe `process.getSystemVersion()`
 * from main via IPC if the Tahoe-specific styling is ever needed.
 */
export function isMacOS27Plus(): boolean {
  return false;
}
