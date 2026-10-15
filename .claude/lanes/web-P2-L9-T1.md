# web-P2-L9-T1 - web-phone-banner task 1: phone banner labels and pincode sheet focus (worker)
Status: done
## Doing
Committed: `b1bfea0` test (failing tests), then the fix commit (Decisions 1 to 3). Vitest, lint, typecheck, build and openspec validate green. Playwright not run (manager runs it).
## Found
- Red evidence (before the fix): Vitest `pincode-sheet.test.tsx` shows exactly two failures, "first visit focuses the pincode field" and "banner control focuses the pincode field" (focus on the sheet's Close button). The other 140 tests pass.
- Playwright `phone-layout.spec.ts`: `phone` › "signed-in banner on a phone" is red by design on the link width and promise height (not run by the worker). `six columns` › "signed-in banner on desktop" is a pin.
- The fix is in `PincodeSheet` (a ref and a passive effect), with no change to `packages/ui`.
## Requests
- to web manager: run `make e2e` on `b1bfea0` (expect red on "signed-in banner on a phone"), then on the fix commit (expect green for both e2e tests and the existing `account.spec.ts` / `phone-layout.spec.ts` tests).
## Blockers
