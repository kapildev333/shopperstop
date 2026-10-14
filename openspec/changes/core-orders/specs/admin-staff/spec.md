## ADDED Requirements

### Requirement: Staff dashboard
`GET /api/core/v1/admin/dashboard` SHALL return `{items}`, one entry per store the staff user can see (all stores by name for an admin, their own for store staff), each with `storeId`, `storeName`, `ordersToday`, `lowStockCount` (active products below quantity 5, no stock row counting as 0) and `revenueTodayCents`.

#### Scenario: Low stock follows stock
- **WHEN** a product at the store goes from quantity 10 to 2
- **THEN** the store's `lowStockCount` grows by 1

#### Scenario: Store staff see their store only
- **WHEN** a store-staff user of store A requests the dashboard
- **THEN** `items` holds exactly one entry, with `storeId` A

### Requirement: Dashboard counts orders by placement and revenue by delivery
`ordersToday` SHALL hold, for each of the seven statuses, the number of the store's orders placed today that are in that status now, every status present. `revenueTodayCents` SHALL be the sum of `totalCents` of the store's `delivered` orders whose delivery time is today, whenever they were placed. An order placed before today SHALL be in no `ordersToday` count, also when it is delivered today.

#### Scenario: Today's orders and revenue
- **WHEN** a store has one order placed today still `placed`, one placed and delivered today with `totalCents` 12500, and one order placed and delivered two days ago, and an admin requests the dashboard
- **THEN** the store's entry has `ordersToday.placed` 1, `ordersToday.delivered` 1, every other status 0, and `revenueTodayCents` 12500

#### Scenario: Placed yesterday, delivered today
- **WHEN** a store has three delivered orders, A placed and delivered one minute before today's midnight Asia/Kolkata with `totalCents` 1111, B placed and delivered one minute after it with 2222, and C placed one minute before and delivered one minute after it with 3333
- **THEN** its dashboard entry has `ordersToday.delivered` 1, every other status 0, and `revenueTodayCents` 5555

### Requirement: Dashboard days start at midnight in Bengaluru
The dashboard's "today" SHALL begin at midnight Asia/Kolkata, by the database clock, for the placement time behind `ordersToday` and for the delivery time behind `revenueTodayCents` alike.

#### Scenario: Two days ago is not today
- **WHEN** a store's only order was placed and delivered two days ago
- **THEN** its dashboard entry has every `ordersToday` count 0 and `revenueTodayCents` 0
