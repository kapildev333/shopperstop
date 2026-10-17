## Context

core-P5-L2 (#360) put an optional `location {lat, lng}` on `Store`, `AdminStore`, `StoreCreate` and `StorePatch` (absent keeps; `null` or a missing half 400 field `location`; out of range 400 `location.lat` or `location.lng`; never cleared; demo Koramangala at 12.9352, 77.6245). `apps/admin/src/store-form.tsx` keeps one string per field in `Values = Record<Field, string>` and builds the body in `parse()`; admin-P4-L1's city work is the pattern. The board (`order-board.tsx`) and the sheet (`order-sheet.tsx`) read core only; the rider service is reached through `riderApi` in `api.ts` (admin-P3-L1). rider-P5-L2 (proposed at 89866db, not merged) adds `GET /api/rider/v1/admin/orders/{orderId}/dispatch`.

The whole change was spiked on `lane/admin-P5-L2-store-location-dispatch` (base 3db68a3), cut into the six patches under `patches/`, re-applied in order on a clean `apps/admin` (result identical to the spike, `diff -r` empty) and the tree restored. Admin Vitest counts per step: base 334; 1.1 red 2 / 336; 1.2 336; 2.1 red 3 / 339; 2.2 339; 3.1 red 4 / 343; 3.2 343. Lint, typecheck and `vite build` clean on the final tree. Task 3 was spiked against a throwaway hand-written stub of rider-P5-L2's types in `packages/ui/src/api/rider.d.ts` (reverted, never committed); its patches typecheck only once rider-P5-L2's regenerated `rider.d.ts` is on main. The e2e steps were not run (the manager holds the slot, and the dispatch step needs rider-P5-L2's service).

## Goals / Non-Goals

Goals: an admin sets, moves and sees a store's coordinates; nothing the form or core refuses is lost silently; staff see, on a ready order, whom dispatch offered it to or why nobody.

Non-goals: clearing a location (core cannot), a map, geocoding the address, a stores-table column, any rider or core change.

## Decisions

1. Two string fields `lat` and `lng` in `Values`; `type Field = keyof Omit<StoreCreate, 'location'> | 'lat' | 'lng'` replaces the `Exclude` stopgap. `parse()` builds `location` only when both are filled and valid; `changed()` takes `location` out of the generic field comparison (an object never equals the store's) and adds it back, whole, when `lat` or `lng` differs numerically from the loaded store (so `12.93520` is no change). Inputs carry no `inputMode`: `decimal` keyboards on iOS lack a minus sign.
2. A coordinate is `^-?\d+(\.\d+)?$` within ±90 or ±180; anything else gets its field's range message. A half alone puts "Enter both latitude and longitude, or neither." on the empty field. Emptying both on a store that has a location is refused locally ("A location can be changed but not removed." on Latitude): sending nothing would answer "Store saved." for a removal that did not happen.
3. Core's field names map through one table `coreFields`: `location.lat` to Latitude, `location.lng` to Longitude, `location` to Latitude with the pair message. Any other field keeps the existing `field in messages` rule; `fieldError()` replaces the inline `serverField` expression.
4. "The store page shows the coordinates under the address" is met by the two inputs themselves, which sit under Address and City; no read-only copy of the same numbers.
5. Dispatch line in a new `src/dispatch.tsx`: `dispatchQuery(orderId)` (key `['rider', 'dispatch', orderId]`, `refetchInterval: pollMs`, so it moves with the board's poll and the sheet shares the card's read), `dispatchText()` (the copy) and `DispatchLine({order, className})`, enabled only while `order.status === 'ready'`. The card renders it after the rider line, the sheet after "Rider:". No line until the first answer or when it fails; a later failure keeps the last line and the root's `RefetchNotice` says so, as for every admin read.
6. Copy, from the coordinator's message on rider-P5-L2's shape: an `offered` offer first, "Offered to <riderName>, <ceil(etaSeconds/60)> min away" (0 s reads "0 min away"); else `dispatch` `off` reads "Dispatch off", plus ": store has no location" when the loaded store has no `location`; else `online` 0 "No rider online"; else "Waiting for a rider".
7. "The loaded store" is read with `GET /stores/{id}` (the public store, which both staff roles may read; key `['stores', storeId]`), enabled only while a dispatch read says `off`. The board route has the admin's `AdminStore` list but store staff only have their store's name, so one read that works for both roles beats threading two sources through the route; it costs nothing while dispatch is on.
8. `Rider` gains `isOnline` with rider-P5-L2; the rider fixtures in `riders-fake.ts` add it as `...{ isOnline: false }`, a spread literal that typechecks before and after the contract change (the #211 pattern).
9. e2e: the location round trip runs at the end of the existing admin stores test, not its own, to keep admin@ one sign-in further from core's 10 per hour; it saves 12.9353 then 12.9352 so the seed is as found. The dispatch step is one assertion inside the existing staff orders test at the Ready step (no seeded rider is online).

## Simplifications and ceilings

- One dispatch read per ready order per poll (`ponytail:` in `dispatch.tsx`); a per-store dispatch read in the rider service if stores hold many ready orders at once.
- "Dispatch off" without a reason also covers the rider service's dispatcher turned off (`SHOPPERSTOP_RIDER_DISPATCH_INTERVAL=0`), which the line cannot tell apart from other `off` causes; only dev and test configs do it.
- The rider service caches the store for 30 s, so a location just set can read "Dispatch off" for up to one more poll.
- No location column, no map, no geocoding; a location cannot be removed from the panel because core has no clear.
- A coordinate below 1e-6 in magnitude (other than 0) is shown by `String()` in scientific notation (`1e-7`), which the form's coordinate check refuses, so any save of such a store is blocked until the field is retyped (review R1). No real store sits within 0.1 m of the equator or the prime meridian; the fix, if ever needed, is `toFixed(7)` with trailing zeros trimmed in `initial()`.

## Files

`apps/admin/src/store-form.tsx`, `store-form.test.tsx`, `dispatch.tsx` (new), `order-board.tsx`, `order-sheet.tsx`, `orders-dispatch.test.tsx` (new), `riders-fake.ts`, `apps/admin/e2e/stores.spec.ts`, `apps/admin/e2e/orders.spec.ts`. All in `apps/admin`.

## Tests (scenario to test)

| Scenario | Test |
|---|---|
| Store location fields > Create a store with a location | `store-form.test.tsx` "create a store with a location sends both coordinates" |
| Store location fields > Location sent only when it moved | `store-form.test.tsx` "the change form shows the location and sends it only when a coordinate changed" |
| Store location the form cannot send > Half a location, or out of range | `store-form.test.tsx` "a location the form cannot send is flagged without a request" |
| Store location the form cannot send > Location emptied | `store-form.test.tsx` "a location can be changed but not removed" |
| Store location errors from core > Location refused by core | `store-form.test.tsx` "location errors from core are shown on their fields" |
| Store location against core > Admin moves a store's location and puts it back | `e2e/stores.spec.ts` "admin edits a store and meets the pincode conflict" (its location steps) |
| Order dispatch line > Offered to a rider | `orders-dispatch.test.tsx` "a ready order's card and sheet name the rider it is offered to and how far away" |
| Order dispatch line > No open offer | `orders-dispatch.test.tsx` "a ready order with no open offer says why: dispatch off at a store with no location, no rider online, or waiting" |
| Order dispatch line > Dispatch off at a located store | `orders-dispatch.test.tsx` "dispatch off at a store that has a location says only that dispatch is off" |
| Order dispatch line follows the board > Failed read, then the poll | `orders-dispatch.test.tsx` "a dispatch read that fails shows no line; the board's next poll reads it again and shows the offer" |
| Dispatch against core > No rider online for a ready order | `e2e/orders.spec.ts` "store staff take the placed order to delivered and find it in History" (its Ready step) |

## Gates

`export PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`; once per worktree `npm ci` and `npm run build --workspace packages/ui`; then `npm run lint --workspace apps/admin`, `npm run typecheck --workspace apps/admin`, `npm run test --workspace apps/admin -- --run`, `npm run build --workspace apps/admin`; `openspec validate admin-store-location-dispatch --strict`. The manager runs `make e2e` with the slot (task 4).

## Risks

- Task 3 is designed on rider-P5-L2's proposed contract (89866db). If its merged `rider.d.ts` renames `OrderDispatch`, the path, or a field, `3.2-dispatch-line.diff` fails typecheck; the worker stops and reports, the team lead re-cuts the patch.
- The e2e "No rider online" needs the rider service in `make e2e` to run its dispatcher (no `SHOPPERSTOP_RIDER_DISPATCH_INTERVAL=0` in `E2E_ENV`) and no rider left online by an earlier suite at Koramangala; otherwise the card reads "Dispatch off" or an offer.
- `rider-dialog.test.tsx` "an admin creates a rider at a store; ..." flaked once under load in admin-P5-L1; a worker reruns once and reports.
