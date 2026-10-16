# rider-P3-L3-T5 - delivery history (worker, task 5)
Status: done (task 5)
## Doing
Red committed (`test: delivery history`); the history page (`feat: delivery history`) passes its three tests. Gates: all green, see Gates.
## Found
- The page uses `GET /me/deliveries?status=delivered&pageSize=50`, one request, no pager (design Decision 13). `Table stack` with the order number as a `Link` to `/deliveries/$deliveryId` (`min-h-11` tap target), customer, pincode, total `Price`, delivered via `when(deliveredAt)`.
- `total > items.length` shows "Showing the latest 50 of <total>."; empty shows `EmptyState` "No deliveries yet" in a `Card`; loading `Skeleton`; failure `ErrorBanner` "Could not load your deliveries." with retry.
- The list is keyed `['rider','deliveries','delivered']`, the key task 4 invalidates after a delivery.
## Requests
None.
## Blockers
None for this task.
## Gates
- Red run (`npm run test --workspace apps/rider -- --run src/history.test.tsx`, exit 1, before the page was written):
```
 × delivered deliveries listed
 × no history
 × more than one page
TestingLibraryElementError: Unable to find role="table" and name "Delivered deliveries"
TestingLibraryElementError: Unable to find role="heading" and name "No deliveries yet"
TestingLibraryElementError: Unable to find role="table" and name "Delivered deliveries"
Tests  3 failed (3)
```
- Green (`src/history.test.tsx`): 3 passed.
- `npm run lint --workspace apps/rider`: exit 0.
- `npm run typecheck --workspace apps/rider`: no error in `history.tsx` or `history.test.tsx`.
- `make test-web` (the first run hit T3's in-progress `ready.test.tsx` TS2769 errors; the retry after a minute passed): exit 0; packages/ui 83, admin 295, rider 57, web 153 tests green; every lint, typecheck and build green.
- `openspec validate --all --strict`: Totals 17 passed, 0 failed.
