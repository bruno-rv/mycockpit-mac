/**
 * Web stub for the SDK's `usePreferredScrollerStyle` (PORT_PLAN 2.1 native-coupling fix).
 * The real hook reads `systemPreferences.getEffectiveAppearance()`-adjacent native scroller
 * prefs (legacy "always show" vs. macOS's default overlay scrollbars) via IPC. Electron/web
 * has no equivalent signal, and Radix's ScrollArea `type="overlay"`-equivalent behavior (the
 * `undefined` case scroll-area.tsx maps "overlay" to) is the right default for a bundled
 * Chromium renderer regardless of the user's native scrollbar preference.
 * ponytail: fixed "overlay" + upgrade path — none needed, this is the correct default.
 */
export function usePreferredScrollerStyle(): "overlay" | "legacy" | null {
  return "overlay";
}
