## MODIFIED Requirements

### Requirement: Staff dashboard
`GET /api/core/v1/admin/dashboard` SHALL return `{items}`, one entry per store the staff user can see (all stores by name for an admin, their own for store staff), each with `storeId`, `storeName`, `isOpen` (the store's open switch now), `ordersToday`, `lowStockCount` (active products below quantity 5, no stock row counting as 0) and `revenueTodayCents`.

#### Scenario: Low stock follows stock
- **WHEN** a product at the store goes from quantity 10 to 2
- **THEN** the store's `lowStockCount` grows by 1

#### Scenario: Store staff see their store only
- **WHEN** a store-staff user of store A requests the dashboard
- **THEN** `items` holds exactly one entry, with `storeId` A

#### Scenario: Open switch
- **WHEN** an admin reads the dashboard for an open store, closes it with `PATCH /api/core/v1/admin/stores/{id}` `{"isOpen":false}` and reads it again
- **THEN** the store's entry has `isOpen` true the first time and false the second
