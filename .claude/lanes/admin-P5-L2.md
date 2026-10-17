# admin-P5-L2 - admin store location and dispatch line (OpenSpec change admin-store-location-dispatch)
Status: done (acceptance passed; task 4.1, the two e2e scenarios, is the manager's `make e2e`)
## Doing
2026-10-16: acceptance (`/opsx:verify` semantics) at e3ac612 (main merged at 3bf186c, base b68ef53): PASS except task 4.1, the manager's `make e2e`, running now.
- Scenarios: 11 in the deltas. The 9 Vitest ones map to tests that exist by name (design.md "Tests"): 5 in `store-form.test.tsx`, 4 in `orders-dispatch.test.tsx`. Per R1 and R2 they pass (339 and 343 on HEAD, test commits red 2, 3 and 4). I ran no npm during acceptance because the manager's gates hold this worktree. The 2 e2e scenarios ("Admin moves a store's location and puts it back" in `e2e/stores.spec.ts`, "No rider online for a ready order" in `e2e/orders.spec.ts`) are written and wait on task 4.1. No `.only` or `.skip` under `apps/admin/src` or `e2e`.
- Tasks: 1.1 to 3.2 ticked; 4.1 open, the manager's.
- Nothing extra: `git diff --stat b68ef53 HEAD` holds only the 9 `apps/admin` files in design.md "Files", the change folder and this log. The six patches applied with `git apply --cached` onto b68ef53 give a tree with 0 diff lines from HEAD under `apps/admin`. Commit order is test then feat for every task.
- The contract on main matches the design: `OrderDispatch`, `DispatchOffer` and `Rider.isOnline` (optional) in `packages/ui/src/api/rider.d.ts`.
- Review notes: R1's scientific-notation point is recorded in design.md ceilings. R2's two low notes stay as is: the `...{ isOnline: false }` spread is harmless now that `isOnline` is optional, and a failed store read leaves the line at "Dispatch off".
- `openspec validate admin-store-location-dispatch --strict` valid.
## Found
- Change: proposal.md; `specs/admin-app/spec.md` with 7 ADDED requirements (longest 434 characters), no MODIFIED; design.md (9 decisions, ceilings, scenario-to-test map, gates, risks); tasks.md (3 worker tasks + the manager's e2e); `patches/` (6 patches, `git apply` in order). No `docs/design/admin-P5-L2.md`: design.md settles every choice.
- Spiked on this branch at 3db68a3, replayed in order on a clean `apps/admin` (identical to the spike), tree restored; `git apply --check` clean in order on 3db68a3. Admin Vitest: base 334; 1.1 red 2 / 336; 1.2 336; 2.1 red 3 / 339; 2.2 339; 3.1 red 4 / 343; 3.2 343. Lint, typecheck, `vite build` clean on the final tree.
- Task 3 was spiked against a throwaway hand-written stub of rider-P5-L2's types in `packages/ui/src/api/rider.d.ts` (reverted, never committed). Its patches typecheck only once rider-P5-L2's regenerated `rider.d.ts` (`OrderDispatch`, `DispatchOffer`, `/admin/orders/{orderId}/dispatch`) is on main.
- Copy per the coordinator (2026-10-16): "Offered to <riderName>, <ceil(etaSeconds/60)> min away"; `dispatch` off: "Dispatch off", plus ": store has no location" when `GET /stores/{id}` answers no `location` (read only while off); `online` 0: "No rider online"; else "Waiting for a rider".
- Answer to rider-P5-L2's request: `isOnline` is added to the admin `Rider` fixtures in task 3 (`riders-fake.ts`, as `...{ isOnline: false }`, which typechecks before and after the contract change).
- The location e2e steps sit at the end of the existing admin stores test (saves one admin@ sign-in against core's 10 per hour); the dispatch e2e is one assertion at the Ready step of the staff orders test.
## Requests
- to rider (rider-P5-L2, information): admin's e2e expects "No rider online" on Koramangala's SS-DEMOAAAD at Ready, so `make e2e`'s rider must run the dispatcher (no `SHOPPERSTOP_RIDER_DISPATCH_INTERVAL=0`) and no suite may leave a Koramangala rider online.
## Blockers
None.
