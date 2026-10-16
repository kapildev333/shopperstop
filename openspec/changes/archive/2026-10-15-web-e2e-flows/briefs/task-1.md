# Brief: web-e2e-flows task 1 (worker)

- LANE-ID: web-P2-L5-T1 (worker log `.claude/lanes/web-P2-L5-T1.md`, format in `.claude/lanes/README.md`); team lead web-P2-L5
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P2-L5`, branch `lane/web-P2-L5-e2e-flows`. Commit there; never push.
- Change: `openspec/changes/web-e2e-flows/`, task 1 "Cross-app flows". Read `proposal.md`, `specs/web-app/spec.md`, `design.md`, `tasks.md` first. Read `apps/web/e2e/shopper.ts`, `apps/web/e2e/checkout.spec.ts` and `apps/admin/e2e/orders.spec.ts`, `catalog.spec.ts` (read only) for the locators design.md copies.
- Scope paths (edit nothing else):
  - `apps/web/e2e/flows.spec.ts` (new), `apps/web/playwright.config.ts`
  - `openspec/changes/web-e2e-flows/tasks.md` (checkboxes only)
  - `.claude/lanes/web-P2-L5-T1.md`
  - Not `apps/web/e2e/shopper.ts`, not any other spec, not `apps/admin/`, `services/core/`, `packages/ui/`, the Makefile or CI: if any seems to need a change, stop and report.
- Scenarios: web-app › "Customer site end-to-end suite with axe" › Admin preview served for the cross-app flows; "Customer cross-app end-to-end flows" › Customer order taken to delivered by store staff, Admin product found by customer search.
- You cannot run Playwright. Do not try `npm run e2e` or `make e2e`; the manager runs them.

## Commit 1: `test: cross-app flows`

New `apps/web/e2e/flows.spec.ts`, exactly design.md Decision 2: the imports, `adminOrigin`, `staffSignIn` as written, then test "customer order to delivered across both apps" (steps 1 to 15) and test "admin product found by customer search" (steps 1 to 4), in that order. One short comment above each test naming its Spec 2 §13 flow; one comment at `orderPick(request, 7)` / `(request, 8)` saying 0 to 6 are checkout's and orders' and 9 was the manager's walk; one at the product name saying why "Zzz" and stock 5 (design.md Decision 3).

Rules: every `getByRole` name that could match a longer name uses `exact: true` (as the design steps say); nothing from the Node side inside a browser callback (`addInitScript` takes a literal); no `page.reload()` after step 10 of Flow 1; no `waitForTimeout`; no retries, no `test.describe.configure`.

Red on this commit, without Playwright:
- `npm run lint --workspace apps/web` and `npm run typecheck --workspace apps/web` green
- `grep -c 15174 apps/web/playwright.config.ts` prints `0`

Write both results in the commit body and in your lane log, with the line "Playwright red is the manager's: both new tests fail at http://localhost:15174/admin/sign-in".

## Commit 2: `feat: serve the admin preview in the web suite`

Exactly design.md Decision 1: the one `webServer` entry with its comment, appended after the web preview entry in `apps/web/playwright.config.ts`. Nothing else in the file changes.

Gates (tasks.md list) green; `grep -c 15174 apps/web/playwright.config.ts` prints `1`.

## Do not add

- a helper file, or new exports in `shopper.ts`
- API shortcuts in the flows (no `request.post` for register, cart, address, order or status; the only `request` calls are `orderPick` and the store read for `minOrderCents`)
- product deletion at the end of Flow 2, a phone viewport, a build step in the config

Tick 1.1 and 1.2 in `tasks.md` as each commit lands. Stop and report on any open design choice (for example a locator in design.md that does not exist in the page source you read).
