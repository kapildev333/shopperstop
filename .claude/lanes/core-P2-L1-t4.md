# core-P2-L1-t4 - task 4: auth core (passwords, tokens, sessions, middleware, limiter)
Status: done
## Doing
Task 4 landed on `lane/core-P2-L1-accounts-auth`: commits `f937feb` (test, red: build failure on the undefined `Auth`, `New`, `HashPassword`, `CustomerID`, `CurrentStaff`), `c38e36f` (feat), `96b5c3d` (chore: tick tasks 4.1 4.2). Review fixes: `c9106fc` (test: prune once per window, concurrency, staff subject log; the prune test failed on the pre-fix limiter at the second scan, 5004 keys 40 minutes after the prune), `db2a86c` (fix: prune at most once per window, `lastPrune`; `golang.org/x/crypto` direct after `go mod tidy`). `make test-core` exit 0, `openspec validate --all --strict` 6 passed. Ready for task 5 (customer handlers).
## Found
- `auth.New(pool, pepper, limit)` returns `*Auth`; `limit` may be nil until task 5 wires the production limiter. `Auth.pool` is set but not read yet; tasks 5 and 8 (`CreateStaff`, transactions) read it.
- `auth.Staff` (json `id, email, name, role, storeId?, isActive`) is defined here because the context carries it. `auth.Customer` is not defined yet (task 5).
- Middleware: `RequireCustomer` looks up the session, runs `TouchCustomerSession(sessionID)` (a no-op within the hour) and sets `httpx.SetSubject("customer", id)`; the context holds the customer id only. `RequireStaff` sets subject `staff` and the `Staff` value; `RequireAdmin` answers 403 `forbidden` "admins only". Failures other than no rows go through `httpx.WriteError` and are logged as unhandled errors with the request id.
- Limiter: `NewLimiter(perEmail, perIP, window, now)`; `Allow(email, ip)` normalises the email itself (lower case, trimmed), so callers pass the raw address and `ip` as the host without port. Every call counts against both keys. Above 10 000 keys, ended windows are dropped at most once per window (`lastPrune`), so a flood of distinct keys cannot make every call scan the map.
- Tokens: `startSession(ctx, "customer"|"staff", id)` returns the 43-character token; `tokenHash` is `sha256(token || pepper)`. `HashPassword` is bcrypt cost 12; the unexported check is `checkPassword(hash, password) bool` (design Files list; the brief's name `CheckPassword` was not used).
- Test fixtures: one shared cost-12 hash per package (`testHash`), unique emails per call (`testEmail` with a sequence). About 2.3 s of the package's 8.8 s under `-race` is that one hash.
- Dependencies: `go get golang.org/x/crypto@latest` (v0.58.0) also upgraded indirect `golang.org/x/sync` to v0.24.0 and `golang.org/x/text` to v0.43.0, which x/crypto requires. Both are in `go.sum`.
- History: a fixup folded two test-helper fixes into the test commit before any feat commit (duplicate staff email in one test; a second cost-12 hash in the password test). The test commit is still red (undefined symbols) when it lands. The review-fix prune test was corrected the same way (fixup into `c9106fc`), after its first version scanned at 30 minutes rather than at the threshold crossing.
- Staff subject log has a test (`TestRequireStaffLogsSubject`); it passed without code change.
## Requests
none
## Blockers
none
