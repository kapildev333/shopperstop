# core-P2-L7-review-t1 - review of core-P2-L7 task 1 (core-last-active-admin)
Verdict: approve. No blocking findings.

Gates (worktree, GOFLAGS=-count=1): `make test-core` exit 0 (internal/app ok 81s); `make gen postman` leaves git status clean; `openspec validate --all --strict` 15 of 15 passed.
Test-first: at 79eac9c (test only) `TestDeactivateLastActiveAdmin` and `TestAdminsDeactivateEachOtherAtOnce` fail; the other two pass as designed. The feat commit turns them green.
Scope: only services/core, core.d.ts, docs/postman, tasks.md, the lane log.
Code matches design.md verbatim: lock query sorts in SQL (`order by id for update`), same order for all callers so no deadlock; the 409 returns from inside BeginFunc so the transaction rolls back before UpdateStaff (name not saved, asserted by GET /admin/me); EqualFold covers the uppercase id (asserted); store staff and inactive targets are not refused because the guard only fires when the single locked row is the target.

Findings (all minor, no change required):
1. services/core/internal/app/staff_test.go (concurrency test goroutines): `call` is used from goroutines; if it calls t.Fatal there it is unsafe, but only on an already failing path. Ignore unless it flakes.
2. Same test: a round whose loser gets 401 is not distinguished from 409, so the guard path is not proven in every round; accepted by the design and spec.
3. staff.go: every PATCH now opens a transaction, even for name-only patches (design Decision 1, intended).
