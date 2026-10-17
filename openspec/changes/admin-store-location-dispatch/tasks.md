Each task applies its two patches from `patches/` in order with `git apply` (test patch, see it red, commit `test:`; code patch, see it green, commit `feat:`). Expected admin Vitest counts are in design.md "Context". Tasks run in order: they share `store-form.tsx` and `store-form.test.tsx` (1, 2), and 3 waits on rider-P5-L2.

## 1. Latitude and Longitude on the store form (admin-P5-L2-T1)

Scope: `apps/admin/src/store-form.tsx`, `store-form.test.tsx`. Scenarios: "Store location fields" > "Create a store with a location", "Location sent only when it moved".

- [x] 1.1 `test:` apply `patches/1.1-location-fields-tests.diff`: `store-form.test.tsx` "create a store with a location sends both coordinates" and "the change form shows the location and sends it only when a coordinate changed" (`keepsStore` takes a start store); see 2 fail (336 total)
- [x] 1.2 `feat:` apply `patches/1.2-location-fields.diff`: `Field` with `lat`/`lng` instead of the `Exclude` stopgap, the two inputs after City, `location` in `parse()`, `changed()` comparing the location by number; 336 pass

## 2. Location errors, local and from core; e2e round trip (admin-P5-L2-T2)

Scope: `apps/admin/src/store-form.tsx`, `store-form.test.tsx`, `apps/admin/e2e/stores.spec.ts`. Scenarios: "Store location the form cannot send" > "Half a location, or out of range", "Location emptied"; "Store location errors from core" > "Location refused by core"; "Store location against core" (written here, run in task 4).

- [ ] 2.1 `test:` apply `patches/2.1-location-errors-tests.diff`: "a location the form cannot send is flagged without a request", "a location can be changed but not removed", "location errors from core are shown on their fields", and the location steps at the end of `e2e/stores.spec.ts` "admin edits a store and meets the pincode conflict"; see 3 fail (339 total)
- [ ] 2.2 `feat:` apply `patches/2.2-location-errors.diff`: coordinate checks, the pair and not-removed messages in `parse(values, store)`, `coreFields` and `fieldError()`; 339 pass

## 3. Dispatch line on ready cards and the sheet (admin-P5-L2-T3, waits on rider-P5-L2 on main)

Scope: `apps/admin/src/dispatch.tsx` (new), `order-board.tsx`, `order-sheet.tsx`, `orders-dispatch.test.tsx` (new), `riders-fake.ts`, `apps/admin/e2e/orders.spec.ts`. Scenarios: "Order dispatch line" > all three; "Order dispatch line follows the board" > "Failed read, then the poll"; "Dispatch against core" (written here, run in task 4). Starts only once rider-P5-L2's regenerated `packages/ui/src/api/rider.d.ts` (with `OrderDispatch` and `/admin/orders/{orderId}/dispatch`) is on main and the branch is rebased onto it.

- [ ] 3.1 `test:` apply `patches/3.1-dispatch-line-tests.diff`: `dispatchRoute` and `isOnline` on the rider fixtures in `riders-fake.ts`; `orders-dispatch.test.tsx` (4 tests); the Ready-step assertion in `e2e/orders.spec.ts`; see 4 fail (343 total)
- [ ] 3.2 `feat:` apply `patches/3.2-dispatch-line.diff`: `dispatch.tsx` (`dispatchQuery`, `dispatchText`, `DispatchLine`), the line on the card and in the sheet; 343 pass

## 4. e2e against core and the rider service (area manager)

- [ ] 4.1 (area manager) `make e2e` with the slot, after task 3: admin `stores.spec.ts` and `orders.spec.ts` pass with the new steps, and every other suite stays green
