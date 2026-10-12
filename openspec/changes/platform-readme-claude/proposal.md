## Why

Spec 1 §7 asks for a `README.md` with a one-command quick start, a step-by-step fold, the demo sign-ins of Spec 2 §11 and a screenshots table; §12 asks for a `CLAUDE.md` that describes layout, conventions, orchestration and UI rules in the shape of UniCourse's. There is no `README.md` yet, and `CLAUDE.md` predates the Makefile and PLAN.md D3, D9 to D17: it says "no product code yet", has no commands, names `sqlc diff` and the `_test` database for CI, and points at a five-page Figma file. Plan Task 15 (lane platform-P1-L11); `docs/figma.md` already landed in #25.

## What Changes

- New `README.md`: what ShopperStop is, current state of the tree, prerequisites, quick start (`npm ci` once, then `make dev`), a `<details>` fold with the same steps without make, the demo sign-ins, the make targets, testing, API contract, design links, a screenshots table with pending cells, and how the repository is built (areas, OpenSpec, lanes) pointing at `CLAUDE.md`.
- Edit `CLAUDE.md`: a `## Commands` section with every developer make target; the opening paragraph, layout block, stack, orchestration, CI line and Figma reference brought in line with the tree and PLAN.md D3, D9 to D17.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: ADDED requirement "Repository documentation matches the tree". No existing requirement changes.

## Impact

- Area: platform. Files: `README.md` (new), `CLAUDE.md`. Nothing else.
- Cross-area contracts described, not changed: the `Makefile` targets and `.github/workflows/ci.yml` (platform), `services/core` commands and ports, `packages/ui` scripts, the planned `apps/web` and `apps/admin` dev ports 5173 and 5174, `seed-demo --reset` (a Phase 1 stub per D15; the demo accounts arrive with the Phase 2 seed).
- Out of scope: screenshots themselves (first phase with screens), `docs/postman/` and `scripts/postman.mjs` (lane platform-P1-L8, parallel), Spec 1 (frozen, D6), PLAN.md, any Makefile change (a fresh-clone `npm ci` inside `make dev` is a backlog request, see design.md).
