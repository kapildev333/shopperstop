# core-P2-L1-t5 - task 5: customer sign-up, sign-in, sign-out, profile; bearer security in the contract
Status: done
## Doing
Task 5 landed on `lane/core-P2-L1-accounts-auth`: commits `1b42f7b` (test, red: build failure on the three-argument `app.New`, then assertion failures 404 and "bearer must be" once it compiles), `13d3498` (feat: `internal/auth/customer.go`, routes in `app.go`, `cmd/core` wiring, `openapi.json` 0.2.0 with tag `accounts` and `securitySchemes.bearer`), `chore: tick tasks 5.1 5.2`, then this log. Gates: `make test-core` exit 0 (app 43 s under `-race`, auth 9 s), `openspec validate --all --strict` 6 passed. Ready for task 6 (addresses).
## Found
- Routes live: `POST /auth/register` (201 `{token, customer}`), `POST /auth/sign-in` (200), `POST /auth/sign-out` (204), `GET|PATCH /me`. `app.New(pool, origins, a *auth.Auth)`; `cmd/core` builds `auth.New(pool, SessionPepper, NewLimiter(10, 100, time.Hour, time.Now))`, shared by register and sign-in (staff sign-in joins it in task 7).
- `auth.Customer` (json `id, email, name, phone omitempty`) and the unexported `customerSession`. `Customer` is what the profile and the session bodies share.
- Sign-out re-looks up the session by the bearer's token hash and deletes it. `RequireCustomer` keeps only the customer id in the context and `auth.go` was outside this task's scope; task 6 and later need no change, but a later lane may prefer putting the session id in the context.
- Register and sign-in run `Allow` after decoding the body and before validation (malformed JSON is 400 and not counted). A nil limiter admits every attempt; `cmd/core` always passes one.
- `openapi.json` now has the five operations with `operationId`s (`postAuthRegister`, `postAuthSignIn`, `postAuthSignOut`, `getMe`, `patchMe`), `security` on the three authenticated ones, 401 with an example on each of them, the 429 example on register and sign-in, and a string `token` in the register 201 and sign-in 200 examples (platform-P1-L8, core area backlog).
- Contract rules of the core area backlog met here: bearer scheme, `security` on authenticated operations, the contract assertion (`TestContractSecurity`). Not yet: `/admin/` staff routes (task 7), `core.d.ts` and the Postman collection (task 10, as the brief says; `make gen` was not run).
- The contract's security check sends one anonymous request per documented operation to the real router; the three toy tests exercise the checker itself, so they pass at the test commit; the router-backed `TestContractSecurity` is the red one there.
- Validation rules chosen where design.md is silent: sign-in answers 400 for an email that fails the register rule or an empty password (design's Routes table lists 400 for sign-in); the passwords are not length-checked at sign-in, so a wrong-length password is a plain 401.
- The test commit was amended (`1b42f7b`, not pushed) to fold in a shared-fixture change: `sharedCustomer` (one registration for the read-only validation and gate rows) and the removal of a duplicated wrong-password request. Done before the feat commit so the feat commit is code only.
- Test time: each registration costs about 2.3 s under `-race` (cost-12 bcrypt). The app package is 43 s; `sharedCustomer` and per-test emails are the ceiling, a shared fixture for more tests is the next step if it grows.
## Requests
- to core-P2-L1 (task 10): regenerate `packages/ui/src/api/core.d.ts` and the Postman collection; `scripts/postman.test.mjs` may still assert the one-folder contract (already requested in core-P2-L1 Requests).
## Blockers
none
