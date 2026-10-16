# mobile-P4-L3-T1 - Guest cart module (mobile-cart task 1)
Status: done
## Doing
Task 1 done: `src/cart-guest.ts` and `src/cart-guest.test.ts` green (10/10). Tasks 1.1 and 1.2 ticked. Next lane step is task 3 (`src/cart.ts`), after group A lands.
## Found
- Red run before the module: `npx jest --ci src/cart-guest.test.ts` -> `Cannot find module './cart-guest'` (1 failed suite, 0 tests). Commit `dab1de6` (test).
- Green: `npx jest --ci src/cart-guest.test.ts` -> 10 passed, 10 total.
- Exports follow `docs/design/mobile-P4-L3.md` "Module interfaces": `itemCount` and `mrpTotalCents` take `CartLine[]`; `mergeBodies` and `cartView` take the cart and fees as in web. Nothing imports `src/cart.ts`.
- Storage rule chosen: `dispatchGuest` marks the cart loaded and persists only when the action changes the cart. A no-op dispatch before the read settles leaves the read to load the stored cart. The design file says "memory now and loaded = true" without the no-op case; the literal reading would persist an empty cart over a stored one. Team lead: confirm this reading (see Requests).
- `clearGuestCart()` before the read settles on an empty cart is a no-op by the same rule, so the read still applies. Task 6's merge awaits `loadGuestCart()` first, so the merge path is not affected.
- Gates (2026-10-16, after feat): `npm run build --workspace packages/ui` exit 0; `npm run build --workspace apps/mobile` exit 0 (Exported: dist); `openspec validate mobile-cart --strict` valid; `npx eslint` on the two new files clean.
- Gates outside this task: `npm run lint --workspace apps/mobile` fails on `src/ui/sheet.test.tsx:80` (`prefer-const`) and `npm run typecheck` on `src/ui/sheet.test.tsx:69` (`footer` prop). Both are in the committed task 2 red test `0835803` (`test: footer stays below the scroll`), not in task 1's files. `npm run test --workspace apps/mobile -- --run`: 247 passed, 1 failed (the same footer test); 68 of 69 suites pass.
## Requests
- to mobile-P4-L3 (team lead): confirm the no-op rule in `dispatchGuest` above (design.md Decision 2 and docs/design/mobile-P4-L3.md say "loaded = true" on every dispatch).
- to mobile-P4-L3 (task 2 worker): the lint and typecheck gates stay red until the `footer` feat commit lands.
## Blockers
None.

## Follow-up 1.3 (2026-10-16, team lead decision ed228e7)
- `clearGuestCart()` now always wins over a pending read: marks loaded, emits and removes the stored value even when the cart in memory is already empty. `set` keeps the no-op rule.
- Red: `test: clear before the read settles wins (red)` (`0ed2ef4`), failed with the stored cart winning over the clear (1 failed, 10 passed).
- Green after fix: `src/cart-guest.test.ts` 11 passed; eslint clean on both files; `npm run lint` and `npm run typecheck --workspace apps/mobile` clean; `npm run test --workspace apps/mobile -- --run` 69 suites, 249 tests passed; `npm run build --workspace apps/mobile` exit 0; `openspec validate mobile-cart --strict` valid.
