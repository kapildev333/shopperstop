## Why

PLAN.md D57 adds rider dispatch: the rider service offers each `ready` order to the best online rider, and it needs the store's coordinates to rank riders. core-P5-L2 (#360) made `location` settable on stores; staff have no way to set it, and no way to see on the board what dispatch is doing with a ready order. Work package: `.claude/areas/admin.md` "Phase 5 dispatch package" (lane admin-P5-L2).

## What Changes

- Store form: "Latitude" and "Longitude" after "City", optional, both or neither, sent as `location {lat, lng}`; the change form sends `location` only when a coordinate moved. A location can be replaced, never removed (core cannot clear one), so emptying both on a located store is refused before a request. Core's field errors `location`, `location.lat`, `location.lng` show on the fields. The `Exclude<keyof StoreCreate, 'location'>` stopgap (177cbf1) goes: the form's fields are `StoreCreate`'s with `location` as two text fields.
- Board cards and the order sheet, while the order is `ready`: one dispatch line from the rider service ("Offered to <rider>, <n> min away", "Dispatch off" with ": store has no location" when the store has none, "No rider online", "Waiting for a rider"), read with the board's 10 s poll.
- e2e: the stores test round-trips Koramangala's location; the orders test sees "No rider online" on the seeded order at Ready.
- Out of scope: a location column on the stores table (coordinates are not scannable), a map or address geocoding, the store page showing the coordinates anywhere but its two inputs, any change in `packages/ui`, `services/core` or `services/rider`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-app`: ADDED requirements only (store location fields, local and core errors, e2e round trip; the dispatch line, its polling, its e2e). Every existing requirement stays true: a store with both inputs empty sends no `location`.

## Impact

- Area: admin (`apps/admin/`). Files: `src/store-form.tsx`, `src/store-form.test.tsx`, `src/dispatch.tsx` (new), `src/order-board.tsx`, `src/order-sheet.tsx`, `src/orders-dispatch.test.tsx` (new), `src/riders-fake.ts`, `e2e/stores.spec.ts`, `e2e/orders.spec.ts`.
- Contracts relied on: `services/core/openapi.json` and `packages/ui/src/api/core.d.ts` on main (`StoreCreate.location`, `StorePatch.location`, `AdminStore.location`, `Store.location`, 400 fields `location`, `location.lat`, `location.lng`; `GET /stores/{id}` for both staff roles); `services/rider/openapi.json` and `packages/ui/src/api/rider.d.ts` from rider-P5-L2 (not on main yet): `GET /admin/orders/{orderId}/dispatch` answering `OrderDispatch {online, dispatch: on|off, offers: DispatchOffer[]}`, `DispatchOffer {id, riderName, status: offered|accepted|declined|expired, etaSeconds, offeredAt, answeredAt?}`, and `Rider.isOnline`. Task 3 waits on that merge.
