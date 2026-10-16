## Context

PLAN.md D36 to D40 make the customer mobile app Phase 4: an Expo workspace `apps/mobile` (mobile area) whose web export runs on :5176 in development and is served on :15176 for Playwright under `make e2e`, and which calls core at `EXPO_PUBLIC_CORE_URL` (default `http://localhost:8080`). D39 limits platform's part to core's two origins, three docs and the canvas link. `.claude/commands/orchestrate.md` and `manage.md` already name the `mobile` area and its scope (read on 8dc76d1); `CLAUDE.md` already lists the area; neither needs an edit. Files touched, all platform: `Makefile`, `README.md`, `CLAUDE.md`, `docs/figma.md`, this folder.

## Goals / Non-Goals

Goals: core accepts the web export's dev and e2e origins; README, CLAUDE.md and `docs/figma.md` tell a reader how to run the app, where it lives and where its screens are designed; one script tests all of it.

Non-goals: a `make mobile` target or `make dev` running Expo; CI changes; the rider service's origins; anything in `apps/mobile` or `packages/ui`.

## Decisions

### 1. Core's origins only; the rider's stay three (escalated)

D39 names core's `WEB_ORIGINS` only, so `SHOPPERSTOP_RIDER_WEB_ORIGINS` (dev and e2e) is unchanged and the delta says so. Ceiling: mobile-P4-L4's optional rider card reads `GET /api/rider/v1/orders/{orderId}/delivery` straight from the app; native requests carry no `Origin` and work, but the web export on :5176 and :15176 is cross-origin to the rider service and the browser blocks it. Upgrade: append the same two origins to the rider's dev default and e2e value (two strings, a follow-up change or an amendment to this one before the worker starts). Escalated to the orchestrator.

### 2. No mobile make target: the workspace rides on today's targets

Read on 8dc76d1: `make test-web` runs the root scripts `npm run lint`, `npm run typecheck`, `npm run test` (`npm run test --workspaces --if-present -- --run`) and `npm run build --workspaces --if-present`; `make e2e` (guard: `services/core` and `apps/web` or `apps/admin`) migrates and seeds, runs `npm run build --workspaces --if-present` without `E2E_ENV`, then `$(E2E_ENV) npm run e2e --workspaces --if-present`. The root `workspaces` glob `apps/*` includes `apps/mobile`, so its scripts run with no Makefile or CI change (the CI `web` job is `npm ci` plus `make test-web`; the `e2e` job is `npm ci`, `npx playwright install --with-deps chromium`, `make e2e`). That holds only if the mobile workspace meets four constraints, relayed as requests to mobile:

- `test` receives a trailing `--run`. Jest rejects it (checked: `npx jest@29 --run` exits 1 with `Unrecognized option "run"`); `"test": "sh -c 'jest --ci' --"` swallows it (exits 0). Never `jest --ci --`, which turns `--run` into a test-path pattern and can run nothing.
- `build` runs without the e2e environment, so an `expo export --platform web` in `build` inlines the default `EXPO_PUBLIC_CORE_URL`. The `e2e` script (or its Playwright `webServer`) must export again with `EXPO_PUBLIC_CORE_URL=http://localhost:18080` before serving `dist` on 15176, and start core from the inherited `E2E_ENV` like `apps/web`.
- `@playwright/test` at the same version as `apps/web`, so the root `npx playwright install chromium` in CI covers it.
- Expo's bundler defaults to port 8081, the rider service's port: the app's `dev` script and the docs use `--port 5176`, which also puts the dev web export on 5176.

Ceiling: `make dev` does not start Expo (one more terminal); add a `mobile` target if the owner wants one.

### 3. MODIFIED requirements keep their rider names

The origin scenarios live in "make dev runs the rider service and app" and "make e2e gives the rider an isolated environment" (from platform-rider-wiring); a MODIFIED block must restate the whole requirement with every scenario. Each gains one mobile scenario and the e2e token scenario's "both services' web origins" splits into core's four and the rider's three. Renaming the requirements is churn for no behaviour. There is no Figma requirement in `platform`; the canvas link joins "Repository documentation matches the tree" as one scenario.

### 4. The Figma file gets no Mobile page

The brief and D36 say the Figma `Mobile` page stays empty; the file has no such page (three pages, Starter plan, D17). `docs/figma.md` says the file has no `Mobile` page and the canvas is the mobile design source.

### 5. Exact port flags in the docs

The docs say `npx expo start --port 5176` rather than the bare `npx expo start` of the brief, because of the 8081 clash in Decision 2. `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080` is the phone case; core binds `:8080` on every interface already.

### 6. The test is a committed check script

