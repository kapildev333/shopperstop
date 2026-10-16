# web-P3-L1 - web-rider-tracking: rider card on tracking, rider names in history, order's own promise, ui swaps (team lead)
Status: started
## Doing
2026-10-15: change proposed and valid (`openspec validate web-rider-tracking --strict`, `--all --strict` 17 of 17); four worker briefs in `openspec/changes/web-rider-tracking/briefs/`. Waiting for the manager to run task 1. Reachable here for worker questions.
## Found
- Change: `openspec/changes/web-rider-tracking/` (proposal; `web-app` delta 4 ADDED, 4 MODIFIED; design with code per decision, scenario-to-test map, ceilings; tasks 1 to 4; briefs). No `docs/design/web-P3-L1.md`: design.md is enough.
- Core's demo order `...0701` has no `rider_name` and staff-only events, while the rider seed has Arjun Rao's delivery for it. The card's name is `Order.riderName ?? delivery.riderName`, so the seeded e2e passes on today's seeds.
- The delivery read is enabled only for `out_for_delivery` (10 s poll) and `delivered` (once): no request before a claim, so its 404 normally never happens; a 404 is null, "no rider".
- The rider client reuses `authMiddleware` as is: a rider 401 drops the customer token (rider answers 401 only when core refused that bearer).
- Cross-area contract for rider-P3-L3 (design.md): "Place order (COD)", "Your order is out for delivery.", "Your order was delivered." unchanged; the card is `getByRole('region', { name: 'Rider', exact: true })` with the rider's name as exact text inside.
- Design snippet for `deliveryOptions` typechecked against `@shopperstop/ui/api/rider` in a throwaway file (removed).
- Live e2e uses `orderPick(request, 9)` (0 to 8 taken), rider2 Meera Iyer (`rider12345`), one more admin `staffHeaders` sign-in.
## Requests
- to core (optional, via the area plan): seed `...0701` with `rider_name` 'Arjun Rao' and rider-actor events for `out_for_delivery` and `delivered` (actor_name 'Arjun Rao'), to match the rider seed. Not blocking; if it lands, `e2e/orders.spec.ts` "tracking against core" still expects six entries ending in "Delivered".
## Blockers
None.
