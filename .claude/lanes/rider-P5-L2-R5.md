# rider-P5-L2-R5 - review of T5 (f09c470, 1ff1c18) and T6 (ee2e871, 4f226e4)
Status: done. Verdict: approve.

## Gates (own run)
- `GOFLAGS=-count=1 make test-rider` in a detached scratch worktree at 4f226e4 (removed): every package ok (app 27s, dispatch 2.5s, seed 31s).

## Findings
- Nit: `etaSeconds` (eta.go) converts a float to int32 unbounded. Config accepts any positive speed, so a speed of 0.0001 km/h over 10 km overflows int32 (implementation-defined, could break the `eta_seconds >= 0` check). Smallest fix: clamp to math.MaxInt32 before converting, or a speed floor in config.
- Nit: `dispatch_test.go` TestETA names a variable `indiranagar := 0.0` (a zero-distance case), misleading next to `koramangala`; rename `zero`.
- Nit: the staff read adds one live core store call per read while dispatch is enabled; matches Decision 7 (uncached), no change.

## Checks that held
- T5: expired offer ...0902 on SS-DEMOAAAB, rider ...0801, answered_at set, no open offer, nobody online; summary line carries (Postman offerId), test ties offerId to the Postman environment like riderId/deliveryId; offers in the truncate list (T1). Collection regenerated for {{offerId}} is generated output (D23).
- T6: Store.Location *StoreLocation omitempty {lat,lng}; haversine with R 6371000, speed/3.6, round, 0 within 100 m; rank unchanged (ETA/60, idle, id); stale positions excluded in Candidates; no location -> no offers and staff read `off`.
- R3 folds: Candidates before the core ready call (TestTickNoCandidateNoCoreCall), ponytail comments on lock-across-core-calls and the 100-order page, Run uses time.Now(). R4 folds: TestOrderDispatchRefusals (401, 401, 404, 502) and TestOrderDispatchOffWithoutLocation.
- Test-first: both pairs ok (T5 red by assertion; T6 red by compile failure, noted in the T6 log).
- Scope: only listed files plus tasks.md and the regenerated collection.
