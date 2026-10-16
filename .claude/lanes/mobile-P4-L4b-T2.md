# mobile-P4-L4b-T2 - address card and choice (`src/checkout-address.tsx`, task 2 of mobile-checkout)
Status: done
## Doing
Done: test commit 981b00e (red: module missing), test commit 0fec71d (selector fix, see Found), feat commit dd56ec7, tick commit 463a2a6. Tasks 2.1 and 2.2 ticked.
## Found
- Red before feat: `npx jest --ci src/checkout-address.test.tsx` → `Cannot find module './checkout-address' from 'src/checkout-address.test.tsx'`.
- RNTL does not match the radio group by role: a `View` with `accessibilityRole="radiogroup"` and no `accessible` is not found by `getByRole('radiogroup', { name })`. The brief allows the label lookup, so the tests use `getByLabelText('Deliver to')`. The View stays non-accessible on purpose (`accessible` would hide the radios from VoiceOver). Radio rows are found by `getByRole('radio', { name: 'Deliver to <label>' })` as designed.
- `toHaveTextContent` on a radio row host View reads empty; the badge assertions use `within(row).getByText('Not delivered here')` instead.
- "Add address" in the choice sheet is outside the radio group View, so tests find it by `screen`, not `within(group)`.
- New address picked by id difference, read from `queryClient.getQueryData(['addresses', token])` at close (not the callback's `addresses.data`, which can be one render old when the save's refetch resolves). L1's address sheet untouched.
- `chosenAddress` and `addressLine` exported from `src/checkout-address.tsx` as the design's module interfaces name them.
- Gates on the worktree (after commit 463a2a6): `packages/ui` build exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npx jest --ci src/checkout-address.test.tsx` 6/6; full `npm run test --workspace apps/mobile -- --run`: 81 of 82 suites pass, 327 of 328 tests; the one failure was `src/account.test.tsx` "Profile shown" under parallel load (passes alone, 13/13, rerun); `npm run build --workspace apps/mobile` exit 0 (expo export); `openspec validate mobile-checkout --strict` valid.
- F1 (`mobile-P4-L4b-F1.md`) noted `checkout-address.test.tsx` red in the shared worktree; that is green now with dd56ec7.
## Requests
none
## Blockers
none
