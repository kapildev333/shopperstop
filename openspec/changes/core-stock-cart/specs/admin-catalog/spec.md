## MODIFIED Requirements

### Requirement: Admins list and search products
`GET /api/core/v1/admin/products` SHALL return the paged list of active and inactive products ordered by `name`, filtered by `q` (case-insensitive substring of name or brand, `%` and `_` matched literally), `categoryId` (that category and its children) and `isActive` (`true` or `false`) when given. A `q` containing a NUL byte SHALL be 400 `validation` naming field `q`.

#### Scenario: Search by brand in another case
- **WHEN** an admin lists products with `q=daily farm` and a product has brand `Daily Farm`
- **THEN** that product is in `items` and `total` counts every match

#### Scenario: Parent category includes its children
- **WHEN** an admin lists products with `categoryId` of a parent that has one product of its own and one in a child
- **THEN** both products are listed

#### Scenario: Inactive only
- **WHEN** an admin lists products with `isActive=false`
- **THEN** every listed product has `isActive` false

#### Scenario: Wildcards are literal
- **WHEN** an admin lists products with `q=%`
- **THEN** only products whose name or brand contains a `%` character are listed

#### Scenario: Bad filters
- **WHEN** an admin lists products with `isActive=yes` or with a `categoryId` that is not a uuid
- **THEN** the response is 400 with code `validation` and field `isActive` or `categoryId`

#### Scenario: NUL byte in q
- **WHEN** an admin lists products with `q=milk%00`
- **THEN** the response is 400 with code `validation` and field `q`
