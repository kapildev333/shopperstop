## ADDED Requirements

### Requirement: Staff dashboard
`GET /api/core/v1/admin/dashboard` SHALL return `{items}`, one entry per store the staff user can see (all stores by name for an admin, their own for store staff), each with `storeId`, `storeName`, `ordersToday` (orders placed today by current status, all seven statuses present), `lowStockCount` (active products below quantity 5, no stock row counting as 0) and `revenueTodayCents` (`totalCents` of orders delivered today).

#### Scenario: Today's orders and revenue
- **WHEN** a store has one order placed today still `placed`, one placed and delivered today with `totalCents` 12500, and one order placed and delivered two days ago, and an admin requests the dashboard
- **THEN** the store's entry has `ordersToday.placed` 1, `ordersToday.delivered` 1, every other status 0, and `revenueTodayCents` 12500

#### Scenario: Low stock follows stock
- **WHEN** a product at the store goes from quantity 10 to 2
- **THEN** the store's `lowStockCount` grows by 1

#### Scenario: Store staff see their store only
- **WHEN** a store-staff user of store A requests the dashboard
- **THEN** `items` holds exactly one entry, with `storeId` A

### Requirement: Dashboard days start at midnight in Bengaluru
The dashboard's "today" SHALL begin at midnight Asia/Kolkata, by the database clock.

#### Scenario: Two days ago is not today
- **WHEN** a store's only order was placed and delivered two days ago
- **THEN** its dashboard entry has every `ordersToday` count 0 and `revenueTodayCents` 0
