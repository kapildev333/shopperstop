# rider-P5-L1 - rider collect cash (OpenSpec change rider-collect-cash)
Status: started
## Doing
Team lead: change written and validated (`openspec validate rider-collect-cash --strict`); briefs T1, T2 ready for the manager. Waiting on the workers; acceptance after.
## Found
- Change `openspec/changes/rider-collect-cash/`: deltas `deliveries` (MODIFIED "Riders see their store's ready orders", "Riders claim a ready order", each with one new scenario) and `rider-app` (MODIFIED "Ready orders list", "Cash to collect", "Cross-app delivery flow"). The work package named `rider-service`, but the ready list and delivery reads live in `deliveries`; `rider-service` is untouched. design.md carries every hand-written change as a verbatim diff, spiked on 048b4a4 and reverted (chain checked with `git apply`). No `docs/design/rider-P5-L1.md`.
- Snapshot vs live: `payment_method` was already snapshotted at the claim (0003). `paymentStatus` is snapshotted too (migration 0004, `payment_status text not null default ''`): core freezes an online order's payment at `paid` before it can be `ready` (accept needs paid, no cancel from packing on), so the claim-time value is exact for the delivery's life and reads stay core-free. Ready orders copy both from the live core read the route already makes.
- Spike evidence: T1 diffs -> `GOFLAGS=-count=1 make test-rider` all ok, `make gen postman` changed exactly rider.d.ts, the rider collection and three sqlc files (incl. `internal/auth/db/models.go`, sqlc emits all models per package). T2 diffs -> rider Vitest 64 passed, lint/typecheck/build 0. Reds: T1 compile error `o.PaymentStatus undefined`; T2 5 failed / 59 passed.
- Text change: "Collect ₹x cash" becomes "Collect ₹x in cash" (work package). Ready badge says "Cash" (work package), not D53's "Cash on delivery".
- The e2e flow places a cash order through "Place order (COD)"; core's demo seed has `SS-DEMOAAAE` online+paid (placed), usable for the manager's live check after moving it to ready.
## Requests
None to other areas.
## Blockers
None.
