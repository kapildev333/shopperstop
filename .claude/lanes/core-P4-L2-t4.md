# core-P4-L2-t4 - reset limiter and mail failure (fix task 4 from the task 2 review)
Status: done (4.1 e2083d2, 4.2 4234f53; review approve, accepted 2026-10-16)
## Brief
- LANE-ID: core-P4-L2 (fix task 4). Area: core. Role: worker.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P4-L2. Branch: lane/core-P4-L2-accounts-security. Commit as kapildev333, no trailers; never push.
- OpenSpec change: `openspec/changes/core-accounts-security/`, task 4 in `tasks.md`.
- Fixes: reset requests get their own limiter (`Auth.ResetLimit`, built in `cmd/core/main.go` with the sign-in numbers); a mail or token failure for a found email is logged without the token and answers 202; pins for verify-email with a reset code and for another customer's session.
- Commits: `test: password reset keeps sign-in open and never reveals a mail failure`, then `fix: separate reset limiter; mail failure answers 202`.
## Doing
- 4.1 committed (e2083d2). 4.2 done: fix, spec and design wording, reset description in openapi.json, gates green (below).
- Gates: gofmt -l empty; go vet ./... clean; go test -race -count=1 ./... all ok (app 122 s); make gen postman (22 pass, core.d.ts and Postman changed by the description only); make test-web exit 0 (no TS2741); openspec validate --all --strict 20 passed.
## Found
- `Auth.ResetLimit` is an exported field set after `New`, the pattern of `Mailer` and `TrustProxy`; nil admits every request. `New` keeps its signature, so no caller changes.
- The test commit does not compile (`Auth.ResetLimit` undefined), so the two pins ran first with the feat commit: red for the new tests is a build failure, not a behavioural one.
- The spec's reset requirement stayed under the 500-character limit: the mail-failure rule went into a scenario, "Mail fails for a registered email".
## Requests
## Blockers
