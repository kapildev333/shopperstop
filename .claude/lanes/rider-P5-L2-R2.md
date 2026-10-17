# rider-P5-L2-R2 - review of T2 (offer routes), commits 67b1d0e, 3a20dee, 70d1cb5
Status: done
## Doing
Verdict: approve. No Go DB tests run (T3 worker active); vet and gofmt clean at 70d1cb5 in a scratch worktree (removed); `openspec validate --all --strict` 20 passed, 0 failed.
## Found
- Order fix, test, feat correct; fix is minimal (copy under lock) and precedes the test.
- Races R2, R3, R7, R8 match design; each test fails without its mechanism (VoidOffer, conditional updates, rollback).
- Nit: no explicit 401 test for the three offer routes; covered only by the openapi contract test (security vs 401).
- Nit: 204 responses carry no example (none possible).
- Nit: R4 (accept vs tick expiry) has no test, as design states.
## Requests
none
## Blockers
none
