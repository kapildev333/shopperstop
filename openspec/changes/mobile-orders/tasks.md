Every task below is one worker lane. Common to all:

- Area `mobile`; worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4a`; branch `lane/mobile-P4-L4a-orders`; OpenSpec change `openspec/changes/mobile-orders/` (spec: `specs/mobile-app/spec.md`; decisions: `design.md`; drawing and interfaces: `docs/design/mobile-P4-L4a.md`). Paths below are under `apps/mobile/` unless they start with `openspec/`.
- Read first: the scenarios named in your task, `design.md` Decisions, `docs/design/mobile-P4-L4a.md` §5 and §6, and the web code you copy (`apps/web/src/orders.ts`, `order-tracking.tsx`, `order-parts.tsx`).
- Commits: `test: <scenario>` with the failing test first (run it, see it fail), then `feat: <what>` with the smallest code that passes, then any cleanup with the suite green. Commit by explicit path with `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers, never push. Tick your boxes in this file in the `feat:` commit.
- Touch only your scope paths. Shared files (`src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/ui/`, `package.json`, `jest.config.js`, `jest.setup.ts`, `playwright.config.ts`, `e2e/global-setup.ts`, `src/fake-core.ts`) belong to L2: if you need a change there, stop and report it.
- Gates (every task):
  `export PATH="$HOME/.local/node-v22.23.3/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L4a && npm run build --workspace packages/ui && npm run lint --workspace apps/mobile && npm run typecheck --workspace apps/mobile && npm run test --workspace apps/mobile -- --run`
- Any open design choice not answered here: stop and report in your lane log `.claude/lanes/mobile-P4-L4a-T<n>.md`.

