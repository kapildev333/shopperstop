# Brief: admin-P2-L3 task 6, catalog against core (the manager's e2e slot)

- LANE-ID: admin-P2-L3
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L3`
- Branch: `lane/admin-P2-L3-admin-catalog`
- OpenSpec change: `admin-catalog`, task 6 in `openspec/changes/admin-catalog/tasks.md`
- Starts after: tasks 1 to 5b landed and reviewed (a run before 5b is evidence for tasks 1 to 5 only; 6.1 is ticked on a run of the tree that holds 5b, whose delete and upload changes the e2e walks through); the manager holds the e2e slot (one `make e2e` at a time, announced in the area plan's `## Doing`).

This task has no new test: `apps/admin/e2e/catalog.spec.ts` was committed in task 1 before the pages existed and runs here for the first time against the real core and the demo seed.

## Scenarios covered
- Catalog against core › Admin runs the catalog (`e2e/catalog.spec.ts` › "admin runs the catalog")
- Catalog against core › Store staff open the catalog pages (`e2e/catalog.spec.ts` › "store staff open the catalog pages")

## Run (the area manager, not a worker)
`PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" make e2e` from the worktree root. It exports `SHOPPERSTOP_CORE_FILES_DIR` with the other four variables, migrates and reseeds `shopperstop_core_e2e`, builds, and runs Playwright. Expected: admin **8 passed** (`auth`, `smoke`, `stores` 6 as on main, `catalog` 2), web unchanged; task 5b adds no e2e test. After 5b an upload shows the status "Uploading the image…" before "Image saved.", and `/products` shows its loading state after a delete instead of a kept table; the spec's selectors (`getByRole('status').filter({ hasText: 'Image saved.' })`, the search after the delete) are expected to hold. Record the summary in the area plan and the lane log, then tick 6.1.

## If it fails: a fix worker
Scope paths: `apps/admin/e2e/catalog.spec.ts` only, plus `openspec/changes/admin-catalog/tasks.md` (the 6.1 tick) and `.claude/lanes/admin-P2-L3-T6.md`. The manager pastes the failing Playwright output into the worker's prompt.
1. Record the failing output in the lane log first.
2. Decide which side is wrong by reading `openspec/changes/admin-catalog/specs/admin-app/spec.md` ("Catalog against core"). If the page disagrees with the spec, or the spec's numbers disagree with the seed ("Page 1 of 7, 148 products", sort order `10`, price `27.99`), stop and report: that is the team lead's call, not a spec-file fix.
3. A fix confined to the spec file (a selector, a wait) is committed as `fix: <what>`. Never weaken or delete an assertion, never add a fixed sleep.
4. Gates: `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" make test-web` exits 0. The worker never runs `make e2e`, Playwright or docker; the manager re-runs the e2e.

## Known hazards
- Core allows 10 sign-ins per email per hour per process; a reused core on :18080 runs out after a few full admin runs. Restarting core is the manager's call.
- The test restores what it changes (price saved back to `27.99`, the created product deleted). A run that dies midway can leave "E2E Curd Cup" or price `28`; the next `make e2e` reseeds.
- The uploaded PNG stays in `services/core/data/e2e-files` after the product is deleted (core keeps files); the directory is gitignored.
