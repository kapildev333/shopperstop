# rider-P5-L2-R4 - review of T4 (8477a5c test, 37c1842 feat)
Status: done. Verdict: approve.

## Gates (own run)
- gofmt -l and go vet ./... at 37c1842 (scratch worktree, removed): clean. No go test (manager runs it).
- openspec validate --all --strict: 20 passed, 0 failed.

## Findings
- Minor: no test for 401 (no/non-staff token) or 502 (core failed) on this route; handler relies on RequireStaff/core client, both covered elsewhere. Non-uuid id 404 also untested here (PathID covered elsewhere).
- Note: `dispatch` ignores "store has no location" by design; deferred to task 6 (TestOrderDispatchOffWithoutLocation). Must land before acceptance.
- Test-first order ok (red = compile failure).
