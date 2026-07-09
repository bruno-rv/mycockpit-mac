# Implementation Plan: Port "My Cockpit" from Glaze to Standalone Electron

## Executive summary

The Glaze coupling is Electron-compatible by design, so this is a **compat-shim + alias-swap** port, not a rewrite. The strategy:

1. Create `src/glaze-compat/` modules mirroring each `@glaze/core/*` entrypoint, backed by real Electron APIs plus a thin bridge for Glaze's two non-standard IPC conventions (`ipcMain.broadcast`, `ipcRenderer.onNotification`).
2. Vendor the ~30 Glaze UI components the app actually uses (full `.tsx` source is available in the SDK) plus their CSS/fonts.
3. Swap the tsconfig/Vite path aliases from the SDK dir to the local compat dir — so **almost no application file changes**.
4. Reimplement `OAuthService` with desktop-native flows (Google loopback, GitHub device flow).
5. Replace the Glaze CLI build with `electron-vite` + `electron-builder`.

**Confirmed facts from source audit:**
- Only 5 `window.glazeAPI` surfaces are used: `glaze.ipc.invoke`, `glaze.ipc.onNotification`, `nativeTheme.getInfo`, `nativeTheme.setThemeSource`, `shell.openExternal`.
- `nativeTheme:*`, `shell:*`, `dialog:*` handlers do **not** exist in `main/` — Glaze's runtime provided them. Compat backend must implement `nativeTheme:getInfo`, `nativeTheme:setThemeSource`, `shell:openExternalWithResult`.
- Backend streaming/config use `ipcMain.broadcast(channel, payload)` (Glaze extension; `ai.ts`, `config.ts`). Not in Electron — must be shimmed.
- `createWebUtilsAPI` / `installDisplayMediaCompat` are exposed in preload but **unused** by the app → stub as no-ops.
- Component `.tsx` source (117 files) + `styles.css` + InterVariable fonts are available under the SDK `src/components/` and `fonts/` dirs — vendorable.
- `Select` (used in home-view) resolves to Glaze's **native** macOS-menu select (needs native IPC). `CustomSelect` is pure Radix → alias `CustomSelect` as `Select`.
- `Toaster`/`toast` wrap the `sonner` npm package (not currently a dependency → must add).
- OAuth token store is a Glaze file store; reuse the app's existing `safeStorage`+`secrets.json` pattern.

---

## Build-tool decision: electron-vite + electron-builder

**Chosen: `electron-vite` (dev/build) + `electron-builder` (packaging).** Justification:
- The app has **two renderer windows** (`main-window.html`, `settings-window.html`) = multi-entry renderer. `electron-vite` handles multi-entry renderers plus main and preload as three first-class Vite builds with one config; Electron Forge's Vite plugin has weaker multi-entry-renderer support.
- Preload must be a single classic/CJS bundle — `electron-vite` does this out of the box.
- `electron-builder` remains best-in-class for `.app`/`.dmg`, code signing and notarization.
- This satisfies the constraint "local vite.config + electron-builder": `electron.vite.config.ts` *is* the local Vite config.

**Phase-0 gate:** the app pins Vite 8 (bleeding edge). Before committing, verify `electron-vite` peer range accepts Vite 8 and that `@vitejs/plugin-react` + `babel-plugin-react-compiler` work under it. **Fallback if incompatible:** plain Vite for the renderer + two Vite lib-mode builds (main, preload) orchestrated by npm scripts, still packaged by electron-builder. Either way the build tooling, not the app code, absorbs the risk.

**Electron/Node note:** pin an explicit Electron version and treat `engines.node >=24` as the *toolchain* requirement. Electron's bundled Node (currently ~22) runs the main process — do **not** use Node-24-only APIs in `main/`.

---

## User inputs required (request at project start — these have human lead time)

| # | Input | Needed for | Notes |
|---|-------|-----------|-------|
| 1 | **Google OAuth client, type "Desktop app"** (client ID + secret) | Phase 3 Google/Gmail/Calendar/YouTube | Desktop-type clients permit any `http://127.0.0.1:<port>` redirect — usually no redirect registration needed. User enters these in Settings (already a UI field). |
| 2 | **GitHub OAuth App** (client ID) with **Device Flow enabled** | Phase 3 GitHub | Device flow needs only a client ID (no secret, no redirect). New config field + Settings input required (see 3.2/3.3). |
| 3 | **App bundle identifier / appId** (e.g. `com.brunorv.mycockpit`) | Phase 4 packaging | electron-builder `appId`. |
| 4 | **Apple Developer signing identity** (optional) | Phase 4 notarized dmg | Only if distributing outside personal use. Unsigned dev build works without it. |

