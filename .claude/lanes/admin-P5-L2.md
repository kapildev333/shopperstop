# admin-P5-L2 - admin store location and dispatch line (OpenSpec change admin-store-location-dispatch)
Status: started
## Doing
2026-10-16: change proposed and committed; `openspec validate admin-store-location-dispatch --strict` valid, `--all --strict` 20 passed. Worker briefs T1, T2, T3 in the team lead's report; T1 and T2 can start now, T3 waits on rider-P5-L2 on main. Then acceptance with `/opsx:verify`. I answer worker questions relayed here.
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
Task 3 waits on rider-P5-L2 merged to main (regenerated `packages/ui/src/api/rider.d.ts`).
