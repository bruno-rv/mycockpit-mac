/**
 * Node ESM loader hook used only by scripts/check-oauth.mjs.
 *
 * Transpiles the real `src/glaze-compat/oauth/index.ts` (and the
 * `@glaze/core/backend` compat it imports) with esbuild — already a
 * devDependency, no test framework needed — and substitutes a virtual
 * `electron` module so the check can run outside an actual Electron process
 * with a mocked `safeStorage`/`app`/`shell`.
 */
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const BACKEND_URL = new URL("../src/glaze-compat/backend/index.ts", import.meta.url).href;
const ELECTRON_MOCK_URL = "electron-mock:virtual";

const ELECTRON_MOCK_SOURCE = `
export const app = {
  getPath: () => process.env.OAUTH_CHECK_USERDATA,
  whenReady: () => Promise.resolve(),
};
export const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from("enc:" + s, "utf-8"),
  decryptString: (buf) => Buffer.from(buf).toString("utf-8").replace(/^enc:/, ""),
};
export const shell = { openExternal: async () => {} };
export const nativeTheme = { shouldUseDarkColors: false, themeSource: "system" };
export class Menu {
  static buildFromTemplate(template) { return template; }
  static setApplicationMenu() {}
}
export class BrowserWindow {
  constructor() {}
  static getAllWindows() { return []; }
}
export const ipcMain = {
  handle() {},
  on() {},
  removeHandler() {},
};
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "electron") {
    return { url: ELECTRON_MOCK_URL, shortCircuit: true };
  }
  if (specifier === "@glaze/core/backend") {
    return { url: BACKEND_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === ELECTRON_MOCK_URL) {
    return { format: "module", source: ELECTRON_MOCK_SOURCE, shortCircuit: true };
  }
  if (url.endsWith(".ts")) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, "utf-8");
    const result = await transform(source, {
      loader: "ts",
      format: "esm",
      target: "node20",
      sourcefile: filePath,
    });
    return { format: "module", source: result.code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
