# rider-P4-L2 - rider hygiene carryover: expired-session sweep, trusted proxy (OpenSpec change rider-hygiene-carryover)
Status: done (acceptance 3.1 pass at 8b6c31c; 3.2 recorded from the manager)
## Doing
Team lead: 2026-10-16 acceptance (`/opsx:verify rider-hygiene-carryover`) at 8b6c31c: PASS. 3.1 and 3.2 ticked with evidence in tasks.md.
## Found
- Change `openspec/changes/rider-hygiene-carryover/`: proposal; delta `specs/rider-service/spec.md` (ADDED "Expired rider sessions are deleted", 1 scenario; ADDED "The rider sign-in limiter trusts a proxy only when told", 4 scenarios); design.md with verbatim diffs (`git apply --check` clean in sequence on 49553f4); tasks.md (2 sequential worker tasks, 1 acceptance/verification task). `openspec validate rider-hygiene-carryover --strict` valid; `--all --strict` 20 passed. No `docs/design/rider-P4-L2.md`: design.md is enough.
- Backlog items: kept 1 (sweep) and 2 (`SHOPPERSTOP_RIDER_TRUST_PROXY`), both core's code copied; dropped 3 (HEAD as GET: core answers HEAD 405 `Allow: GET`, spiked on core's router; the rider already matches since rider-P4-L1) and 4 (405 per operation in `openapi.json`: orchestrator decision, reason in design.md Decision 4).
- The orchestrator's message said core already does HEAD as GET; it does not (spike: core `NewRouter` + GET route, `HEAD` → 405 `Allow: GET`, `method_not_allowed`; no `GetHead` anywhere in core). Matching core exactly therefore means no HEAD change; escalated in the report.
- Spike on 49553f4 (tree restored): T1 red `expired session still stored (1 rows), want swept`, green after; T2 tests fail to compile before the code; full `GOFLAGS=-count=1 make test-rider` green after all four diffs; `make gen` changes only rider's `auth.sql.go`; `make postman` no change. After: rider `limit.go` byte-equal to core's, rider `clientIP` byte-equal to core's.
- No contract change: `services/rider/openapi.json`, `rider.d.ts`, Postman untouched. No cross-area file.
- Acceptance at 8b6c31c, run by the team lead: a tree built from 49553f4 plus design.md's four diffs equals HEAD under `services/` exactly; outside it only the change folder and rider-P4-L2 lane and review logs. Commit order: `test:` 8c0e202 then `feat:` c41910e (T1), `test:` 6d9b81b then `feat:` a6759ee (T2); red re-run by me at 8c0e202 (`expired session still stored (1 rows), want swept`) and 6d9b81b (`cfg.TrustProxy undefined`, `limit.TrustProxy undefined`). `GOFLAGS=-count=1 make test-rider` 10 packages ok; `make gen postman` clean; strict 20/20; rider `limit.go` byte-equal to core's.
- Scenario to passing test: "Expired rider sessions are deleted" / Sign-in sweeps expired sessions `TestStartSessionSweepsExpired`. "The rider sign-in limiter trusts a proxy only when told" / Clients behind a trusted proxy `TestRiderSignInRateLimitedPerForwardedIP`; Empty forwarded address falls back to the connection `TestRiderSignInEmptyForwardedForFallsBackToConnection`; Proxy not trusted `TestRiderSignInRateLimitedPerIP`; Unknown value refused `TestLoadTrustProxy`. Existing session and limiter tests (`TestRiderSessionExpired`, `TestRiderSessionSlides`, `TestRiderSignOutEndsOnlyThatSession`, `TestRiderSignInRateLimited`) green. All PASS.
- Reviews R1 (T1) and R2 (T2) approve (8b6c31c). Manager's live verification for 3.2 recorded in tasks.md.
## Requests
None.
## Blockers
None.