---

## Phase 0 — Build system scaffolding

**Goal:** an empty Electron window loads the (unmodified-import) renderer; type-check passes with the alias swap wired but compat modules still stubbed.

Tasks (file-level):
- **`package.json`**: replace all `node glaze.ts *` scripts with `electron-vite dev` / `electron-vite build` / `electron-builder` / `tsc --noEmit` / eslint / format. Add deps: `electron`, `electron-vite`, `electron-builder`, `sonner`. Remove the `glaze` config block, the `id`/`sdkVersion` Glaze fields, and the `glaze.ts` esbuild/babel CLI-supplied assumptions. Add `main` entry pointing at built `out/main/index.js`.
- **`electron.vite.config.ts`** (new): three sections — `main` (entry `main/index.ts`), `preload` (entry `renderer/preload.ts`, CJS output), `renderer` with `rollupOptions.input` = `{ main: main-window.html, settings: settings-window.html }`, plugins `@vitejs/plugin-react` (+ react-compiler babel plugin), `@tailwindcss/vite`. Set `resolve.alias` for `@renderer`, `@main`, `@shared`, and **all `@glaze/core/*` → `src/glaze-compat/*`**. Add `optimizeDeps.include` for `react-grid-layout` CJS deps (`react-draggable`, `react-resizable`) if needed.
- **`tsconfig.json`** + **`main/tsconfig.json`**: repoint every `@glaze/core/*` path from the SDK dir to `./src/glaze-compat/*`. Remove Glaze `global.d.ts` includes; add a local `src/glaze-compat/global.d.ts` declaring `window.glazeAPI` (moved from SDK). Remove `glaze.ts`/`glaze.config.ts` from `include`.
- **`src/glaze-compat/*/index.ts`** (new, stub): create empty stub modules for `backend`, `preload`, `ipc`, `oauth`, `components`, `hooks`, `utils` so aliases resolve. Fill in later phases.
- **`main-window.html` / `settings-window.html`**: update the `<script src>` paths if electron-vite requires; leave CSP for Phase 4.
- Delete/ignore: `glaze.ts` (defer actual deletion to Phase 4 to keep git history clean until verified).

**Verification:** `npm run type-check` resolves all aliases (compat stubs may export `any`); `npm run dev` opens an Electron window (blank/erroring renderer is acceptable at this phase — the win is the window launches and Vite serves the renderer).

**Effort:** ~0.5 day (plus the Vite-8 gate check).

---

## Phase 1 — Compat: backend, preload, IPC bridge, host handlers

**Goal:** backend boots under Electron; `config:get` round-trips; theme toggle and external links work end-to-end.

