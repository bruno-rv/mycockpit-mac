/**
 * @glaze/core/hooks compat — Phase 1.
 *
 * `useTheme`, `useConnection`, `useEnvironment` are the three hooks
 * root-view.tsx imports (PORT_PLAN 2.2). `useTheme` is backed by the real
 * Phase-1 `nativeTheme:getInfo` handler (main/handlers/native.ts) and applies
 * the `.dark` class the same way main-window.html's inline boot script does.
 * `useConnection`/`useEnvironment` only drive dev-only status badges in
 * root-view.tsx, so trivial constants are enough for boot.
 */
import { useEffect } from "react";

export function useTheme(): void {
  useEffect(() => {
    let cancelled = false;

    void window.glazeAPI.nativeTheme
      .getInfo()
      .then((info) => {
        if (!cancelled) {
          document.documentElement.classList.toggle("dark", Boolean(info?.shouldUseDarkColors));
        }
      })
      .catch(() => {
        // Ignore — the inline prefers-color-scheme check in *-window.html already ran.
      });

    return () => {
      cancelled = true;
    };
  }, []);
}

export function useConnection(): { data: { connected: boolean }; error: unknown } {
  return { data: { connected: true }, error: null };
}

export function useEnvironment(): { data: { type: "dev-server" | "app" } } {
  return { data: { type: import.meta.env.DEV ? "dev-server" : "app" } };
}
