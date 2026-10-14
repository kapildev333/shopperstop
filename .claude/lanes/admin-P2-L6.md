# admin-P2-L6 - Staff page, stock image column, Spec 2 §13 admin e2e (OpenSpec change admin-staff-e2e)
Status: started
## Doing
2026-10-13: team lead. `openspec/changes/admin-staff-e2e/` written and committed (proposal, delta to `admin-app`, design, tasks, four briefs); spiked, measured and reverted, the tree holds only documents. Waiting for the manager: rebase onto main (task 0), then workers for tasks 1 to 3, then the e2e slot (task 4).
## Found
- Base: the branch is at 04e68ca (admin suite 160). admin-P2-L7 merged meanwhile (#163; suite 180). The branch must be rebased onto main before task 1: one test asserts L7's root notice. Counts are "base + n": +8 (task 1), +31 (task 2), +32 (task 3). Measured: 192 on 04e68ca without the three notice lines, 212 on main's `apps/admin/src` with them; `make test-web` exit 0 on 04e68ca (ui 54, admin 192, web 101).
- Core, read in the handlers: there is no `GET /admin/staff-users/{id}` and no delete; `PATCH` changes only `name`, `password`, `isActive`; core does not refuse an admin who deactivates themself or the last active admin (200, then 401 on their next request). The panel does not offer "Status" on the own row, which keeps the admin at the screen active.
- A store that staff refer to cannot be deleted (409), so a staff row never points at a deleted store.
- Decisions under D13 (design.md): dialog, not a page; no pager or filter, one request of 100 and a message when core holds more; own row without "Status"; errors all from core, shown on the field or as one alert, cleared by the next edit; password only in the dialog's state, `gcTime: 0` on the mutation; `idle` kept local (L5 owns `src/idle.ts`); fixtures in `src/staff-fake.ts`, `src/fake-core.ts` untouched.
- e2e: "admin creates a product and sets stock" is a stretch inside `catalog.spec.ts` › "admin runs the catalog" (no extra sign-in, no second e2e product alive beside the first: `stock.spec.ts` matches `14[78] products` and the catalog test expects exactly 148). The staff flow is `e2e/staff.spec.ts`, one test, with the new user in a second browser context so the admin signs in once and can deactivate them in the same test. Store staff taking the order to delivered stays admin-P2-L5's.
- Sign-ins per admin e2e run after this change: admin 5, koramangala@ 3, nobody@ 1, e2e-staff@ 1 (ten from one IP). With admin-P2-L5 as designed: admin 7, koramangala@ 4 (thirteen). Limits: 10 per email, 100 per IP, per hour and core process.
- The e2e ran only against a `page.route` fake on a scratch preview (port 25174), each new piece once, axe clean. Not against the real core.
- Rebase conflicts expected: none textual. `src/routes/_staff/stock.tsx` gets two inserted lines at anchors L7 left alone (applied to main's file cleanly); `e2e/catalog.spec.ts` gets a constant near the top and lines inside the first test, L5 appends a test at the end.
- Answer to core-P2-L6 ("to admin: `StockRow.imageUrl`"): used by task 3, the "Image" column of `/stock`.
## Requests
- to the admin manager: rebase this branch onto main before launching task 1 (tasks.md task 0).
- to core (information, through the area plan): `PATCH /admin/staff-users/{id}` lets an admin deactivate their own account and the last active admin; the panel prevents the first for the signed-in admin only. A 409 from core for "the last active admin" would close it for every client.
- to ui (already asked by admin-P2-L3 and L4, still wanted): `ImageTile` in `packages/ui`; `Button` styled for `aria-disabled="true"`. A third copy of the `idle` class string exists after this lane (`stock.tsx`, `staff-dialog.tsx`, L5's `src/idle.ts`).
## Blockers
None.