### 1.1 `src/glaze-compat/backend/index.ts`
Re-export from `electron`: `app`, `Menu`, `safeStorage`. Provide:
- **`BrowserWindow`**: a subclass/factory wrapping Electron's `BrowserWindow` that accepts Glaze's extra opts. Strip `windowKey` (drop for MVP — no frame persistence; optionally restore later via `electron-window-state`). Pass through `vibrancy` (Electron supports `'sidebar'` natively on macOS) and `titleBarStyle` (set default `'hiddenInset'` for the drag region — see Phase 4). Keep `webPreferences.preload`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox` as appropriate.
- **`ipcMain`**: wrap Electron `ipcMain` and add **`broadcast(channel, ...args)`** → `BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, ...args))`. Preserve `handle`, `on`, `removeHandler`.
- **`logger`**: local logger with `.info/.debug/.warn/.error(scope, msg, meta?)` (console-backed).
- **`initDevToolsButtonState`**: no-op async.

### 1.2 `src/glaze-compat/preload/index.ts`
Re-export Electron `contextBridge`. Provide a **wrapped `ipcRenderer`** exposing the methods `renderer/preload.ts` uses: `invoke`, `send`, `on`, `once`, `removeListener`, plus Glaze extensions:
- `onNotification(channel, cb)` → `ipcRenderer.on(channel, (_e, payload) => cb(payload)); return unsubscribe`
- `isConnected()` → `true`; `waitForReady()` → `Promise.resolve()`; `disconnect()` → no-op.

Stub `createWebUtilsAPI()` → `{}` and `installDisplayMediaCompat()` → no-op (both unused; Electron ships its own `webUtils`).

`renderer/preload.ts` itself is **unchanged** (imports resolve via alias). Confirm the exposed `glazeAPI` object still type-checks against the wrapped surfaces.

### 1.3 `src/glaze-compat/ipc/index.ts`
Type-only module. Define/re-export the types the app imports: `NativeThemeInfo`, `OpenDialogOptions/Result`, `SaveDialogOptions/Result`, `MessageBoxOptions/Result`, `MediaAccessType`, `PermissionStatus`, `MenuItemConstructorOptions`, `PopupOptions/Result`, etc. Copy the minimal shapes from the SDK `ipc` d.ts (only what's referenced — `NativeThemeInfo` is the one actually used at runtime).

### 1.4 Host-provided IPC handlers (new — Glaze runtime gave these for free)
Add **`main/handlers/native.ts`** (new) registering:
- `nativeTheme:getInfo` → build `NativeThemeInfo` from Electron `nativeTheme` (`shouldUseDarkColors`, `themeSource`).
- `nativeTheme:setThemeSource` → set `nativeTheme.themeSource`.
- `shell:openExternalWithResult` → `shell.openExternal(url)` returning boolean.

Register it from `main/handlers/index.ts` (one added line). This is the highest-value catch: without it, theme switching and links silently break at runtime (invisible to type-check).

### 1.5 `main/windows/window-paths.ts`
Rewrite `getWindowUrl` / `getPreloadPath` for electron-vite: dev → `${process.env.ELECTRON_RENDERER_URL}/${htmlFileName}`; prod → built file under `out/renderer/`. Preload path → `out/preload/preload.js` (from `import.meta.url`/`__dirname`). Drop `.devserverhost` logic entirely.

**Verification:**
- `npm run type-check` clean.
- `npm run dev`: main window renders; DevTools console shows IPC connected; `config:get` returns defaults (RSS feeds populate).
- Manual: toggle theme in Settings → window redraws; click an external link → opens in browser.

**Effort:** ~1.5 days.

---

## Phase 2 — Vendor components, hooks, utils, styles, fonts

**Goal:** both windows fully render and are styled; type-check + lint clean.

### 2.1 Vendor components → `src/glaze-compat/components/`
Copy the required `.tsx` from the SDK `src/components/` and re-export from `components/index.ts`. Required set (from import audit):
`Toolbar, ToolbarContent, ToolbarTitle, ToolbarActions, ScrollArea, Button, Text, EmptyState, Separator, Select*, SelectTrigger, SelectValue, SelectContent, SelectItem, Avatar, AvatarImage, AvatarFallback, Badge, Input, Dialog, Label, RadioGroup, RadioGroupItem, Field, FieldGroup, FieldSet, TooltipProvider, Toaster, toast, SplitView, Status, ErrorBoundaryView`.

Copy transitive deps they import (`button-variants`, `text-variants`, `badge-variants`, `avatar-variants`, `cn`, `panel`, `panel-context`, `sidebar-context`, `split-view-context`, `split-view-column-context`, `progressive-blur`, `dialog-shortcuts`, `dialog-shortcut-hints`, `scroll-area`, `key`, `sonner`, `toast-state`, `apply-button-defaults`, `glaze-logo` or replace with app icon).

**Native-coupling fixes (required):**
- **Select**: do **not** copy the native `select.tsx` (needs native-menu IPC). Copy `custom-select.tsx` and re-export `CustomSelect*` **aliased as `Select*`** so home-view's imports resolve to the Radix version unchanged.
- **Tooltip** and **ScrollArea** import native hooks (`use-window-focus`, `use-preferred-scroller-style`, `native-view`). Replace those imports with local **web stubs**: `useOnWindowFocusStateChange` → uses DOM `focus`/`blur`; `usePreferredScrollerStyle` → returns `'overlay'`; drop `native-view`/`glazeTooltipTrace` usage (Radix Tooltip is purely DOM). Prefer editing the vendored copies to cut the native tail rather than porting native-view.
- **sonner.tsx / toast**: add `sonner` to dependencies; `useTheme` import → local hook (2.2).
- **ErrorBoundaryView**: replace `GlazeLogo` + `isBundledStoreApp` with a simple local fallback UI/app icon.

### 2.2 Vendor hooks → `src/glaze-compat/hooks/`
Provide `useTheme`, `useConnection`, `useEnvironment` (the three imported by `root-view.tsx`):
- `useTheme` → read/apply `glazeAPI.nativeTheme` + toggle `.dark` class; based on SDK `use-theme.tsx` but backed by the Phase-1 handlers.
- `useConnection` → return `{ connected: true, backendPort: null }` (or a real `waitForReady` probe).
- `useEnvironment` → return `{ type: 'app', url }` in prod, `'dev-server'` in dev. These only drive dev-only status badges, so a minimal implementation suffices.

### 2.3 Vendor utils → `src/glaze-compat/utils/`
`cn` (clsx + tailwind-merge — deps already present) and `initLogging` (console setup; can be near-no-op). Only these two are imported by the app.

### 2.4 Styles + fonts
- Copy the SDK component `styles.css` content into a vendored **`src/glaze-compat/components/styles.css`** (Radix color imports, `@custom-variant dark/tahoe/macos`, `@source inline(...)`, `@font-face InterVariable`).
- Copy InterVariable font files from the SDK `fonts/` dir into `renderer/assets/fonts/` (or `public/`); fix `@font-face` `url()` paths.
- Edit **`renderer/styles.css`**: add `@import "tailwindcss";` and `@import` the vendored component CSS at the top (Glaze injected these automatically; now the app must). Keep the existing `@source` directives and html/body sizing.

**Verification:**
- `npm run type-check` + `npm run lint` clean.
- `npm run dev`: main window shows the grid dashboard (news/YouTube/RSS widgets) fully styled with InterVariable; Settings window renders all fields, radio group, selects, toasts.
- Manual: open Settings from the App menu; trigger a `toast`; interact with a `Select`.

**Effort:** ~2–3 days (largest phase; component tail-trimming is the variable).

---

## Phase 3 — OAuth: standalone desktop flows

**Goal:** Google (Gmail/Calendar/YouTube) and GitHub connect without the glaze.app relay. This is the only phase with real logic (not shims) and the one required renderer edit.

### 3.1 `src/glaze-compat/oauth/index.ts` — reimplement `OAuthService`
Preserve the exact public interface the handlers depend on: constructor `{ providerId, clientId, clientSecret?, authorizeUrl, tokenUrl, scopes, extraAuthorizationParameters, ... }`, and methods `authorize()`, `getAccessToken()`, `getTokens()`, `setTokens()`, `removeTokens()`, static `github()`. Handlers stay unchanged.

- **Token store**: reimplement on the app's `safeStorage` + `secrets.json` pattern (key by `providerId`). Mirror `OAuthTokens` shape incl. `isExpired()`. `getAccessToken()` transparently **refreshes** Google tokens via `refresh_token`; throws/re-auths if none.
- **Google loopback flow** (installed-app): PKCE, start an ephemeral `http://127.0.0.1:<random-port>` HTTP server, `redirect_uri = http://127.0.0.1:<port>`, open the system browser via `shell.openExternal`, capture the `code` on the loopback callback, exchange at `tokenUrl` with `client_secret`. Close server after capture; timeout guard.
- **`OAuthService.github()`** → **device flow**: `POST https://github.com/login/device/code` (client ID + scope), show/open `verification_uri` + `user_code`, poll `https://github.com/login/oauth/access_token` until authorized. No secret, no loopback. Device-flow tokens don't refresh (fine for `read:user`).

