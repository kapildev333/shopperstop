# rider-P4-L3-R1 - Review of T1 (914c87a..c480eba)
Status: done, approve

## Checked
- Order: fa2a961 test (9 red, re-run on that commit: 9 failed / 52 passed, the nine named) then c480eba feat (61 green). Correct.
- Deltas: ADDED envelope requirement covered by the three-row test.each; MODIFIED "Rider lost session" new 401 mid-session scenario covered and pins onUnauthorized wiring.
- Code equals design.md "Task 1: code". api.ts: rider client gets session + onUnauthorized -> router clean-up; core client has no session (never gets the token); key `shopperstop:rider-token`. Old behaviour kept: 401 only to current token, envelope fallback with status. `getToken()` now undefined: only `!getToken()` guards in routes/_rider.tsx, safe.
- Scope: only brief paths plus lane file and tasks.md.
- Gates (scratch worktree at c480eba): lint, typecheck, test 61/61, build all clean.

## Found
Nit: rider-P4-L3-T1.md still says `Status: blocked` though its Blockers section says resolved; set to done.
Nit: stricter envelope (needs string message) is a documented decision (Decision 5), not a finding.
