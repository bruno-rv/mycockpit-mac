/**
 * Main window entry.
 *
 * Under Glaze, React/ReactDOM were externalized via an importmap and this
 * file shimmed `require("react")` so react-grid-layout's CJS deps (which
 * `require("react")` at module scope) could resolve them at runtime. Under
 * normal Vite bundling React is bundled directly, so the shim is dead
 * weight — react-grid-layout's CJS deps resolve via `optimizeDeps.include`
 * (see vite.config.ts) like any other dependency (PORT_PLAN Phase 4).
 */
import "./bootstrap";
