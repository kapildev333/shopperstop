# mobile-P4-L2-T10 - pincode sheet and store change (mobile-serviceability-catalog task 10)
Status: done (10.1 to 10.4 ticked; `pincode-first-visit` is task 11's and stays red until it lands)
## Doing
Stopped and reporting. Two items need a decision by the manager or team lead.
## Found
- Commits: `6620516` test (background pauses focus), `82798b0` test (pincode sheet scenarios), `5058dea` test (first visit opens the pincode sheet), `9d57884` test (sign-in link when signed out), `58f19ee` test (sign-in matchers changed to `router.getPathname()` / `getSearchParams()`, per the coordinator's tip), `2407720` test (sheet opened in an awaited act), `674b6bd` feat (`src/app-focus.ts`), `3d44cbd` feat (`src/pincode-sheet.tsx`, `src/app/_layout.tsx`), `c857cb4` chore (ticks 10.1 to 10.3).
- Green: `src/app-focus.test.ts` (1), `src/pincode-sheet.test.tsx` (7: only digits, invalid refused, saved from sheet, saved address fills, same store or empty cart, store change confirmed, store change kept).
- Red, still: `src/pincode-first-visit.test.tsx` `first visit opens the pincode sheet`, and `src/pincode-sign-in.test.tsx` `sign-in link when signed out`.

## Resolved (team lead, ad87dea)
1. First visit moved to task 11 (`src/pincode-first-visit.test.tsx` left as committed, owned by task 11).
2. Sign-in link: step 1 (`<Link href={{ pathname: '/sign-in', params: { returnTo: '/' } }} asChild>` around the `Pressable`, `onPress={closePincodeSheet}`, no `router.push`) was still red. Step 2 applied: the test waits for Home's heading `Groceries in minutes` and opens the sheet in an awaited `act` (`fc05481`, test-only). With the Link (`bad3a17`) the test is green. Step 2 is the change that turned it green; step 1 alone did not.
- Commits since the earlier list: `fc05481` test (Home wait), `bad3a17` feat (Link), tick commit for 10.4.

## Gates (this worktree, after bad3a17)
- `npm run build --workspace packages/ui`: ok
- `npm run lint --workspace apps/mobile`: clean
- `npm run typecheck --workspace apps/mobile`: clean
- `npm run build --workspace apps/mobile`: ok (Exported: dist)
- `openspec validate mobile-serviceability-catalog --strict`: valid
- `npx jest --ci` (apps/mobile): 158 passed, 1 failed of 159. The one failure is `src/pincode-first-visit.test.tsx` (task 11's).
