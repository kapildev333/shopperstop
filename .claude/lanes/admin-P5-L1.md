# admin-P5-L1 - admin payments: payment badge, Accept waits for payment, payment events, History payment filter (OpenSpec change admin-payments)
Status: started (change proposed; tasks 1 to 3 ready for workers, one after another; task 4 is the manager's e2e run)
## Doing
2026-10-16: change `openspec/changes/admin-payments/` committed; `openspec validate admin-payments --strict` valid, `--all --strict` 20 passed. Waiting for workers T1, T2, T3 (in that order: they share `orders.ts`, `order-board.tsx`, `order-sheet.tsx`), then acceptance with `/opsx:verify`.
## Found
- Change: proposal.md; `specs/admin-app/spec.md` with 6 ADDED requirements (largest 390 characters), no MODIFIED (each existing requirement stays true for cash orders); design.md (9 decisions, ceilings, scenario-to-test map, gates, risks); tasks.md (3 worker tasks + the manager's e2e run); `patches/` (6 patches, applied in order with `git apply`). No `docs/design/admin-P5-L1.md`: design.md settles every choice.
- Spiked on this branch at 2fb56ed, cut into patches, re-applied in order on a clean tree (result identical to the spike), tree restored. Admin Vitest: base 327; 1.1 red 3 / 330; 1.2 330; 2.1 red 2 / 332; 2.2 332; 3.1 red 2 / 333; 3.2 333. Lint, typecheck, `vite build` clean on the final tree. e2e not run (manager's slot).
- Seed (core-P5-L1): the paid demo order is `SS-DEMOAAAE` (`...0704`, Koramangala, `placed`, paid, reference `fake_demo_0a01`), not `SS-DEMOAAAC` (cancelled) as the area plan's work package says. It sits in the board's Placed column. The demo customer `demo@shopperstop.local` has a verified email.
- The core request (render a `fromStatus == toStatus` event by its note) is answered by task 1: "<note>, by <actorName>, <when>".
- The e2e places its online order through core at `:18080` as the demo customer (Pomegranate Bhagwa x1 at Koramangala) and signs the panel in as koramangala@, keeping admin@ under core's sign-in limit. Adds one demo@ sign-in per admin run.
- Flake seen once in four full runs: `rider-dialog.test.tsx` "an admin creates a rider at a store; ..." (a `findBy` past 1 s under load), passed on rerun; not touched by this change.
## Requests
- to core (low, only if wanted later): a payment filter query parameter on `GET /admin/stores/{id}/orders`; History filters the loaded page client-side until then (ceiling in design.md).
- to the orchestrator (information): the area plan's work package names `SS-DEMOAAAC` as the paid seed order; it is `SS-DEMOAAAE`.
## Blockers
None.
