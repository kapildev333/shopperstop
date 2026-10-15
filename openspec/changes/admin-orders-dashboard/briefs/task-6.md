# Brief: admin-P2-L5 task 6, orders, the dashboard and the ordered product against core (the manager's e2e slot)

- LANE-ID: admin-P2-L5. Area: `admin`. Worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L5`, branch `lane/admin-P2-L5-admin-orders-dashboard`.
- Who: the area manager, with the one e2e slot (announced in the area plan's `## Doing`). A worker is launched only to fix a recorded failure.
- Starts after: tasks 1 to 5 landed and reviewed, and the branch rebased onto main with admin-staff-e2e (admin-P2-L6, merged as #182).

## Rebase first (if not done before task 5)
Rebase onto `origin/main`. Only `apps/admin/e2e/catalog.spec.ts` is edited by both lanes, and the measured `git merge-file` over the merge base has 0 conflicts. **Keep both lanes' edits**: main's `koramangala` constant after `png` and its stock stretch inside "admin runs the catalog", and this lane's third test at the end of the file. If git stops on the file anyway, take main's version and append this lane's last 18 lines (the empty line, the two `// Banana Robusta …` comment lines and the test "an ordered product cannot be deleted and offers to be deactivated instead"). The file then holds three tests. After the rebase: `make test-web` exit 0 with admin 295 (ui 54, web 149 as measured on main at 09772d3; web moves with later web lanes) and `openspec validate --all --strict` passing.

## What
Run `make e2e` from the worktree root. Expected: admin **14 passed** (`auth` 2, `smoke` 2, `stores` 2, `catalog` 3, `stock` 2, `staff` 1, `orders` 2); web as on main. 13 would mean the branch is not rebased (no `staff.spec.ts`): rebase, do not report 13 as a pass. The three new tests were committed in task 1, before the pages:
- `e2e/orders.spec.ts` › "store staff take the placed order to delivered and find it in History"
- `e2e/orders.spec.ts` › "an admin sees the dashboard cards and opens a store's orders from one"
- `e2e/catalog.spec.ts` › "an ordered product cannot be deleted and offers to be deactivated instead"

## Know before running
- The first orders test moves the seeded order SS-DEMOAAAD (`…0703`) to delivered and cannot move it back. `e2e/global-setup.ts` reseeds before every run, which makes it repeatable; a second run without the setup (a hand-run `npx playwright test` against a reused core with `globalSetup` skipped) fails at the Placed column.
- The catalog test does not deactivate Banana Robusta (`…0601`): it checks the offer and presses "Cancel". admin-staff-e2e's stretch creates, stocks and deletes "E2E Curd Cup" inside the first catalog test; the two do not touch the same product.
- Sign-ins per admin run with both lanes: admin@ 7, koramangala@ 4, nobody@ 1, e2e-staff@ 1. Core's limit is 10 per email and 100 per IP per hour per core process; `make e2e` starts its own core, so one run is within it.
- The dashboard test asserts no count of today's orders (a run just after midnight IST would see SS-DEMOAAAD placed yesterday).
- Web's checkout specs may place orders at Koramangala in the same `make e2e`; the orders tests look only at SS-DEMOAAAB, SS-DEMOAAAC and SS-DEMOAAAD, and each suite reseeds first.
- In the spike the three tests passed twice each with axe clean on a scratch preview against a `page.route` fake of core; the real core is first met here.

## Then, in a real browser (the manager's own check)
Walk the board, a status change to delivered, the sheet's cancel, History with the pager and the dashboard at phone width and at desktop, as the area's recipe does; record what was seen with the e2e summary.

## If a test fails
Record the failure (test name, step, message) in the lane log first. A worker fixes it with `fix: <what>` inside `apps/admin/e2e/orders.spec.ts`, `apps/admin/e2e/catalog.spec.ts` or the page it shows to be wrong, never by weakening an assertion or removing an axe check. A design question stops the task and goes to the team lead.

## Done
Tick 6.1 in `openspec/changes/admin-orders-dashboard/tasks.md` (Edit tool), with the Playwright summary in the area plan and the lane log. Then the team lead runs `/opsx:verify admin-orders-dashboard`.
