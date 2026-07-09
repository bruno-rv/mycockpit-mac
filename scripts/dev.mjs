/**
 * Dev orchestration for the plain-Vite fallback (see vite.config.ts gate note).
 *
 * Steps:
 *   1. Build main + preload once (lib mode) into out/.
 *   2. Start the Vite renderer dev server.
 *   3. Write .devserverhost so the (unchanged) main/windows/window-paths.ts picks
 *      up the dev server URL — no main-process edits needed in Phase 0.
 *   4. Launch Electron; tear everything down when it exits.
 */
import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build, createServer } from "vite";
import electron from "electron";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const devServerHostFile = resolve(projectRoot, ".devserverhost");

async function buildTarget(t) {
  process.env.BUILD_TARGET = t;
  await build({ configFile: resolve(projectRoot, "vite.config.ts"), root: projectRoot });
}

async function main() {
  await buildTarget("main");
  await buildTarget("preload");

  delete process.env.BUILD_TARGET;
  const server = await createServer({
    configFile: resolve(projectRoot, "vite.config.ts"),
    root: projectRoot,
  });
  await server.listen();
  const urls = server.resolvedUrls?.local ?? [];
  const devServerHost = (urls[0] ?? "http://localhost:5173/").replace(/\/$/, "");
  writeFileSync(devServerHostFile, devServerHost);
  server.config.logger.info(`\n  dev server: ${devServerHost}\n  launching Electron...`);

  const child = spawn(electron, [projectRoot], { stdio: "inherit", env: process.env });

  const shutdown = async () => {
    try {
      rmSync(devServerHostFile, { force: true });
    } catch {}
    await server.close();
  };

  child.on("exit", async (code) => {
    await shutdown();
    process.exit(code ?? 0);
  });

  process.on("SIGINT", async () => {
    child.kill();
    await shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
