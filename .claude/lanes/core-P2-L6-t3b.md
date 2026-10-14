# core-P2-L6-t3b - summary ids unique, Postman ids pinned (test only)
Status: done
## Doing
2026-10-13: test committed (9d5d93f) and passed on first run; mutation check run and restored; gates green. Lane log committed last. Nothing left open.
## Found
- `TestSummaryMatchesSeed` (`services/core/internal/seed/seed_test.go`) now fails on a repeated id across the twelve id lines, and asserts the four Postman ids and the table each marked line names: `storeId` on `stores`, `productId` on `products`, `addressId` on `addresses`, `orderId` on `orders`. Expected values use the file's existing constants `storeKoramangala`, `productBanana`, `homeID`, `orderPlaced` (all the D20 literals).
- Mutation check (temporary edit of `summary.go`, restored with `git checkout`, not committed):
  - (a) swap the ids of the two store-staff lines: NOT caught, test passes. This is the recorded ceiling: both ids are still rows of `staff_users`, sign-ins are unchanged, and nothing ties a staff line to a store.
  - (b) admin id `...0101` duplicated onto the Koramangala staff line: caught, `repeats id 00000000-0000-4000-8000-000000000101 from an earlier line`.
- Gates: `GOFLAGS=-count=1 make test-core` exit 0; `make gen postman` exit 0 with `git status --short` empty afterwards; `openspec validate --all --strict` 15 passed, exit 0.
## Requests
None.
## Blockers
None.
