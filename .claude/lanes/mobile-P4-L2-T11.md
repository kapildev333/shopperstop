# mobile-P4-L2-T11 - Home and Categories tab (mobile-serviceability-catalog task 11)
Status: done (tasks 11.1 to 11.3 ticked in the feat commit)
## Doing
Nothing open in this task.
## Found
- Commits on `lane/mobile-P4-L2-serviceability-catalog`: `e46ee3d` test (red: `src/catalog-home.test.tsx` six scenarios, `src/catalog-home-search.test.tsx`, `src/catalog-categories-tab.test.tsx`, and the L1 heading updates in `shell.test.tsx`, `shell-tabs.test.tsx`, `account-sign-out.test.tsx`, `account-home.test.tsx` (pincode only), `pincode-sign-in.test.tsx`, and `e2e/accounts.spec.ts`); `c92c841` test (harness corrections, see below); `ba7b1aa` feat (`src/app/(tabs)/index.tsx`, `src/app/(tabs)/categories.tsx`, tasks 11.1 to 11.3 ticked); this log's chore commit follows.
- Red reasons before the feat: each test failed on the missing element it names (heading "ShopperStop in 10 minutes", "Delivering to 560034", "Shop by category", the search button, the category link), not on the harness.
- Harness gotcha, found and fixed in `c92c841`: `fireEvent.press` without `await` (RNTL 14 is async) leaves an overlapping `act()` that breaks the next `renderRouter` in the same file. The symptom looked like a leak from a sheet-opening test (the next render showed an empty tree). Every `fireEvent` in the task 11 files is now awaited.
- `src/pincode-first-visit.test.tsx` is unchanged from T10's commit: it goes green with Home's effect alone.
- Home's effect: `useEffect(() => { if (loaded && !pincode) openPincodeSheet() }, [loaded, pincode])`. It fires once per mount; a closed sheet is not reopened until Home remounts.
- Header: the heading is a `Text` with `accessibilityLabel` "ShopperStop in <N> minutes" (eyebrow "ShopperStop in" above "<N> minutes"); without an open store the heading is "ShopperStop" alone. Button "Delivering to <pincode>" or "Choose pincode". The search field is a button "Search products" (only with an open store) that pushes `/search`; its visible copy is the design file's `Search "milk"`.
- Notices: `StoreGate` is unchanged. With no pincode, "Choose pincode" appears twice (header and notice); the test presses the last one.
- ProductCard is used unchanged inside a 148-wide `View` for the picks rail (no `width` prop added, so `src/catalog-card.tsx` and `src/catalog.ts` are not touched; task 14's landing did not need them either).
- Categories tab: `StoreGate` then a `ScrollView` of `CategoryGrid` (categories query with the skeleton and error branches); the L1 "Nothing here yet" placeholder is gone.
- Not touched: `src/app/(tabs)/_layout.tsx`, `src/catalog.ts`, `src/catalog-card.tsx`, `src/serviceability*`.
- Outside the brief's list, flagged for the team lead: (1) `src/pincode-sign-in.test.tsx` heading wait changed to `/^ShopperStop/` (T10's file; it named the old heading and would otherwise fail); (2) `e2e/accounts.spec.ts` line 67 changed to `getByRole('heading', { level: 1, name: /shopperstop/i })` as the brief asked (the e2e run is task 16's slot; not run here).
- Latest docs commit on the branch (`3ac6396`, task 15 follow-up) adds `Delivering to <pincode>, <city>`. Task 11 does not carry it; task 15 owns the city line in `index.tsx`.
- Gates (worktree root, PATH line from the brief), after `ba7b1aa`:
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0.
  - `npm run typecheck --workspace apps/mobile`: exit 0.
  - `npm run test --workspace apps/mobile -- --run`: exit 0, `Test Suites: 50 passed, 50 total`, `Tests: 171 passed, 171 total`.
  - Task 11 suites alone (`npx jest --ci`): 9 suites, 15 tests, no `console.error` (no act or overlapping-act warnings).
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `openspec validate mobile-serviceability-catalog --strict`: `Change 'mobile-serviceability-catalog' is valid`.
## Requests
- to team lead: confirm the two out-of-list edits above (`pincode-sign-in.test.tsx` heading wait; `e2e/accounts.spec.ts` line 67, the brief's e2e line).
## Blockers
None.
