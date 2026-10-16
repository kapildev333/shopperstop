# mobile-P4-L2-T10 - pincode sheet and store change (mobile-serviceability-catalog task 10)
Status: partial (10.1 to 10.3 done; 10.4 blocked on two open choices, see Blocked)
## Doing
Stopped and reporting. Two items need a decision by the manager or team lead.
## Found
- Commits: `6620516` test (background pauses focus), `82798b0` test (pincode sheet scenarios), `5058dea` test (first visit opens the pincode sheet), `9d57884` test (sign-in link when signed out), `58f19ee` test (sign-in matchers changed to `router.getPathname()` / `getSearchParams()`, per the coordinator's tip), `2407720` test (sheet opened in an awaited act), `674b6bd` feat (`src/app-focus.ts`), `3d44cbd` feat (`src/pincode-sheet.tsx`, `src/app/_layout.tsx`), `c857cb4` chore (ticks 10.1 to 10.3).
- Green: `src/app-focus.test.ts` (1), `src/pincode-sheet.test.tsx` (7: only digits, invalid refused, saved from sheet, saved address fills, same store or empty cart, store change confirmed, store change kept).
- Red, still: `src/pincode-first-visit.test.tsx` `first visit opens the pincode sheet`, and `src/pincode-sign-in.test.tsx` `sign-in link when signed out`.

## Blocked
1. First visit opens the sheet. The brief's scenario expects the sheet to open at `/` with no pincode, with Home still the placeholder. The design (section 1 and Decision 2) puts that open call in Home, which is task 11, and task 10 does not touch `(tabs)/index.tsx`. No file in task 10's scope can open it without a choice of location (the layout, or the sheet gated on the Home path). Needs a decision.
2. Sign-in link does not navigate in the test harness. The link is found and its press runs (logged), `router.push('/sign-in?returnTo=%2F')` and `router.navigate({ pathname: '/sign-in', params: { returnTo: '/' } })` both dispatch without error, yet `router.getPathname()` stays `/` after a `waitFor`, and the router state holds only `__root`. The sheet is mounted in the root layout, outside the Stack. Not yet known whether the cause is the sheet's placement or the harness. Needs a decision or an alternative mount.

## Gates (last run, this worktree)
- `npm run build --workspace packages/ui`: ok
- `npm run lint --workspace apps/mobile`: clean
- `npm run typecheck --workspace apps/mobile`: clean
- `npm run test --workspace apps/mobile -- --run` (jest --ci): 2 failed, 151 passed of 153. Failing: the two red tests above. Also in the suite, `src/catalog-product.test.tsx` and `src/catalog-product-count.test.tsx` fail (committed red by task 13, `ed0b7c7`, `1510e76`); not this lane's scope.
- `npm run build --workspace apps/mobile`: ok (Exported: dist)
- `openspec validate mobile-serviceability-catalog --strict`: valid

## Next
Manager decides blocker 1 (first-visit location) and blocker 2 (sheet mount or harness). Then 10.4 is ticked in a new commit.
