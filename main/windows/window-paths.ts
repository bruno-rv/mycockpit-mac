import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Use unique names to avoid conflicts with esbuild's CommonJS shims
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

// Backend bundles to out/main/index.js (single-chunk lib build, see
// vite.config.ts mainConfig), so import.meta.url resolves to that file
// regardless of which source module it came from. One level up is out/.
const BUILD_ROOT = path.resolve(currentDirPath, "..");

// Renderer HTML + assets build to out/renderer/ (see vite.config.ts
// rendererConfig outDir), a sibling of out/main/ and out/assets/ under BUILD_ROOT.
const RENDERER_ROOT = path.join(BUILD_ROOT, "renderer");

/**
 * Absolute path to the build directory that contains HTML entry points.
 */
export function getBuildRoot(): string {
  return RENDERER_ROOT;
}

/**
 * Resolve the on-disk HTML file for a given window.
 */
export function resolveWindowHtml(htmlFileName: string): string {
  return path.join(RENDERER_ROOT, htmlFileName);
}

/**
 * Return a file:// URL for a locally built HTML file.
 */
export function getWindowFileUrl(htmlFileName: string): string {
  return pathToFileURL(resolveWindowHtml(htmlFileName)).toString();
}

/**
 * Absolute path to the built preload script.
 *
 * The Vite lib build outputs the preload entry to `out/assets/preload.js` as a
 * CJS bundle with a stable (non-hashed) filename (see vite.config.ts
 * preloadConfig). Electron reads this path from `webPreferences.preload` and
 * injects it into the isolated preload context before page scripts run — in
 * both dev and prod, since Electron (unlike Glaze's WKWebView host) always
 * requires a prebuilt JS file here, never TypeScript source directly.
 */
export function getPreloadPath(): string {
  return path.join(BUILD_ROOT, "assets", "preload.js");
}

/**
 * Resolve the correct URL for a window, preferring the dev server when available.
 */
export async function getWindowUrl(htmlFileName: string): Promise<string> {
  // .devserverhost is written to the project root by scripts/dev.mjs.
  // BUILD_ROOT is out/, so we go one level up to reach the project root.
  const devServerHostFile = path.join(BUILD_ROOT, "..", ".devserverhost");

  if (fs.existsSync(devServerHostFile)) {
    try {
      const devServerHost = (await fs.promises.readFile(devServerHostFile, "utf-8")).trim();
      if (devServerHost) {
        return `${devServerHost}/${htmlFileName}`;
      }
    } catch {
      // Fall back to the built file
    }
  }

  return getWindowFileUrl(htmlFileName);
}
