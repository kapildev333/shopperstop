# web-P3-L1-T3 - web-rider-tracking task 3: ui swaps, ChoiceGroup at checkout and ImageTile everywhere (worker)
Status: doing
## Doing
2026-10-15: commit 1 (red): the five checkout tests and the three e2e address locators moved to radios. Task 3.1 ticked.
## Found
- Red on commit 1: exactly five failing in `src/checkout.test.tsx` (24 tests, 19 pass): "default address chosen", "another address chosen", "address not served", "choosing another address clears the refusal alert", "the address choice is named by its visible text".
- Gates on commit 1: `npm run lint --workspace apps/web` exit 0; `npm run typecheck --workspace apps/web` exit 0.
## Requests
None.
## Blockers
None.
