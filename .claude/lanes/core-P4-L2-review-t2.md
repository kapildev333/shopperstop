# core-P4-L2-review-t2

Verdict: APPROVE (Task 2, 93ccabe test, 7970452 feat), after fix task 4. Findings 1 and 2 were fixed by task 4 (e2083d2, 4234f53); the missing pins were added there.

Test-first: 93ccabe red (five tests, 404 on both routes), 7970452 green.

Scenarios covered: Reset ends every session (TestPasswordReset); Unknown email looks the same (TestPasswordResetUnknownEmail); Bad password keeps the code, Malformed email, Bad code incl. verification code (TestPasswordResetBadInput); expired reset code (TestPasswordResetTokenExpires); spent code (TestPasswordReset tail); Eleventh reset request for one email (TestPasswordResetRateLimited).

Findings:
1. High, fixed by task 4: reset requests shared the sign-in limiter, so 10 reset requests for an email locked its owner out of sign-in. Now `Auth.ResetLimit`, a separate limiter with the same numbers.
2. Medium, fixed by task 4: a mail or token failure for a registered email answered 500, which told a client the email was registered. Now logged without the code and answered 202.
3. Low, fixed by task 4: pins missing for a reset code on `/auth/verify-email` and for another customer's sessions surviving a reset (TestResetCodeDoesNotVerifyEmail, TestPasswordResetLeavesOtherCustomersSessions).

Scope: within the task 2 paths.

Gates: gofmt -l empty; go vet clean; go test -race -count=1 ./... ok; make gen postman clean; make test-web rc 0; openspec validate --all --strict 20 passed.
