# rider-P5-L3-R5 - review of T5 (ad1c142, 44f0c18, 50e4913)
Status: done
## Doing
Reviewed; verdict approve with minor findings.
## Found
- Gates at 50e4913 (scratch worktree, removed): rider lint, typecheck clean; test 12 files 84 passed; build ok; openspec validate --all --strict 21 passed.
- Order: test, test, feat. Pin ad1c142 passes on old code by design; bite proof is in the T5 log (enableHighAccuracy true -> 1 failed, 11 passed).
- Accept disables via Button loading (disabled + aria-busy): no double accept. Decline, Close, Escape and expiry are guarded no-ops while pending (Decline stays enabled-looking, no feedback).
- Invalidation: ['rider','ready'] and ['rider','deliveries','assigned'] match ready.tsx keys (duplicated literals, readyKey/assignedKey not exported).
- Reset effect: correct (also runs on mount, harmless; offer going null mid-accept resets the observer but options-level onSuccess/onError still run). Simpler: drop it and render the banner on `accept.isError && accept.variables?.id === offer?.id`.
- Minor: no tests for pending guards (decline/Escape/expiry during pending), 404 path, invalidation. Guards can be deleted with tests green.
## Requests
none
