# web-P3-L1-T1 - web-rider-tracking task 1: rider client and tracking card (worker)
Status: started
## Doing
2026-10-15: commit 1 (red tests) done; commit 2 (feat, design Decisions 1 to 4) next.
## Found
- Red on commit 1: `npx vitest --run src/orders.test.ts src/order-tracking.test.tsx` shows 8 failed, 15 passed. The eight: orders "last seen wording", "rider read follows the status"; tracking "rider on the way with a position", "rider without a position", "no rider card before a rider", "delivered order names the rider from the rider read", "failed rider read keeps the card", "last seen kept current". Each fails with `lastSeen`/`deliveryOptions`/`deliveryKey is not a function`.
- Typecheck on commit 1: exactly four errors, TS2305 for `deliveryKey`, `Delivery` (tracking test) and `deliveryOptions`, `lastSeen` (orders test). Lint green.
## Requests
## Blockers
