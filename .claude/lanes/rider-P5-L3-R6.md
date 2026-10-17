# rider-P5-L3-R6 - review of T6 (2ca646d test, d021746 fix)
Status: done
## Doing
Reviewed in a detached scratch worktree at d021746 (removed after).
## Found
Verdict: approve, no findings.
- Cause fixed: OfferSheet renders OnlineOffer only while online; unmount drops answered/status and, with no observer, gcTime 0 drops the cached offer. No removeQueries needed (test 1 proves it).
- Render-time seenId reset: guarded by offer.id !== seenId, so one extra render, no loop. Clears only on a new non-null id; never on 204; offline clears by unmount.
- Red tests 1-3 fail on 2ca646d's dispatch.tsx (verified: 3 failed, 11 passed), pass at d021746. Pins 4-6 valid (pass on old code; they check Close once, no live region on countdown, no decline after expiry).
- routes() PUT /me/availability echo is additive (default only, `over` still wins); no other test weakened.
- Test-first order ok (2ca646d test before d021746 fix). Scope ok (dispatch.tsx, offer.test.tsx, tasks, design, logs).
## Gates
lint, typecheck clean; test 12 files / 90 passed; build ok; openspec validate --all --strict 21 passed.
