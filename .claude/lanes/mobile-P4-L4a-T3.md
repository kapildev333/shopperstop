# mobile-P4-L4a-T3 - Orders tab (src/app/(tabs)/orders.tsx)
Status: done
## Doing
Task 3 landed: test commits 2fe6bbf (red) and 05b3e40 (helper fixes), feat commit fc949b0 (green for the six suites, 10 tests). Tasks 3.1 and 3.2 ticked.
## Found
- Scenarios in `orders-history.test.tsx` (5), `orders-history-open|sign-in|start|return|return-failed.test.tsx` (one each). All render through `renderRouter(`${__dirname}/app`, { initialUrl: '/orders' })` with the fonts mock.
- `renderRouter` returns no `navigate`: the tests use `testRouter.navigate` from `expo-router/testing-library`. Tab switches in tests are `testRouter.navigate('/')` then `'/orders'`.
- The tab refetches on focus after the first (a `useRef` skips the mount's focus). Signed out it does not refetch.
- Combined card line is one string: "Today, 10:02 · 1 item", so tests assert the whole string.
- `formatInr` comes from `@shopperstop/ui/format` (the ui `dist` must be built, as the gate does).
- "Card opens the order" asserts the path `/orders/00000000-0000-4000-8000-000000000703` only. The heading assertion ("Order SS-DEMOAAAD") is NOT yet added: `src/app/orders/[id].tsx` is T4's, not on the branch when T3 landed. Add it after T4 lands.
- Gates at T3 landing: `npm run build --workspace packages/ui` ok; `npm run lint --workspace apps/mobile` and `typecheck` fail only in `src/rider-card.test.tsx` (T5's uncommitted red test: unused `ready`, boolean to `void` in the `act`/`waitFor` line). Full `npx jest --ci`: 143 passed, 2 failed (`rider-card.test.tsx`, `orders-tracking.test.tsx`, both other tasks' red tests).
## Requests
- to mobile-P4-L4a-T4 (via this log): when `src/app/orders/[id].tsx` lands, add the heading assertion to `orders-history-open.test.tsx` ("Order SS-DEMOAAAD").
## Blockers
None. The Orders-tab gates are green for its own files; the lint and typecheck failures above are T5's.
