/**
 * Main window entry.
 *
 * react-grid-layout pulls in CommonJS dependencies (react-draggable,
 * react-resizable) that call `require("react")` / `require("react-dom")` at
 * module scope. React/ReactDOM are provided as ESM externals via the importmap,
 * so the bundler emits a runtime `require` that the WKWebView renderer doesn't
 * have. We install:
 *   1. a minimal `process` global (some bundled deps read process.env.NODE_ENV)
 *   2. a minimal `require` that maps the externalized ids to their ESM modules
 * BEFORE the app graph evaluates, then load the app via a deferred dynamic
 * import so these shims always run first.
 */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactJsxRuntime from "react/jsx-runtime";

function installShims(): void {
  const g = globalThis as unknown as {
    process?: { env: Record<string, string | undefined> };
    require?: (id: string) => unknown;
  };

  if (!g.process) g.process = { env: {} };
  if (!g.process.env) g.process.env = {};
  if (g.process.env.NODE_ENV == null) g.process.env.NODE_ENV = "production";

  if (typeof g.require !== "function") {
    const externals: Record<string, unknown> = {
      react: React,
      "react-dom": ReactDOM,
      "react/jsx-runtime": ReactJsxRuntime,
    };
    g.require = (id: string) => {
      if (id in externals) return externals[id];
      throw new Error(`Unsupported require("${id}") in renderer`);
    };
  }
}

installShims();

Promise.resolve()
  .then(() => import("./bootstrap"))
  .catch((e: unknown) => {
    console.error("[main] Failed to load app bootstrap", e);
  });
