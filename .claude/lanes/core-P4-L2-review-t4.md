# core-P4-L2-review-t4

Verdict: APPROVE (fix task 4, e2083d2 test, 4234f53 fix). No blocking findings.

Test-first: e2083d2 red as a build failure (`Auth.ResetLimit` undefined), not a behavioural red; the two pins (TestResetCodeDoesNotVerifyEmail, TestPasswordResetLeavesOtherCustomersSessions) therefore first ran with the fix commit. 4234f53 green.

Scenarios covered: Reset requests leave sign-in open (TestPasswordResetLeavesSignInOpen); Mail fails for a registered email, 202, no body, logged without the code (TestPasswordResetMailFailureAnswers202).

Findings (non-blocking):
1. Low: a nil `Auth.ResetLimit` admits every reset request. Only cmd/core/main.go builds Auth for serving and sets it; deleting that line would not fail a test.
2. Info: the per-IP budget is now effectively 200/h (100 sign-in plus 100 reset) across the two limiters. Accepted by the spec wording ("same numbers", second limiter).
3. Info: the test commit's red is a build failure (see above).

Scope: within the task 4 paths (auth, cmd/core/main.go, password_reset_test.go, the reset description in openapi.json, regenerated core.d.ts and Postman, spec delta and design wording, ticks).

Gates: gofmt -l empty; go vet clean; go test -race -count=1 ./... ok; make gen postman clean; make test-web rc 0; openspec validate --all --strict 20 passed.
