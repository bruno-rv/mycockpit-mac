/**
 * Production build for the plain-Vite fallback (see vite.config.ts gate note).
 * Builds all three targets into out/ (main, preload, renderer). Packaging is
 * handled separately by electron-builder via `npm run dist`.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configFile = resolve(projectRoot, "vite.config.ts");

async function buildTarget(t) {
  if (t) process.env.BUILD_TARGET = t;
  else delete process.env.BUILD_TARGET;
  await build({ configFile, root: projectRoot });
}

async function main() {
  await buildTarget("main");
  await buildTarget("preload");
  await buildTarget(undefined);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
