# mycockpit-mac

Your own cockpit for news, Youtube, RSS &amp; more

A macOS desktop dashboard app: news, YouTube, and RSS widgets arranged on a
draggable, resizable grid. Built with React 19, TypeScript, TanStack
Router/Query, Tailwind CSS v4, and react-grid-layout.

## Requirements

This app currently builds and runs **only inside the [Glaze](https://www.glaze.app)
app platform**. All `@glaze/core/*` imports (backend APIs, IPC, window
management) and the build/dev CLI (`glaze.ts`) resolve from a Glaze SDK
installed locally on the machine (sdkVersion `0.9.0.0`). It is not yet a
standalone app — cloning this repo alone will not build or run it.

## Development

```
npm install
npm run dev          # start the app in Glaze's dev mode
npm run build        # production build
npm run type-check   # TypeScript checks
```

All scripts route through `glaze.ts`, a thin shim that resolves and invokes
the Glaze CLI from the locally installed SDK. They will fail without the
Glaze platform and SDK present.

## Project structure

- `main/` — backend process (Node.js, runs under Glaze's Electron-like
  runtime): IPC handlers (`main/handlers/`), services such as OAuth and
  config (`main/services/`), and window management (`main/windows/`).
- `renderer/` — frontend: the main dashboard window (`renderer/main/`) and
  the settings window (`renderer/settings/`).
- `glaze.ts` — CLI shim that locates and runs the Glaze SDK's CLI.

## Status

Source snapshot of the Glaze-hosted app. A port to a standalone Electron app
(without the Glaze platform dependency) is planned but not started.
