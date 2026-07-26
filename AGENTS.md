# Amarelinho — agent guide (desktop + Cursor mobile)

3D browser bar game (Three.js). Production: https://jhonatanribeiro.com/amarelinho/

## Cloud / phone workflow (same as snow)

When working as a **Cloud Agent** (Cursor mobile or cloud):

1. Work on a `cursor/*` branch and open a PR toward **`develop`**.
2. Do **not** ask the user to merge manually — GitHub Action **Auto-merge Cursor PRs** squash-merges `cursor/*` into `develop` after CI and dispatches HostGator + Pages deploys.
3. After finishing a feature the user wanted live, ensure the PR is opened (not only a local commit). Prefer a ready-for-review PR.
4. Bump cache/`AMA_BUILD` in `scripts/build.mjs` + `index.html` when shipping visible changes (`v22`, `v23`, …).
5. Run `npm run build` before finishing so CI and FTP artifacts stay in sync.

## Deploy facts

| Trigger | Result |
| --- | --- |
| Push / merge to `develop` | CI + FTP HostGator + Pages |
| PR from `cursor/*` | Auto-merge → then dispatch deploys |
| Manual | Actions → **Deploy HostGator** |

Docs: [`docs/MOBILE-AUTO-PROD.md`](docs/MOBILE-AUTO-PROD.md), [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Stack pointers

- Entry: `src/js/main.js`, shell: `index.html`
- World/NPCs: `src/js/world.js`, `barZones.js`, `npcs.js`, `npcAi.js`
- Economy/missions: `menu.js`, `progress.js`, `achievements.js`
- Build: `npm run build` → `dist/` + `release/hostgator-amarelinho/`
- Local: `npm run start:win` → http://127.0.0.1:5174/

## Conventions

- Portuguese UI copy by default; settings may switch EN labels.
- Prefer small, shippable changes; keep touch controls working.
- Never commit FTP passwords or `.env` secrets.

## Cursor Cloud specific instructions

- Static Three.js game — no backend/DB/API. Run end-to-end with just Node + `npm install` + the dev static server.
- On Linux use `npm run dev` (alias of `npm run start`, `serve` on http://127.0.0.1:5174/). `npm run start:win` is Windows/PowerShell only — do not use it here.
- Dev mode has no bundling: `index.html` uses an importmap pointing at `/node_modules/three`, so `npm install` must have run and the server must serve from the repo root. Preview the built bundle with `npm run preview` (:5184).
- No test or lint scripts exist. CI (`.github/workflows/ci.yml`) only runs `npm run build` and smoke-checks that `release/hostgator-amarelinho/{index.html,game.js,styles/styles.css}` exist and `index.html` contains `AMA_BUILD`. Validate changes by building and by playing at :5174.
- Gameplay: the browser opens a start screen ("ENTRAR NO BAR"); click it to enter the 3D bar. WASD moves, mouse look uses pointer lock (needs relative movement/drag), E interacts.