Parallel groups (tasks in one group touch disjoint files and may run at once; a group starts when the one before has landed): **A**: 1, 2. **B**: 3, 4, 5, 6 (6 waits for the `Dialog` primitive from L2 or takes the `Sheet` fallback, design.md Decision 6). **C**: 7. **D**: 8 (needs L2's `e2e` script env, design.md Requests 2, and the e2e slot).

## 1. Order logic (`src/orders.ts`) — group A

LANE-ID `mobile-P4-L4a-T1`. Scope: `src/orders.ts`, `src/orders.test.ts`. Scenarios: Placed time wording; Status names and badges; Headline wording; Poll interval follows the status. Start from `src/orders.test.ts` test `Headline wording` (red: module missing). Then copy web's helpers and queries per `docs/design/mobile-P4-L4a.md` §5, with `postCancel(id, reason?)` sending `{ reason }` or `{}` and `cancelOrder(id, reason?)` passing it on. Add one unit test each for `timeline` (packing order; cancelled order; rider actor lines), `itemCountLabel`, `productCountLabel` and `clockTime`, under their scenario-named tests or as `timeline steps of a packing order` etc.

- [x] 1.1 `test:` the four scenarios plus the `timeline`, label and `clockTime` unit tests, red
- [x] 1.2 `feat:` `src/orders.ts` per §5; gates green

## 2. Rider read (`src/rider.ts`) — group A

LANE-ID `mobile-P4-L4a-T2`. Scope: `src/rider.ts`, `src/rider.test.ts`. Scenarios: Default rider URL; Rider read follows the status; Last seen wording. Start from `src/rider.test.ts` test `Default rider URL` (red). `rider.ts` must not import `src/orders.ts` (T1 runs in parallel). Also test `mapsUrl(12.9352, 77.6245)` is `https://www.google.com/maps?q=12.9352,77.6245` and that `deliveryOptions`' query function answers `null` on a 404 from the fake (key `'GET /api/rider/v1/orders/<id>/delivery'`, design.md Decision 3).

- [x] 2.1 `test:` the three scenarios plus `mapsUrl` and the 404-is-null read, red
- [x] 2.2 `feat:` `src/rider.ts` per §5; gates green

## 3. Orders tab (`src/app/(tabs)/orders.tsx`) — group B, after 1

LANE-ID `mobile-P4-L4a-T3`. Scope: `src/app/(tabs)/orders.tsx`, `src/orders-history.test.tsx`, `src/orders-history-open.test.tsx`, `src/orders-history-sign-in.test.tsx`, `src/orders-history-start.test.tsx`, `src/orders-history-return.test.tsx`, `src/orders-history-return-failed.test.tsx`. Scenarios: History lists orders; Signed-out Orders tab; Orders loading; No orders yet; Orders fail to load (in `orders-history.test.tsx`, none of them navigating); Card opens the order; Sign in from the Orders tab; Start shopping opens Home; Statuses current on return; Failed read on return keeps the list (one per file, named above). Start from `src/orders-history.test.tsx` test `History lists orders` (red: the placeholder shows "Nothing here yet"). Every test renders through `renderRouter(`${__dirname}/app`, { initialUrl: '/orders' })` (the tab uses `useFocusEffect`, design.md Decision 4) with the fonts mock of `src/account-home.test.tsx`. "Card opens the order" needs the tracking route: if T4 has not landed, register `GET /orders/<id>` in the fake and assert the path only, then add the heading assertion once T4 is in (note it in your log). Drawing: `docs/design/mobile-P4-L4a.md` §1. If `/orders/<id>` does not resolve to `src/app/orders/[id].tsx` beside the tab, stop and report (design.md Risks).

- [x] 3.1 `test:` the ten scenarios, red
- [x] 3.2 `feat:` the Orders tab; gates green

## 4. Tracking screen (`src/app/orders/[id].tsx`, `src/orders-tracking.tsx`) — group B, after 1

LANE-ID `mobile-P4-L4a-T4`. Scope: `src/app/orders/[id].tsx`, `src/orders-tracking.tsx`, `src/orders-tracking.test.tsx`, `src/orders-tracking-redirect.test.tsx`, `src/orders-tracking-help.test.tsx`, `src/orders-tracking-not-found.test.tsx`. Scenarios in `orders-tracking.test.tsx` (non-navigating; render `<OrderTracking id=… />` in `QueryClientProvider` like `src/account.test.tsx`): Tracking shows the order; Finished order labels; Unknown order; Tracking loading; Tracking fails with nothing held; Status change announced in place; Cancelled order shows the reason; Timeline of a packing order; Timeline of a cancelled order; Rider steps name the rider; Failed poll keeps the order; Headline kept current (fake-timer recipe, §6). Navigating, one per file: Signed-out tracking redirect; Need help opens the account; Your orders from an unknown order. Start from `src/orders-tracking.test.tsx` test `Tracking shows the order` (red). The route file reads `useLocalSearchParams<{ id: string }>()` and renders `<OrderTracking id={id} />`. Export `Headline` for its test. Do not add the rider card or the cancel button: T7 mounts them. Drawing: §2.

- [x] 4.1 `test:` the fifteen scenarios, red
- [x] 4.2 `feat:` the tracking screen; gates green

## 5. Rider card (`src/rider-card.tsx`) — group B, after 1 and 2

LANE-ID `mobile-P4-L4a-T5`. Scope: `src/rider-card.tsx`, `src/rider-card.test.tsx`. Scenarios: Rider on the way with a position; Rider without a position; No rider card before a rider; Delivered order names the rider from the rider read; Failed rider read keeps the card. Start from `src/rider-card.test.tsx` test `Rider on the way with a position` (red). Render `<RiderCard order={…} />` in `QueryClientProvider`; the rider fake key is the full path (§6); "carried the customer's bearer" reads the `Authorization` header of the recorded request; "Open in Maps" uses the `Linking.openURL` spy (§6); "Failed rider read keeps the card" swaps fetch to reject, then `refetchQueries` on `deliveryKey`. Drawing: §3.

- [x] 5.1 `test:` the five scenarios, red
- [x] 5.2 `feat:` `RiderCard`; gates green

## 6. Cancel dialog (`src/orders-cancel.tsx`) — group B, after 1

LANE-ID `mobile-P4-L4a-T6`. Scope: `src/orders-cancel.tsx`, `src/orders-cancel.test.tsx`. Scenarios: Cancel dialog contents; Keep order; Order cancelled without a reason; Cancel refused. Start from `src/orders-cancel.test.tsx` test `Cancel dialog contents` (red). Render `<CancelOrderDialog order={placed} open onClose={onClose} />` in `QueryClientProvider`. Use `Dialog` from `src/ui/dialog.tsx` if it is on the lane branch when you start, else `Sheet` from `src/ui/sheet.tsx` (design.md Decision 6); say which in your log. "Buttons are Keep order and then Cancel order": the order of `getAllByRole('button')` filtered to those two names. "Cancel refused" with 409 also asserts a later `GET /orders/<id>` in the recorded calls. The confirm is guarded against a second press while pending (a `useRef`, as `src/app/account.tsx` row actions). Drawing: §4.

- [x] 6.1 `test:` the four scenarios, red
- [x] 6.2 `feat:` `CancelOrderDialog`; gates green

## 7. Rider card and cancel on the tracking screen — group C, after 4, 5 and 6

LANE-ID `mobile-P4-L4a-T7`. Scope: `src/orders-tracking.tsx`, `src/orders-tracking-cancel.test.tsx`. Scenarios: Cancel offered while placed or accepted; Order cancelled with a reason. Start from `src/orders-tracking-cancel.test.tsx` test `Cancel offered while placed or accepted` (red). Mount `<RiderCard order={order} />` after the timeline card and, when `canCancel(order.status)`, the "Cancel order" button that opens `CancelOrderDialog` (§2). Check "Order cancelled with a reason" end to end on the screen: the body `{"reason":"Ordered by mistake"}`, the dialog closed, the status text, no "Cancel order".

- [x] 7.1 `test:` the two scenarios, red
- [x] 7.2 `feat:` mount the rider card and cancel; gates green

## 8. Orders e2e (`e2e/orders.spec.ts`) — group D, after 7

LANE-ID `mobile-P4-L4a-T8`. Scope: `e2e/orders.spec.ts`. Scenarios: History and a delivered order against core; Tracking follows the order against core; Cancel against core. Start from `e2e/orders.spec.ts` test `History and a delivered order against core`, committed red before any fix. Before starting, check `package.json`'s `e2e` script sets `EXPO_PUBLIC_RIDER_URL=http://localhost:18081` (L2, design.md Requests 2); if not, stop and report. Ask the manager for the e2e slot. Helpers inline (design.md Decision 9; copy from `apps/web/e2e/shopper.ts` with absolute `http://localhost:18080/api/core/v1` URLs, token key `shopperstop.customer-token`, picks 0 and 1). Staff: `POST /admin/auth/sign-in` `koramangala@shopperstop.local` / `staff12345`, then `POST /admin/orders/{id}/status` with `{"status": …}` for `accepted`, `packing`, `ready`, `out_for_delivery`, `delivered`. Wait for `getByRole('dialog')` before axe on the dialog. A reload on `/orders/<id>` that does not show the order: stop and report (design.md Decision 9). An axe violation on react-native-web markup: stop and report; no rule switched off.

- [ ] 8.1 `test:` the three scenarios, red
- [ ] 8.2 green (fixes only inside the lane's scope, each with its own reason in the commit message); `npm run e2e --workspace apps/mobile` and `make e2e` (with the PATH prefix) exit 0; gates green

## 9. Acceptance

- [ ] 9.1 Team lead `/opsx:verify`: every scenario maps to a passing test (design.md "Scenario to test"), every task ticked, nothing outside the scope paths, `openspec validate --all --strict` green
- [ ] 9.2 Manager: gates, `make e2e`, the walk at 390×844 on the web export and once in Expo Go (history, a delivered order with the rider card, cancel), PR
