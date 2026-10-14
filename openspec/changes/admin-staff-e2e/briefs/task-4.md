# Brief: admin-P2-L6 task 4, staff and product stock against core (the manager's e2e slot)

- LANE-ID: admin-P2-L6
- Area: `admin`
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P2-L6`
- Branch: `lane/admin-P2-L6-admin-staff-e2e`
- OpenSpec change: `admin-staff-e2e`, task 4 in `openspec/changes/admin-staff-e2e/tasks.md`
- Starts after: tasks 1 to 3 landed and reviewed; the manager holds the e2e slot (one `make e2e` at a time, announced in the area plan's `## Doing`).

This task has no new test: `apps/admin/e2e/staff.spec.ts` and the stretch in `apps/admin/e2e/catalog.spec.ts` were committed in task 1 before the code existed and run here for the first time against the real core and the demo seed. They cannot pass before task 3 (the catalog stretch looks for the image in the stock row). The team lead ran both only against a `page.route` fake on a scratch preview (each passed once, axe clean).

## Scenarios covered
- Staff users against core › Admin creates store staff who see their store only until deactivated (`e2e/staff.spec.ts` › "admin creates store staff, who see their store only until the admin deactivates them")
- Product and stock against core › Admin creates a product and sets its stock (`e2e/catalog.spec.ts` › "admin runs the catalog", from `./stock?store=` to the delete)

## Run (the area manager, not a worker)
`PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" make e2e` from the worktree root. Expected: admin **11 passed** (10 as on main, plus `staff.spec.ts`; 14 when admin-P2-L5's three are on the branch); web unchanged. Record the summary in the area plan and the lane log, then tick 4.1.

## If it fails: a fix worker
Scope paths: `apps/admin/e2e/staff.spec.ts` and `apps/admin/e2e/catalog.spec.ts` only, plus `openspec/changes/admin-staff-e2e/tasks.md` (the 4.1 tick) and `.claude/lanes/admin-P2-L6-T4.md`. The manager pastes the failing Playwright output into the worker's prompt.
1. Record the failing output in the lane log first.
2. Decide which side is wrong by reading `openspec/changes/admin-staff-e2e/specs/admin-app/spec.md` ("Staff users against core", "Product and stock against core") and design.md assumptions A6, A7, A10 and A11. If the page disagrees with the spec, or core or the seed disagrees with an assumption, stop and report: that is the team lead's call, not a spec-file fix.
3. A fix confined to the spec files (a selector, a wait) is committed as `fix: <what>`. Never weaken or delete an assertion, never add a fixed sleep.
4. Gates: `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" make test-web` exits 0. The worker never runs `make e2e`, Playwright or docker; the manager re-runs the e2e. Ticks are made with the Edit tool; no amended commits.

## Known hazards
- Sign-ins: core allows 10 per email and 100 per IP per hour per process. One admin run makes 5 as the admin (7 with admin-P2-L5), 3 as `koramangala@` (4 with L5), 1 as `nobody@`, 1 as `e2e-staff@`. A core already listening on :18080 is reused and runs out on the second run; restarting core is the manager's call.
- `staff.spec.ts` creates `e2e-staff@shopperstop.local` and leaves it inactive: core has no route that deletes a staff user. Global setup resets the seed before every Playwright run, which removes it. Running the spec twice against a database that was not reset gives 409 on the create ("A staff user with this email already exists." in the dialog, and the dialog stays).
- The new user signs in in a second browser context (`browser.newContext()`), not after the admin signs out: the admin must still be signed in to deactivate them. The last step expects the deactivated user's next page to be `/admin/sign-in?redirect=%2Fstock`: that is core's 401 on `GET /admin/me` (design.md A7) and the app's lost-session rule.
- The table is expected to hold exactly three "Edit" buttons before the create (the three seeded staff users). A fourth means the database was not reset.
- The dialog's submit button reads "Saving…" while the request runs; the spec presses it once and then waits for the dialog to be gone, so it never looks the button up by name during a save.
- The catalog stretch expects quantity 0 and "Low stock" for the new product at Koramangala, then 12 after the save and a reload. The image in the stock row has an empty `alt`, so it is found as `img` inside the row, not by role.
- `stock.spec.ts` runs in a parallel worker and matches `14[78] products` because the catalog test's product is alive for a while; it is alive a little longer now. Do not tighten it, and do not add a second e2e product anywhere.
- With admin-P2-L5 on the branch, `/` is the real dashboard: the helper `signIn` still waits for the heading "Dashboard".
