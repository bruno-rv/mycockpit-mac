/**
 * Vite build configuration — plain-Vite FALLBACK path.
 *
 * PHASE-0 GATE DECISION (Vite 8 × electron-vite):
 *   The app pins Vite 8. `npm view electron-vite peerDependencies` on the stable
 *   line (electron-vite@5.0.0) reports `vite: "^5 || ^6 || ^7"` — it does NOT
 *   accept Vite 8. Only the pre-release electron-vite@6.0.0-beta.1 widens the
 *   range to include Vite 8. Founding a multi-phase port on a pre-release build
 *   tool was rejected. Per PORT_PLAN.md the documented fallback is used instead:
 *   plain Vite for the renderer + two Vite lib-mode builds (main, preload),
 *   orchestrated by npm scripts (scripts/dev.mjs, scripts/build.mjs) and packaged
 *   by electron-builder. `electron-vite` is therefore NOT a dependency.
 *
 * One config file serves all three targets, selected via BUILD_TARGET so the
 * shared alias map cannot drift between renderer / main / preload:
 *   BUILD_TARGET=main     → main-process lib build      → out/main/index.js  (ESM)
 *   BUILD_TARGET=preload  → preload lib build           → out/assets/preload.js (CJS)
 *   (unset / renderer)    → multi-entry renderer build  → out/renderer/      (+ dev server)
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = __dirname;

// Glaze's CLI injected __APP_DISPLAY_NAME__ from package.json at build time
// (see renderer/main/bootstrap.tsx); replicate that with a Vite `define`.
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8")) as { productName?: string };
const r = (p: string) => resolve(root, p);

// Shared path aliases. `@glaze/core/*` points at the local compat shims so
// almost no application file changes (the alias swap that makes this a port,
// not a rewrite).
const alias = {
  "@renderer": r("renderer"),
  "@main": r("main"),
  "@shared": r("renderer/shared"),
  "@glaze/core/backend": r("src/glaze-compat/backend/index.ts"),
  "@glaze/core/preload": r("src/glaze-compat/preload/index.ts"),
  "@glaze/core/ipc": r("src/glaze-compat/ipc/index.ts"),
  "@glaze/core/oauth": r("src/glaze-compat/oauth/index.ts"),
  "@glaze/core/components": r("src/glaze-compat/components/index.tsx"),
  "@glaze/core/hooks": r("src/glaze-compat/hooks/index.ts"),
  "@glaze/core/utils": r("src/glaze-compat/utils/index.ts"),
};

// The dev-only Glaze parity harness (renderer/dev/, main/dev/) is not present in
// this app. Resolve those imports to an empty no-op module so the main and
// preload bundles build without the missing files. The calls are already gated
// behind `process.env.GLAZE_DEV_HARNESS === "1"` (never set here).
const stubDevHarness = {
  name: "stub-glaze-dev-harness",
  resolveId(id: string) {
    if (id.includes("/dev/parity-")) return "\0glaze-dev-harness-stub";
    return null;
  },
  load(id: string) {
    if (id === "\0glaze-dev-harness-stub") {
      return "export function registerParityProbes(){}\nexport function applyParityScenarioStartup(){}\nexport async function runParityAutotestIfRequested(){}\n";
    }
    return null;
  },
};

// CSP is injected at HTML-transform time rather than hardcoded in the source
// html files (PORT_PLAN Phase 4): dev needs to allow the Vite dev server /
// HMR websocket, prod is locked down to 'self' + the specific OAuth/API hosts
// the app talks to. `ctx.server` is only set when transformIndexHtml runs
// against the dev server (see Vite's IndexHtmlTransformContext), which is the
// simplest available signal to pick the right variant without a second config.
const DEV_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*",
  "style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*",
  "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
].join("; ");

const PROD_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // RSS/YouTube thumbnails, GitHub/Google avatars.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // OAuth (loopback + device flow) and RSS fetching happen in the main
  // process, not here — nothing in the renderer calls these hosts directly.
  // Listed anyway per the Phase-3 CSP requirement; 'https:' already covers
  // them, this documents the specific hosts the app depends on.
  "connect-src 'self' https://github.com https://api.github.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
].join("; ");

const cspPlugin = {
  name: "inject-csp",
  transformIndexHtml(html: string, ctx: { server?: unknown }) {
    return html.replace("__CSP__", ctx.server ? DEV_CSP : PROD_CSP);
  },
};

const target = process.env.BUILD_TARGET;

const mainConfig: UserConfig = {
  resolve: { alias },
  plugins: [stubDevHarness],
  define: { "process.env.GLAZE_DEV_HARNESS": '"0"' },
  build: {
    outDir: "out/main",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    lib: {
      entry: r("main/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      // Bundle relative + aliased (@glaze compat) sources; keep electron, node
      // builtins and npm deps external so Electron's bundled Node resolves them.
      // @glaze/core/* must NOT be externalized — it is aliased to local compat
      // source that has to be bundled (checked before alias resolution runs).
      external: (id: string) => {
        if (id.startsWith("@glaze/core/")) return false;
        if (id === "electron" || id.startsWith("node:")) return true;
        return !id.startsWith(".") && !id.startsWith("/") && !/^[A-Za-z]:/.test(id);
      },
    },
  },
};

const preloadConfig: UserConfig = {
  resolve: { alias },
  plugins: [stubDevHarness],
  define: { "process.env.GLAZE_DEV_HARNESS": '"0"' },
  build: {
    // getPreloadPath() (main/windows/window-paths.ts, unchanged in Phase 0)
    // reads out/assets/preload.js.
    outDir: "out/assets",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    lib: {
      entry: r("renderer/preload.ts"),
      formats: ["cjs"],
      fileName: () => "preload.js",
    },
    rollupOptions: {
      external: (id: string) => id === "electron" || id.startsWith("node:"),
    },
  },
};

const rendererConfig: UserConfig = {
  root,
  base: "./",
  resolve: { alias },
  define: { __APP_DISPLAY_NAME__: JSON.stringify(pkg.productName ?? "") },
  plugins: [react(), tailwindcss(), cspPlugin],
  optimizeDeps: {
    // react-grid-layout ships CJS deps that `require("react")`.
    include: ["react-draggable", "react-resizable"],
  },
  build: {
    outDir: "out/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: r("main-window.html"),
        settings: r("settings-window.html"),
      },
    },
  },
};

export default defineConfig(
  target === "main" ? mainConfig : target === "preload" ? preloadConfig : rendererConfig,
);
