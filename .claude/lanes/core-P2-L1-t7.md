# core-P2-L1-t7 - task 7: staff sign-in, sign-out, me (POST /admin/auth/sign-in, POST /admin/auth/sign-out, GET /admin/me)
Status: done
## Doing
Task 7 landed on `lane/core-P2-L1-accounts-auth`: `6bdc9dc` (test: staff sign-in, sign-out and me, red: 404 on every staff route), `58fb6ed` (feat: admin auth routes and admin/me), `677a768` (chore: tick tasks 7.1 7.2), then this log. Gates: `make test-core` exit 0 (`cmd/core` 1.36 s, `internal/app` 28.1 s under `-race`, `internal/auth` 9.1 s, `httpx`/`config`/`migrate`/`pg` cached); `openspec validate --all --strict` 6 passed. Ready for task 8 (staff users).
## Found
- `internal/auth/staff.go`: `StaffSignIn`, `StaffSignOut`, `StaffMe`, and the `staffSession {token, staff}` body. Sign-in reuses `signInRequest`, `checkEmail`, `invalid`, `refused` (the shared limiter, same keys as customer sign-in), `dummyHash`, `checkPassword`, `errWrongCredentials`, `startSession(ctx, "staff", id)`.
- Equal work (Decision 10) on every path: `StaffByEmail` runs first; `checkPassword` runs against the staff hash, or the dummy hash when the email is unknown; only then `!found || !row.IsActive` decides. Unknown email, customer email, wrong password and inactive staff all cost one bcrypt compare and answer the same 401 `wrong email or password`.
- Sign-out finds the session with `StaffSession(tokenHash)` (the join already rejects inactive users) and deletes `SessionID`, mirroring customer sign-out. `StaffMe` answers `CurrentStaff(ctx)` unchanged; `storeId` is omitted for admins by the `Staff` struct tag.
- Routes in `app.go`: `POST /admin/auth/sign-in` (public, limiter), `POST /admin/auth/sign-out` and `GET /admin/me` under `RequireStaff`. A customer token on either is 401 (`TestStaffMeWithCustomerToken`, `TestAuthGates` staff rows).
- `openapi.json` (still 0.2.0): tag `admin-staff`; operations `postAdminAuthSignIn`, `postAdminAuthSignOut`, `getAdminMe` with `security` on the two secured ones, 400/401/429 examples as the Routes table says; schemas `Staff` (role enum, `storeId` optional, `additionalProperties` false) and `StaffSession`; sign-in examples use the demo admin, token is the D20 example string. Added as a text splice: 241 insertions, 0 deletions. `make gen` not run (task 10).
- Fixtures (`staff_test.go`): admin `admin.staff@example.com` and store staff `store.staff@example.com` (store `00000000-0000-4000-8000-000000000401`), inserted once with raw SQL at `cheapHash()`, the same pattern as `seedCustomer`. `insertStaff(t, role, active)` gives one-off inactive users. `staffSignIn(t, email)` returns a token; `TestAuthGates` signs in fresh for each staff row because sign-out ends the token.
## Requests
- to core-P2-L2 (store staff fixtures): `testStoreID` in `internal/app/staff_test.go` (`...0401`) is not a row in `stores`. Until L2 adds the foreign key on `staff_users.store_id` this is fine; once it does, the fixtures must insert a real store first, or the store-staff fixture insert fails. Point the fixture at L2's store id then.
- to core-P2-L1 (task 8): the brief asked for `auth.HashPassword` in the fixture; I used `cheapHash()` (bcrypt.MinCost) as the brief's cheap-hash rule says. Task 8 `TestCreateStoreStaffUser` should go through the router at cost 12 once, as the customer tests do.
## Blockers
none
## Judgement calls
- The test fixture was corrected inside the red commit (`6bdc9dc`, amended before the feat commit, unpushed): the first draft decoded the admin sign-in body into the wrong shape and would have failed for a test reason, not a code reason. The feat commit is code and openapi only.
- Staff sign-in 400 has no test of its own. It uses the customer validation (`checkEmail`, empty password) which `TestSignInValidation` covers, and the contract test does not check 400s. Not added because 7.1 names no such test.
- `openapi.json` `info.version` stays `0.2.0`; no version bump was asked for this task.
