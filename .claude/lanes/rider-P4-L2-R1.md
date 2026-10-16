# rider-P4-L2-R1 - Review of T1 (22ffc37..c41910e)
Status: approve

## Findings
None blocking.
- Nit: the lane log's Status line says "feat next" though the feat commit exists (c41910e); cosmetic.

## Checked
- Order: 8c0e202 test (auth_test.go, log only), then c41910e feat. Red output recorded matches the scenario; the test fails only for lack of the sweep.
- Spec delta "Expired rider sessions are deleted": covered by TestStartSessionSweepsExpired (2 expired, 2 live, new one; any rider; `<=` boundary via expires_at in the past).
- Parity with core: query `delete from sessions where expires_at <= now()`, same comment form, same ponytail note, sweep runs before token creation and errors return early. Rider's only session start is startSession (rider.go:109), so all sign-ins sweep.
- auth.sql.go: `sqlc generate` leaves the tree clean, so the file matches sqlc.
- Scope: only the brief's files plus tasks ticks and lane log. No creep.

## Gates
- `go test -race -count=1 ./internal/auth/...` (rider test DB): ok.
- gofmt -l: clean. `go vet ./...` fails in internal/app/riders_test.go:309 (`limit.TrustProxy` undefined): that is T2's red test already in the tree, not T1.
