# mycockpit-mac

Your own cockpit for news, Youtube, RSS &amp; more

A macOS desktop dashboard app: news, YouTube, and RSS widgets arranged on a
draggable, resizable grid. Built with React 19, TypeScript, TanStack
Router/Query, Tailwind CSS v4, react-grid-layout, and Electron.

## Development

```
npm install
npm run dev          # start the app (Vite dev server + Electron, HMR)
npm run build         # production build (main, preload, renderer → out/)
npm run dist          # build + package a .app / .dmg (electron-builder → dist/)
npm run type-check    # TypeScript checks
npm run lint           # ESLint
```

`npm run dev` starts a Vite dev server for the renderer, builds the main
process and preload bundles once, and launches Electron pointed at the dev
server (Fast Refresh / HMR included).

## OAuth setup

Both integrations are optional — the app runs fine without them, the
GitHub/Gmail/Calendar/YouTube widgets just stay in their signed-out state.

### Google (Gmail, Calendar, YouTube)

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID of type **Desktop app**. Desktop-type clients
   accept any `http://127.0.0.1:<port>` redirect, so no redirect URI needs to
   be registered.
2. Enable the Gmail, Calendar, and YouTube Data APIs for the project.
3. In the app's Settings window, enter the client ID and client secret.
4. "Connect Google" opens your system browser for consent, then completes the
   flow via a short-lived local loopback server. Tokens (including the
   refresh token) are encrypted with `safeStorage` and persist across
   restarts.

### GitHub

1. Create a [GitHub OAuth App](https://github.com/settings/developers) with
   **Device Flow** enabled. Only a client ID is needed — no client secret, no
   redirect URI.
2. In the app's Settings window, enter the client ID.
3. "Connect GitHub" shows a device code (also copied to your clipboard) and
   opens github.com/login/device in your browser; paste the code there to
   authorize.

## Packaging

`npm run dist` produces an unsigned `My Cockpit.app` (under
`dist/mac-arm64/`) and a `.dmg` (under `dist/`). No Apple Developer signing
identity is configured, so the build is ad-hoc signed only (standard for a
locally-built Electron app on Apple Silicon — the OS applies this
automatically at build time, it's not a full Developer ID signature).
Gatekeeper will still flag it as being from an "unidentified developer" on
another machine. To open it there:

```
xattr -cr "/path/to/My Cockpit.app"   # strips the quarantine attribute, or
```

...or right-click the app in Finder and choose "Open" (bypasses Gatekeeper
for that one launch). Neither is needed when running the app on the machine
it was built on.

## Project structure

- `main/` — Electron main process: IPC handlers (`main/handlers/`), services
  such as OAuth and config (`main/services/`), and window management
  (`main/windows/`).
- `renderer/` — frontend: the main dashboard window (`renderer/main/`) and
  the settings window (`renderer/settings/`).
- `src/glaze-compat/` — standalone Electron implementations (backend, preload
  bridge, IPC types, OAuth, vendored UI components/hooks/utils) behind the
  same `@glaze/core/*` import paths the app code uses.
- `electron-builder.yml` — packaging config (`appId`, icon, dmg/dir targets).
- `vite.config.ts` + `scripts/dev.mjs` / `scripts/build.mjs` — plain-Vite
  build orchestration (main, preload, and renderer as three Vite targets in
  one shared config); see the comment at the top of `vite.config.ts` for why
  this replaces `electron-vite`.

### History

This app was originally built and run inside the [Glaze](https://www.glaze.app)
app platform, which provided window management, IPC, and OAuth relay APIs via
`@glaze/core/*`. It has since been ported to a standalone Electron app —
`src/glaze-compat/` reimplements those same APIs on real Electron/Node
primitives, so the application code (components, hooks, handlers) is
essentially unchanged from the Glaze-hosted version.

## Status

Standalone Electron port complete on the `electron-port` branch: backend,
preload/IPC bridge, vendored UI, desktop-native OAuth (Google loopback +
GitHub device flow), CSP, window chrome, and packaging (`npm run dist`) all
verified working end-to-end, including from a packaged, unsigned `.app`.
Not yet done: code signing / notarization (no Apple Developer identity
configured — see Packaging above) and end-to-end verification with real
Google/GitHub OAuth credentials in production use.
