# Brief: admin-P2-L5 task 6, orders, the dashboard and the ordered product against core (the manager's e2e slot)

- LANE-ID: admin-P2-L5. Area: `admin`. Worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5`, branch `lane/admin-P2-L5-admin-orders-dashboard`.
- Who: the area manager, with the one e2e slot (announced in the area plan's `## Doing`). A worker is launched only to fix a recorded failure.
- Starts after: tasks 1 to 5 landed and reviewed.

## What
Run `make e2e` from the worktree root. Expected: admin **base + 3 passed** (13 if nothing else landed since admin-stock: `auth` 2, `smoke` 2, `stores` 2, `catalog` 3, `stock` 2, `orders` 2); web unchanged. The three new tests were committed in task 1, before the pages:
- `e2e/orders.spec.ts` › "store staff take the placed order to delivered and find it in History"
- `e2e/orders.spec.ts` › "an admin sees the dashboard cards and opens a store's orders from one"
- `e2e/catalog.spec.ts` › "an ordered product cannot be deleted and offers to be deactivated instead"

## Know before running
- The first orders test moves the seeded order SS-DEMOAAAD (`…0703`) to delivered and cannot move it back. `e2e/global-setup.ts` reseeds before every run, which makes it repeatable; a second run without the setup (a hand-run `npx playwright test` against a reused core with `globalSetup` skipped) fails at the Placed column.
- The catalog test does not deactivate Banana Robusta (`…0601`): it checks the offer and presses "Cancel".
- The dashboard test asserts no count of today's orders (a run just after midnight IST would see SS-DEMOAAAD placed yesterday).
- Web's checkout specs may place orders at Koramangala in the same `make e2e`; the orders tests look only at SS-DEMOAAAB, SS-DEMOAAAC and SS-DEMOAAAD, and each suite reseeds first.
- In the spike the three tests passed twice each with axe clean on a scratch preview against a `page.route` fake of core; the real core is first met here.

## If a test fails
Record the failure (test name, step, message) in the lane log first. A worker fixes it with `fix: <what>` inside `apps/admin/e2e/orders.spec.ts`, `apps/admin/e2e/catalog.spec.ts` or the page it shows to be wrong, never by weakening an assertion or removing an axe check. A design question stops the task and goes to the team lead.

## Done
Tick 6.1 in `openspec/changes/admin-orders-dashboard/tasks.md` (Edit tool), with the Playwright summary in the area plan and the lane log. Then the team lead runs `/opsx:verify admin-orders-dashboard`.
