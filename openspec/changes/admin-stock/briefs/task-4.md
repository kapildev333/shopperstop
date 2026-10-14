# Brief: admin-P2-L4 task 4, stock against core (the manager's e2e slot)

- LANE-ID: admin-P2-L4
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L4`
- Branch: `lane/admin-P2-L4-admin-stock`
- OpenSpec change: `admin-stock`, task 4 in `openspec/changes/admin-stock/tasks.md`
- Starts after: tasks 1 to 3 landed and reviewed; the manager holds the e2e slot (one `make e2e` at a time, announced in the area plan's `## Doing`).

This task has no new test: `apps/admin/e2e/stock.spec.ts` was committed in task 1 before the page existed and got one more line in task 3, and runs here for the first time against the real core and the demo seed. It cannot pass before task 3 has landed. The team lead ran it only against a `page.route` fake (6 of 6 over three repeats, axe clean).

## Scenarios covered
- Stock against core › Admin sets stock at a store (`e2e/stock.spec.ts` › "admin sets stock at a store")
- Stock against core › Store staff set stock at their own store only (`e2e/stock.spec.ts` › "store staff set stock at their own store only")

## Run (the area manager, not a worker)
`PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" make e2e` from the worktree root. Expected: admin **10 passed** (`auth`, `smoke`, `stores`, `catalog` 8 as on main, `stock` 2); web unchanged. Record the summary in the area plan and the lane log, then tick 4.1.

## If it fails: a fix worker
Scope paths: `apps/admin/e2e/stock.spec.ts` only, plus `openspec/changes/admin-stock/tasks.md` (the 4.1 tick) and `.claude/lanes/admin-P2-L4-T4.md`. The manager pastes the failing Playwright output into the worker's prompt.
1. Record the failing output in the lane log first.
2. Decide which side is wrong by reading `openspec/changes/admin-stock/specs/admin-app/spec.md` ("Stock against core") and design.md assumption A11. If the page disagrees with the spec, or the seed disagrees with A11 (Indiranagar listed first, 147 products on 7 pages, a product named "Sunny Fields Toned Milk", at least one low row at Koramangala, the public `GET /stores/{id}` answering a request that carries the staff token), stop and report: that is the team lead's call, not a spec-file fix.
3. A fix confined to the spec file (a selector, a wait) is committed as `fix: <what>`. Never weaken or delete an assertion, never add a fixed sleep.
4. Gates: `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" make test-web` exits 0. The worker never runs `make e2e`, Playwright or docker; the manager re-runs the e2e. Ticks are made with the Edit tool.

## Known hazards
- Core allows 10 sign-ins per email per hour per process; a reused core on :18080 runs out after a few full admin runs. Restarting core is the manager's call.
- The test raises Koramangala's Sunny Fields Toned Milk by one and saves the old quantity back. A run that dies in between leaves it one higher; the next `make e2e` reseeds.
- The low-stock step counts the rows on the page and expects one "Low stock" badge per row. It needs core's filter and the page's threshold to agree (below 5); a mismatch there is a real finding, not a selector problem.
- The store-staff step waits for the stock request after `goto`; it matches only `/admin/stores/<id>/stock`, not the page's own URL.
- The product count is matched as `14[78]` on purpose: Playwright runs the spec files in parallel workers and the catalog spec holds one more active product for a moment. Do not tighten it to 147.
- "Store: Koramangala" comes from the public `GET /api/core/v1/stores/{id}`. If it is missing while the table is there, look at that request first (status, and whether the session survived it): design.md assumption A13.
- While a save runs the button reads "Saving…", not "Save changes"; the spec presses it once and then waits for the status "Stock saved.", so it does not look the button up by name during a save. The unsaved-count line is a `role="status"` region too: the spec filters statuses by text ("Stock saved.").
