# core-P4-L2-review-t1

Verdict: APPROVE (Task 1, 5757b54 test, 84bc597 feat). No blocking findings.

Test-first: 5757b54 red (app and auth do not compile, `auth.Mail`/`Auth.Mailer` undefined; seed: relation `customer_tokens` does not exist), 84bc597 green.

Scenarios covered: New customer is unverified (TestRegisteredCustomerIsUnverified); Verify with the mailed code, Already verified, Used once (TestEmailVerification); Bad code (TestVerifyEmailBadToken); Newer code replaces the older (TestNewVerificationTokenReplacesOld); Only the peppered hash is stored (TestMailedTokenStoredHashed); Message in the log (TestLogMailerLogsTheMessage); Demo customer / Reset twice (TestResetTwiceLeavesDemoAccounts).

Findings (non-blocking):
1. Medium, deferred: `POST /me/email-verification` has no rate limit. Harmless while the mailer is LogMailer; it needs one before a real mail transport lands.
2. Low: no test for a staff token on `POST /me/email-verification` answering 401 (the route sits behind RequireCustomer like the other /me routes).

Scope: within the task 1 paths (migration 0010, queries, sqlc output, auth, app, seed, openapi.json, generated core.d.ts and Postman, ticks).

Gates: gofmt -l empty; go vet clean; go test -race -count=1 ./... ok; make gen postman leaves the tree clean; openspec validate --all --strict passed.
