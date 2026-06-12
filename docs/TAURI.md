# Materio Tauri (desktop & mobile)

Cross-platform shell around the **same static Jekyll site** (`_site/`). UI and data JSON are bundled locally; **`/api/v2/*` stays on Vercel** at `https://getmaterio.app`.

## Architecture

```text
npm run tauri:build-frontend  →  JEKYLL_ENV=tauri  →  _site/
                                              ↓
                                    Tauri packages _site
                                              ↓
                         fetch('/api/v2/...') → https://getmaterio.app/api/v2/...
```

- `_config.tauri.yml` — disables service worker, sets `api_origin`
- `assets/scripts/tauri-bridge.js` — rewrites `/api/*` to production
- `api/_config_shared/cors-origins.js` — allows Tauri WebView origins on serverless APIs

## Prerequisites

| Tool | Notes |
|------|--------|
| [Rust](https://rustup.rs/) | Required for `tauri build` / `tauri dev` |
| Node.js | Same as web repo |
| Ruby + Bundler | `bundle exec jekyll build` |
| Windows | [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually preinstalled) |
| macOS | Xcode CLI tools for iOS later |
| Linux | `webkit2gtk` dev packages per [Tauri docs](https://v2.tauri.app/start/prerequisites/) |

## Commands

```bash
npm install

# Build static frontend only (output: _site/)
npm run tauri:build-frontend

# Desktop dev (starts Jekyll on :4000 + Tauri window)
npm run tauri:dev

# Release installer (.msi, .dmg, .deb, etc.)
npm run tauri:build
```

## Mobile (later)

From repo root after desktop works:

```bash
npx tauri android init
npx tauri ios init
npx tauri android dev
npx tauri ios dev
```

## Deploying API CORS changes

Tauri origins (`https://tauri.localhost`, `tauri://localhost`, etc.) are in `api/_config_shared/cors-origins.js`. **Deploy to Vercel** after pulling these changes or the app will get CORS errors on login/health checks.

## What is bundled vs remote

| Bundled | Remote (Vercel) |
|---------|-----------------|
| HTML, CSS, JS, `oread/`, `assets/data/*.json` | `/api/v2/*` |
| Account static pages | Auth, chat, search, features |
| Offline PDFs (IndexedDB) | CDN PDFs when online |

## Troubleshooting

- **Blank window in dev** — wait for Jekyll on port 4000, or run `npm run tauri:build-frontend` and point `devUrl` at a static server of `_site`.
- **API 401 / CORS** — confirm Vercel deployment includes updated `cors-origins.js`; check DevTools network tab for `Origin: https://tauri.localhost`.
- **Service worker conflicts** — Tauri builds set `disable_service_worker: true` via `_config.tauri.yml`.
