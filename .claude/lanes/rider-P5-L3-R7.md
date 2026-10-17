# rider-P5-L3-R7 - review of T7 (84b0c6f, ce6dd64, d21e8ed, 659eb73)
Status: done

Verdict: approve. No findings that block.

Gates (scratch worktree at 659eb73): rider lint clean, typecheck clean, test 12 files / 94 tests green, build ok, `openspec validate --all --strict` 21 passed.

Checked:
- Test-first order: test, fix, refactor, ticks. Test 1 red only on toBeDisabled; tests 2 to 4 are pins, said so.
- Decline `disabled={accepting}`; `isPending` guards kept in decline and expire; bite proof recorded (both guards).
- Banner gate `accept.isError && accept.variables?.id === offer?.id`: o1 fails, o2 arrives, banner hidden (test 4 would fail if the gate were dropped); o1's own failure still shows; unmount offline drops the mutation. Correct.
- Keys exported from ready.tsx, no behaviour change, no import cycle.
- Scope: only the listed files.

Deviations:
1. Spy on invalidateQueries with exact keys: sound. toHaveBeenCalledWith compares keys deeply, so a wrong key fails. It pins the call, not the refetch effect, which is the intent. Spy is installed after renderApp but before the accept, fine.
2. Fixed offer for test 1: correct, needed for the countdown to expire.

Nits (not blocking): the tests hardcode the literal keys rather than importing readyKey/assignedKey, which is a fair independent pin. After a skipped expire, the interval is already cleared, so a later non-409/404 failure leaves a 0 s sheet until the next poll returns 204; accepted by the design.