### 3.2 `main/services/github-oauth.ts` + `config-service.ts`
- GitHub client ID is no longer Glaze-default. Add a `github_client_id` (or reuse `secrets.json`) field in **`config-service.ts`** (getter/setter/`hasGitHubClientId`, plus `hasGitHubClientId` in `getFullPayload`). Build `githubOAuth` lazily from the stored client ID (like `google-oauth.ts` does), not at module load.
- `main/services/google-oauth.ts` is largely unchanged (already builds from stored creds); confirm scopes and `access_type: offline` remain for refresh tokens.

### 3.3 `renderer/settings/settings-view.tsx` — the one sanctioned renderer edit
- Remove/replace `REDIRECT_URI = "https://www.glaze.app/api/oauth/callback"` (lines ~512, ~602). Google Desktop-type clients accept any `127.0.0.1` redirect, so replace the displayed relay URL with loopback guidance (or drop the field).
- Add a **GitHub client-ID input** wired to the new config handler.
- Keep the existing Google clientId/clientSecret inputs.

### 3.4 `main/handlers/google.ts`, `github.ts`, `youtube.ts`
No interface changes — they call `authorize/getTokens/getAccessToken/removeTokens`, all preserved. Verify only that `getGoogleOAuth()`/`githubOAuth` resolution still works with the new lazy construction.

**Verification:**
- Enter Google Desktop creds in Settings → "Connect Google" opens browser → consent → widgets show Gmail unread / Calendar events / YouTube.
- Enter GitHub client ID → device-flow code shown → authorize → GitHub widget shows profile.
- Restart app → tokens persist (decrypt from `secrets.json`); Google token auto-refreshes after expiry.

**Effort:** ~2 days.

