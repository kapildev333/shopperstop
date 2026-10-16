# rider-P3-L1-R2 - review of rider-P3-L1-T2 (50be836, 3d5b366)
Status: done
## Doing
Reviewed in a detached checkout of 3d5b366 (removed). Verdict: approve with nits.
## Found
- gofmt, vet clean; `go test -race -count=1` on every package except internal/core all ok; `sqlc diff` clean; `openspec validate --all --strict` 15 passed, 0 failed.
- limit.go, password.go, their tests and pg.go match core (pg: import path and header only).
- Test commit is red by build failure plus TestEmbeddedMigrationsApplyOnce (assertion failure).
- Nit: first unknown-email sign-in per process pays two bcrypts (dummyHash is lazy), a one-time timing tell; same as core. Warm it in auth.New if wanted.
- Nit: TestRiderProbeRefusesMissingToken duplicates app-level TestRiderBearerRefusals; not in the brief.
- Nit: SignOut re-reads the session by token; putting the session id in the context would save a query. Matches core, leave.
- 2.4 s sign-in is bcrypt cost 12 under -race plus the lazy dummyHash; no issue.
## Requests
- none
## Blockers
