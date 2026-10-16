# rider-P3-L2 - deliveries (OpenSpec change rider-deliveries)
Status: started (team lead: change proposed; waiting for workers)
## Doing
Team lead: `rider-deliveries` proposed and committed; `openspec validate rider-deliveries --strict` valid, `--all --strict` 16 passed. Answering worker questions here.
## Found
- Change `openspec/changes/rider-deliveries/`: proposal, `specs/deliveries/spec.md` (10 ADDED requirements, largest body 399 characters, each with WHEN/THEN scenarios), design.md (15 decisions, data model, interfaces, test strategy), tasks.md (5 worker tasks, 1 manager task). No MODIFIED delta on `rider-service` (the delivery seed is its own ADDED requirement), so the change does not depend on the archive PR #208. No `docs/design/rider-P3-L2.md`.
- Order: 1 -> 2 -> 3 -> (4 and 5 in parallel: disjoint paths) -> 6 (manager).
- Core's delivered demo order is `...0701` `SS-DEMOAAAB` (confirmed in core `internal/seed`); total 33900, items Banana Robusta x2 and Shimla Apple x1 (1 kg each).
- Additions beyond the work package, recorded in design.md: `items jsonb` snapshot on `deliveries` (the app's delivery page needs the lines; Decision 8); `auth.bearer` exported as `Bearer` (Decision 2); a service-token 401 or 403 from core is a 502, never a 401 (Decision 5); `CustomerFromToken` not built, ownership via core `GET /orders/{id}` (Decision 6); location shown to the customer only while assigned and recorded after the claim (Decision 7); ready list `{items}` without paging, oldest first, one core page of 100 (Decision 9).
- For rider-P3-L3: `Delivery` has `items`, `itemCount`, `customerPhone?`, `address {line1, line2?, pincode}`, `paymentMethod`, `totalCents`; claim 409 is `conflict` with message "order already claimed" or "order is not ready for pickup"; a 502 from the rider service never means the session ended.
## Requests
- to platform (via the area plan): none new; `deliveryId` `...0901` in the Postman environment is already right and task 5 ties it to the seed.
## Blockers
None.
