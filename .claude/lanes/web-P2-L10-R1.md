# web-P2-L10-R1 - review of web-cart-write-failure task 1 (reviewer)
Status: done
## Doing
Reviewed 24436e4..8e26508 against the spec delta, design and brief. Verdict: approve with nits.
## Found
- Gates re-run: packages/ui build, web lint, typecheck, Vitest 147 of 147 (26 files), web build, `openspec validate web-cart-write-failure --strict` all green. Cart test files 27 of 27 on three runs.
- All five scenarios have a test; test commits precede the feat; changes stay inside brief paths.
- Nits: (1) cart.ts:134 the mid-flight overtaken branch (`turn !== mine` after the call) has no test; the overtaken test only exercises the skip at the top. (2) cart.ts:133 the failure is returned only after `invalidateQueries` is awaited, so an unreachable core delays the banner by the refetch time.
## Requests
(none)
## Blockers
(none)
