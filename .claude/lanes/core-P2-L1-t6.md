# core-P2-L1-t6 - task 6: customer addresses (GET, POST, PATCH, DELETE /me/addresses)
Status: done
## Doing
Task 6 landed on `lane/core-P2-L1-accounts-auth`: commits `f97e0f2` (test: customer addresses, red for the right reason: 404 on the unregistered routes), `08e08c0` (feat: me/addresses routes), `df16ac9` (chore: tick tasks 6.1 6.2), then this log. Gates: `make test-core` exit 0 (`internal/app` 18.2 s under `-race`), `openspec validate --all --strict` 6 passed, `gofmt -l` clean. Ready for task 7 (staff sign-in).
## Found
- Routes live under RequireCustomer: `GET|POST /me/addresses`, `PATCH|DELETE /me/addresses/{id}`. Handlers are package functions `address.List(pool)`, `Create(pool)`, `Update(pool)`, `Delete(pool)`, as the design Interfaces and Routes table say (no `New` type).
- `Create` and `Update` with `isDefault` true run `ClearDefaultAddress` and the write in one `pgx.BeginFunc` (`inTx`); errors go through `pg.Map`. `Update` with no row is `pg.Map(ErrNoRows)` → 404; `Delete` uses `:execrows`, 0 rows → 404.
- Responses convert the sqlc row types to `address.Address` with a plain struct conversion (tags ignored, fields identical in order), so a changed sqlc column order fails to compile rather than misnaming a field.
- Validation runs in Go before any write, first failing field wins, in the order label, line1, line2, pincode. Create and PATCH share `checkFields`.
- `openapi.json` 0.2.0 gained `/me/addresses` (`getMeAddresses`, `postMeAddresses`) and `/me/addresses/{id}` (`patchMeAddress`, `deleteMeAddress`), `security` bearer, 401 on each, 400 and 404 examples, `page`/`pageSize` query parameters, path `id` example `...0301`, and schemas `Address`, `AddressCreate`, `AddressPatch`, `AddressList`. Added as text splices so the diff is additions only (497 lines). `make gen` not run (task 10).
- `TestAuthGates` has the four address rows: anonymous 401 and customer allowed (PATCH and DELETE on an unused id get 404 past the gate).
- `List` skips the query when `(page-1)*pageSize` exceeds MaxInt32: the int32 cast would wrap. `httpx.Page` only bounds each parameter, so its comment "cannot overflow" is true for int but not for the int32 offset; the guard lives in the handler, not in httpx (outside this scope).
## Requests
- to core-P2-L1 (orchestrating lane): design Decision 17 says a new address is not made default automatically; the task brief says "the first address is default". The spec deltas say neither. The implementation follows Decision 17 (and `TestAddressCreateAndList` creates Home with `isDefault` true explicitly). If the first-address rule is wanted, it is a design change: add it to Decision 17 and the `accounts` spec, then a test.
- to core-P2-L1 (for the flake, not this lane's code): `TestSignInFailuresLookTheSame` (timing, at least 1 s for the unknown-email path) failed once in a full `internal/app` run under load and passed on three reruns alone and in the full gate. Worth a look before the PR; not touched here.
## Blockers
none
