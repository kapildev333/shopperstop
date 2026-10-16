# rider-P4-L2 - rider hygiene carryover: expired-session sweep, trusted proxy (OpenSpec change rider-hygiene-carryover)
Status: started (artifacts committed; workers not launched)
## Doing
Team lead: change, design with verbatim diffs and two worker briefs committed; waiting for the manager to launch T1, then T2, then acceptance (`/opsx:verify rider-hygiene-carryover`).
## Found
- Change `openspec/changes/rider-hygiene-carryover/`: proposal; delta `specs/rider-service/spec.md` (ADDED "Expired rider sessions are deleted", 1 scenario; ADDED "The rider sign-in limiter trusts a proxy only when told", 4 scenarios); design.md with verbatim diffs (`git apply --check` clean in sequence on 49553f4); tasks.md (2 sequential worker tasks, 1 acceptance/verification task). `openspec validate rider-hygiene-carryover --strict` valid; `--all --strict` 20 passed. No `docs/design/rider-P4-L2.md`: design.md is enough.
- Backlog items: kept 1 (sweep) and 2 (`SHOPPERSTOP_RIDER_TRUST_PROXY`), both core's code copied; dropped 3 (HEAD as GET: core answers HEAD 405 `Allow: GET`, spiked on core's router; the rider already matches since rider-P4-L1) and 4 (405 per operation in `openapi.json`: orchestrator decision, reason in design.md Decision 4).
- The orchestrator's message said core already does HEAD as GET; it does not (spike: core `NewRouter` + GET route, `HEAD` → 405 `Allow: GET`, `method_not_allowed`; no `GetHead` anywhere in core). Matching core exactly therefore means no HEAD change; escalated in the report.
- Spike on 49553f4 (tree restored): T1 red `expired session still stored (1 rows), want swept`, green after; T2 tests fail to compile before the code; full `GOFLAGS=-count=1 make test-rider` green after all four diffs; `make gen` changes only rider's `auth.sql.go`; `make postman` no change. After: rider `limit.go` byte-equal to core's, rider `clientIP` byte-equal to core's.
- No contract change: `services/rider/openapi.json`, `rider.d.ts`, Postman untouched. No cross-area file.
## Requests
None.
## Blockers
None.