Like platform-rider-wiring, the scenarios are text and `make -n` output with no framework: `check-mobile-wiring.sh` (sections `make`, `docs`) greps the files and dry-run output and runs the two archived checks (`check-docs.sh`; `check-wiring.sh` `docs`, and its `make` section with its two assertions on core's old three-origin lists filtered out, because this change supersedes exactly those). On 8dc76d1 it prints 22 FAIL lines; on a scratch copy with the edits below it prints `mobile wiring check: ok`, and `check-docs.sh` and `check-wiring.sh deploy ci docs` stay ok. The worker's red step is that failing run, the commit is `feat:`.

## The edits

Replace each "old" with its "new" exactly; each old text occurs once in its file.

### Makefile (two values)

1. old: `SHOPPERSTOP_CORE_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175`
   new: `SHOPPERSTOP_CORE_WEB_ORIGINS ?= http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176`
2. In the `E2E_ENV` line, old: `SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175'`
   new: `SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'`
   (the `SHOPPERSTOP_RIDER_WEB_ORIGINS` value in the same line stays as is)

### README.md (five places)

1. After the Status paragraph ending `` `core-admin seed-demo --reset` loads the demo data and prints the demo sign-ins. `` add a blank line and:

```
Phase 4 (the customer mobile app, `apps/mobile`, built with Expo) runs alongside Phase 3's tail; see [Mobile app](#mobile-app).
```

2. Immediately before `## Commands`, insert this section followed by a blank line:

````
## Mobile app

The customer mobile app is an Expo (React Native) app in `apps/mobile`, from Phase 4; `apps/mobile` is not on `main` yet. It uses the same core service as the customer web, so start the stack with `make dev` first, then in another terminal:

```sh
cd apps/mobile && npx expo start --port 5176
```

- On a phone: install Expo Go, join the same Wi-Fi as the computer and scan the QR code. A phone cannot reach `localhost`, so point the app at the computer's LAN address: `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080 npx expo start --port 5176` (on macOS, `ipconfig getifaddr en0` prints `<lan-ip>`). Core listens on every interface on :8080; allow it through the firewall if asked.
- In a browser: press `w`, or run `npx expo start --web --port 5176`, to open the web export on <http://localhost:5176>; core accepts that origin under `make dev`.

`--port 5176` keeps Expo's bundler off its default port 8081, which the rider service uses. The app has no make target of its own: `make test-web` and `make e2e` run its workspace scripts like the other apps' (its e2e preview is on :15176).
````

3. In the `make e2e` row of the Commands table, old: `rider preview on :15175 (under /rider/). |`
   new: ``rider preview on :15175 (under /rider/), mobile web export preview on :15176 once `apps/mobile` lands. |``
4. In `## Design`, old: `The Figma file, with its three pages, is linked from [docs/figma.md](docs/figma.md).`
   new: `The Figma file, with its three pages, is linked from [docs/figma.md](docs/figma.md), and so is the design canvas with the mobile app's screens.`
5. In `## How it is built`, old: ``(`platform`, `core`, `ui`, `web`, `admin`, and `rider` from Phase 3)``
   new: ``(`platform`, `core`, `ui`, `web`, `admin`, `rider` from Phase 3 and `mobile` from Phase 4)``

### CLAUDE.md (seven places)

1. old: `Phase 3 adds the rider service and app (D29).`
   new: `Phase 3 adds the rider service and app (D29); Phase 4 adds the customer mobile app (D36), alongside Phase 3's tail.`
2. In the `make e2e` row, old: `rider preview 15175 (under /rider/), fixed env |`
   new: ``rider preview 15175 (under /rider/), mobile web export preview 15176 once `apps/mobile` lands, fixed env |``
3. At the end of the paragraph ending `` are the pieces `dev` composes. `` append (same paragraph, one space):
   ``The mobile app (`apps/mobile`, Phase 4, D39) has no make target: its workspace rides on `make test-web` and `make e2e` through its `lint`, `typecheck`, `test`, `build` and `e2e` scripts, and runs with `cd apps/mobile && npx expo start --port 5176` (Expo Go on a phone with `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`; the web export on :5176, which core's dev origins accept).``
4. In the layout block, after the `apps/rider/` line, add (the path padded with spaces to column 21 like its neighbours):
   `apps/mobile/        Phase 4: the customer mobile app, Expo + React Native + TypeScript, web export on 5176 (D36, D37)`
5. At the end of the Stack paragraph ending `` is allowed (D10). `` append:
   ``Mobile (`apps/mobile`): Expo, React Native, Expo Router, TanStack Query, `openapi-fetch`, `StyleSheet` with values from `@shopperstop/ui/tokens`, `jest-expo` + React Native Testing Library, Playwright + axe on the web export; the full list is D37.``
6. In the `ci.yml` jobs bullet, old: `rider preview 15175 (under /rider/), D15)`
   new: ``rider preview 15175 (under /rider/), mobile web export preview 15176 once `apps/mobile` lands, D15)``
7. In the UI conventions paragraph, old: ``diffs a variables export against `tokens.css`, by hand.``
   new: ``diffs a variables export against `tokens.css`, by hand. The mobile screens are in the design canvas linked from `docs/figma.md` (D36).``

### docs/figma.md (one line)

old: `Mobile: no reserved page (page limit); add it when the mobile app spec lands.`
new: ``Mobile: the customer mobile app's screens (Phase 4, D36) live in the design canvas **ShopperStop App Design**, https://claude.ai/artifact/75BFgGxUe3viRFjgvn8Ywy: 19 artboards at 390×844, with the same token names and values as `packages/ui/src/tokens.css`. The canvas is the mobile design source; the Figma file has no `Mobile` page (Starter page limit, D17) and gets none in Phase 4.``

## Risks / Trade-offs

- README says "`apps/mobile` is not on `main` yet" and the e2e rows say "once `apps/mobile` lands": stale once mobile-P4-L1 merges. The platform lane at Phase 4 close (or the orchestrator's close chore) drops them; the scenario only demands the phrase while `apps/mobile` is absent.
- The archived `check-wiring.sh make` section now fails on two lines by design; `check-mobile-wiring.sh` filters exactly those, so any other regression there still fails.
- `platform-ci-makefile` is still an open change on main although its requirements shipped in Phase 1 (archive order was set in platform-P3-L1's log); it does not touch the requirements modified here, and `openspec validate --all --strict` passes with both open.
