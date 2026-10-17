# rider-P5-L3-R3 - review of T3 (e998494 test, a969dfc feat)
Status: done - approve

## Verdict
Approve. No blocking findings.

## Checked
- Order: test e998494 then feat a969dfc. At e998494 the six new tests fail (6 failed), at a969dfc all pass.
- Gates at a969dfc in a scratch worktree: lint, typecheck, build exit 0; rider tests 11 files / 73 passed (location.test.tsx untouched, green); openspec validate --all --strict 21 passed.
- watchAndSend cleanup clears the watch and the interval; used on offline (effect [online]), sign-out and unmount (shell unmounts Availability). Tests cover offline and sign-out with 20 s of fake time.
- First fix sent at once, interval starts at first fix (not per change). useLocationReport is a pure extraction: same 15 s, options, setFailed on any error.
- code === 1 only denies; other errors ignored (Decision 3). Missing API denies via the same path.
- useEffectEvent: called only from the effect and a callback created in it; lint (react-hooks) accepts; not in deps, correct.

## Findings (minor, none blocking)
1. location.ts useOnlineReport: no test asserts the options (enableHighAccuracy false, maximumAge 10 s); the fake ignores them. A swapped option passes. Fix if wanted: have fakeGeolocation record the options and assert once.
2. dispatch.tsx onDenied: if the follow-up toggle.mutate(false) fails, onError replaces "Allow location to go online" with "Could not change your status", the rider stays Online with no watch (effect does not rerun) and no position. Matches design Decision 3 cost; note only.
3. availability.test.tsx 'permission refused' asserts bodies [true, false] so the double put is pinned; fine.
