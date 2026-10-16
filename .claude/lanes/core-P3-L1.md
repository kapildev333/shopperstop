# core-P3-L1 - service tokens and the rider handoff (OpenSpec change core-service-auth-rider-handoff)
Status: started
## Doing
2026-10-15: change proposed and committed (`openspec validate --strict` valid, `--all --strict` 15 passed); two worker briefs in the report to the core manager. Waiting for Task 1's worker; answering relayed questions here.
2026-10-15 (worker, Task 1 done): service tokens landed in six commits (config, auth, five routes, contract probe, openapi, generated files); `make test-core` exit 0, `make gen postman` clean, `openspec validate --all --strict` 15 passed; tasks 1.1 to 1.3 ticked; Task 2 not started.
2026-10-15 (worker, Task 2 done): commits `84d380f test: a service moves orders for a rider`, `22ffbc0 feat: record the rider on the order and its events`; `go vet` clean, gofmt clean, `go test -race -count=1 ./...` green on `shopperstop_core_test`; `make gen postman` clean (postman 17 pass); `openspec validate --all --strict` 15 passed; `make test-web` stops at the expected admin TS7053 only (`apps/admin/src/order-sheet.tsx:61`, `rider` missing from the actor map; lint, ui and web typecheck pass; ui, admin and web unit tests pass). Admin's fix is still needed before merge (see Requests); tasks 2.1 and 2.2 ticked.
## Found
- Change `openspec/changes/core-service-auth-rider-handoff/`: proposal; deltas for `platform` (3 ADDED: service tokens configured, services reach the rider's admin routes, the contract names the service routes; MODIFIED request-log subject), `orders` (2 ADDED: a service moves orders for a rider, orders name their rider; MODIFIED transitions recorded, order routes need the right session), `admin-stores` (MODIFIED admins only), `admin-staff` (MODIFIED staff sessions, admin-only routes); every requirement body under 500 characters (largest 478). design.md carries all code and tests verbatim; tasks.md two worker tasks. No `docs/design/core-P3-L1.md`: design.md is enough.
- Spike on 30a4e7c (tree restored before the commit): the design compiles, `go vet` clean, all new tests pass (config, auth, app service and rider tests, contract toy tests), every package suite green; `TestContractSecurity` with the probe fails on exactly ten `openapi.json` gaps, which Task 1's openapi edits close.
- Makefile tokens (`dev-rider-service-token-dev-rider-00`, `e2e-rider-service-token-e2e-rider-00`) are 36 bytes each; the 32-byte minimum admits them; `TestLoadServiceTokens` uses both values.
- `make gen` (sqlc v1.31.1) rewrites every `internal/*/db/models.go` for migration 0007 (shared schema): expected, commit them all.
- `order_events.actor_type` has a check constraint (`order_events_actor_type_check`); 0007 replaces it to admit `rider`.
- Cross-area break found: `apps/admin/src/order-sheet.tsx:9` `const actor = { customer, staff, system }` indexed by `event.actorType`; with `rider` in the regenerated `core.d.ts` the admin typecheck fails (TS7053). Admin must add a `rider` key first (valid on main today).
- Between Task 1 and Task 2 on the branch, a service POST to the status route with a valid body reaches `Transition` with an empty actor id (500); the contract probe sends no body (400), so the suite stays green. Task 2 closes it; nothing merges in between.
## Requests
- to admin (through the core area plan): add `rider: 'the rider'` to the `actor` map in `apps/admin/src/order-sheet.tsx` before core-P3-L1 merges; optionally show `riderName` on the order sheet and `actorName` in the history once `core.d.ts` has them.
- to rider (through the core area plan): the contract in the report (token as bearer; `actor` required; 400 `actor`, 403 `forbidden` for other targets, 409 for table refusals; the service token is 403 on `/admin/me`).
## Blockers
None.
