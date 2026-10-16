## Why

Phase 4 builds the customer mobile app as an Expo workspace in `apps/mobile` (PLAN.md D36 to D40). Its web export runs in a browser on :5176 in development and :15176 under `make e2e`, and calls core (and, for the rider card, the rider service) cross-origin, so both must accept those two origins. Developers and agents also need to find the app: how to run it on a phone or in a browser, where it sits in the tree, and where its screens are designed (a design canvas, not the Figma file). D39 keeps the wiring minimal: the workspace's own npm scripts ride on `make test-web` and `make e2e` unchanged.

## What Changes

- `Makefile`: `http://localhost:5176` appended to the dev defaults of `SHOPPERSTOP_CORE_WEB_ORIGINS` and `SHOPPERSTOP_RIDER_WEB_ORIGINS`, `http://localhost:15176` appended to both values in `E2E_ENV` (orchestrator decision 2026-10-16 extends D39 to the rider service). Nothing else: no mobile target, no change to `make dev`, `make test-web` or `make e2e` (design.md Decision 2 shows why they already pick the workspace up).
- `README.md`: the Status section names Phase 4; a `## Mobile app` section (`cd apps/mobile && npx expo start --port 5176`, Expo Go, `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080` for a phone, the web export on :5176, "`apps/mobile` is not on `main` yet"); the `make e2e` row, the Design and "How it is built" paragraphs name the mobile app.
- `CLAUDE.md`: Phase 4 in the intro, an `apps/mobile/` layout line, a commands note (no make target, rides on `make test-web` and `make e2e`, how to run it), a one-sentence mobile stack pointer to D37, 15176 in the `make e2e` row and the CI line, the canvas in the UI conventions.
- `docs/figma.md`: the "Mobile" line links the design canvas "ShopperStop App Design" (19 artboards at 390×844, same token names and values as `tokens.css`) and says the Figma file has no `Mobile` page.
- `check-mobile-wiring.sh` in this change: the test for every scenario (grep and `make -n`, starts nothing).

Out of scope: `apps/mobile` itself (mobile area), `@shopperstop/ui/tokens` (ui area, ui-P4-L1), CI (`.github/workflows/ci.yml` unchanged), `.claude/commands/orchestrate.md` and `manage.md` (they already name the `mobile` area; the check confirms it), PLAN.md and the area plans.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: MODIFIED "make dev runs the rider service and app" (core's and the rider's dev origins include 5176; the Makefile has no mobile target), "make e2e gives the rider an isolated environment" (both services' e2e origins include 15176), "Repository documentation matches the tree" (README mobile section, CLAUDE.md mobile workspace, `docs/figma.md` canvas link).

## Impact

- Area: platform. Files: `Makefile`, `README.md`, `CLAUDE.md`, `docs/figma.md`, this change's folder.
- Cross-area contracts relied on: none new. The mobile area's npm scripts (`lint`, `typecheck`, `test`, `build`, `e2e`) must fit the root scripts `make test-web` and `make e2e` call; design.md Decision 2 lists the constraints, relayed as requests to mobile.
