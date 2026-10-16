# mobile-P4-L3-T2 - Sheet footer (mobile-cart task 2)
Status: done
## Doing
Task 2 done: `Sheet` takes `footer?: ReactNode`, rendered after the `ScrollView`. Task 2.1 ticked. Gates green except the task 1 red test noted below.
## Found
- Red: `npx jest --ci src/ui/sheet.test.tsx` -> `footer stays below the scroll` fails (`Proceed` not rendered; 5 existing tests pass). Commit `0835803` (`test: footer stays below the scroll`).
- Green: `npx jest --ci src/ui/sheet.test.tsx` -> 6 passed, 6 total. Commit `e7ee032` (`feat: sheet footer stays below the scroll`), also ticks tasks.md 2.1.
- Cleanup: `05ce47b` makes a test binding `const` (lint `prefer-const`, flagged by T1's log).
- Gates (2026-10-16, after `05ce47b`): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npm run build --workspace apps/mobile` exit 0 (Exported: dist); `openspec validate mobile-cart --strict` "Change 'mobile-cart' is valid"; `node --test scripts/*.test.mjs` 7 pass, 0 fail.
- `npm run test --workspace apps/mobile -- --run` fails in `jest --ci` on `src/cart-guest.test.ts` > `clear before the read settles wins` (`expect(read).resolves.toEqual(emptyCart)`). That test is the red commit `0ed2ef4` from task 1's worker (follow-up for task 1.3, Decision 2), not this task's files. The other 248 tests pass. Because jest fails, the chain stops before the node scripts; I ran them separately (above). Not touched by me.
- Sheet a11y untouched: dialog named by title, `RCTScrollView` scroll cap and `keyboardShouldPersistTaps` still asserted by the existing tests.
## Requests
- to mobile-P4-L3 (team lead / task 1 worker): `src/cart-guest.test.ts` > `clear before the read settles wins` is red on the branch; task 1's worker owns it. The full `make test-mobile`-style gate stays red until it is green.
## Blockers
None for task 2.
