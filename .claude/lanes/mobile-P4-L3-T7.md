# mobile-P4-L3-T7 - Cart bar (mobile-cart task 7)
Status: done
## Doing
Task 7 done (7.1, 7.2 ticked). Commits `c44a9c9` (`test:` red), `d8f9b64` (`test:` correction, sheet state read in the same tree), `2324334` (`feat:` cart bar and four mounts).
## Found
- Red run: `src/cart-bar.test.tsx` failed with "Cannot find module './cart-bar'"; `src/cart-bar-screens.test.tsx` failed on the four bar-present screens (product screen passed as the negative guard).
- Harness note: RNTL's `screen` reads the most recent render. A `renderHook` call inside the same test replaced the tree, so the bar disappeared from `screen`. The sheet state is read by a small `SheetState` component rendered in the same tree (not `renderHook`, not `<CartSheet />`, which task 5 has not landed on this branch). Corrected in `d8f9b64`.
- Bar mounts: Home after the `ScrollView`, Categories after `StoreGate`, category and search after `StoreGate` with `edge`.
- Test scope beyond the brief: `bar on the home tab` in `cart-bar-screens.test.tsx` (the Home mount had no other test). The product-screen test is a negative guard that passes before the feature.
- The replaced notice text is written in `src/cart-bar.tsx` as a string, the same text task 5 puts in the sheet. Shared constant not introduced (the sheet is another worker's file in this task group); dedupe in a later change if it drifts.
- Gates on `2324334` (working tree): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` FAILS on `src/cart-sheet.tsx(120,46)` (task 5's uncommitted work, not this task); `npm run test --workspace apps/mobile -- --run` 76 suites, 2 failed (`src/cart-sheet.test.tsx`, task 5 red; `src/cart-write-failure.test.tsx`, task 4 red), 287 tests passed, both failing suites are other tasks'; cart-bar suites 8/8 passed; `npm run build --workspace apps/mobile` exit 0 (Exported: dist); `openspec validate mobile-cart --strict` valid.
## Requests
- to mobile-P4-L3 team lead: the typecheck error in `src/cart-sheet.tsx` (task 5) blocks `make test-web` until it lands fixed.
## Blockers
None.