---

## Phase 4 — Packaging, CSP, drag region, cleanup

**Goal:** signed-or-unsigned `.app`/`.dmg` that launches and behaves like the Glaze build.

- **`main-window.html` / `settings-window.html` CSP**: replace `glaze:`/`glaze-core:` schemes. Dev: allow `http://localhost:*` + `ws:` for Vite HMR. Prod: tighten to `'self'` + `https:` (for RSS/Gmail/Calendar/YouTube API + images) + `data:`/`blob:`. Keep `img-src https:` (news thumbnails).
- **Drag region**: WKWebView dragged natively; Electron does not. Add CSS `-webkit-app-region: drag` to `.drag-region` and `no-drag` to interactive children; set `titleBarStyle: 'hiddenInset'` in compat `BrowserWindow` defaults (Phase 1).
- **`renderer/main/index.tsx`**: the `installShims()` require-hack exists only because Glaze externalized React via importmap. Under normal Vite bundling React is bundled → simplify to a plain `import "./bootstrap"`. Verify `react-grid-layout`'s CJS deps resolve via `optimizeDeps` (test the grid drag/resize).
- **`electron-builder.yml`** (new): `appId`, `productName` "My Cockpit", `mac.target: dmg`, `icon: app-icon.icns`, `category`. Signing/notarization only if identity provided (input #4). Note `app-icon.*` is currently `.gitignore`d — un-ignore or reference by path.
- **Cleanup**: delete `glaze.ts`; remove the `glaze` block already dropped from `package.json`; remove SDK path aliases from both tsconfigs; delete dev-only harness references.

**Verification:**
- `npm run build && npm run dist` (electron-builder) produces `My Cockpit.app` / `.dmg`.
- Launch the packaged `.app`: both windows open, styled; window is draggable; grid widgets drag/resize; OAuth flows work from the packaged app; theme toggle works; external links open.

**Effort:** ~1.5 days.

---

## Key risks

1. **Vite 8 × electron-vite compatibility** (Phase 0 gate) — bleeding-edge Vite may outrun electron-vite's peer range. Mitigation: verify first; fallback to plain-Vite + lib-mode main/preload builds.
2. **Component native tail** — Tooltip/ScrollArea/Select pull native-view/native-menu/native hooks. Mitigation: trim the vendored copies to Radix-only + web stubs; use `CustomSelect`. Budget extra time here.
3. **`react-grid-layout` CJS under normal bundling** — its `require("react")` deps must resolve once React is bundled (not externalized). Mitigation: `optimizeDeps.include`; drop the `installShims` hack; test drag/resize explicitly.
4. **Google refresh-token semantics** — must persist `refresh_token` (needs `access_type=offline` + `prompt=consent`) and refresh on expiry, else Google widgets die after ~1h. Mitigation: covered in 3.1; verify by forcing expiry.
5. **CSP too strict in prod** — could block RSS/Gmail/Calendar images or API calls. Mitigation: keep `https:` in `img-src`/`connect-src`; test each widget in the packaged build.
6. **`safeStorage` availability** — on macOS `safeStorage.isEncryptionAvailable()` requires the app to be past `app.whenReady()`; unsigned dev builds still work but keychain prompts differ from Glaze. Mitigation: gate secret reads/writes on readiness; already async in `config-service`.

---

## Rough total effort

~7.5–9 engineering days across 5 phases, Phase 2 (component vendoring) the largest and most variable. Phases 0–2 are pure mechanical shim/vendor work; Phases 3–4 need sequential care (OAuth logic, packaging).

---

## Critical Files for Implementation

- `renderer/preload.ts` — defines the entire `window.glazeAPI` surface the compat preload/ipc must satisfy; unchanged but load-bearing.
- `main/services/google-oauth.ts` — the `OAuthService` construction shape the compat OAuth reimplementation must match exactly.
- `main/services/config-service.ts` — the `safeStorage`+`secrets.json` pattern to extend for token storage and the new GitHub client-ID field.
- `renderer/settings/settings-view.tsx` — the one renderer file requiring edits (REDIRECT_URI removal, GitHub client-ID input).
- `main/handlers/index.ts` — handler registration hub; where the new `native.ts` (nativeTheme/shell) host handlers get wired in.

Reference (read-only, for vendoring signatures; local machine only, not in repo):
`~/Library/Application Support/app.glaze.macos.main/sdk/current/@glaze/core/src/components/` (component `.tsx` + `styles.css`), `.../@glaze/core/oauth/index.d.ts` (OAuthService interface), `.../@glaze/core/fonts/` (InterVariable).
