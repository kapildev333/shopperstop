## MODIFIED Requirements

### Requirement: Staff list a store's stock
`GET /api/core/v1/admin/stores/{id}/stock` SHALL answer every active product with `{productId, name, brand, unitLabel, priceCents, imageUrl, quantity}` at that store as a paged list sorted by name. `q` (at most 100 characters) SHALL keep products whose name or brand contains it without regard to case, `%` and `_` matched literally; `lowStock=true` SHALL keep products whose quantity is below 5, zero included; any `lowStock` value other than `true` or `false` SHALL be 400 `validation`.

#### Scenario: Own store with filters
- **WHEN** a store's staff list its stock with `lowStock=true&q=milk`, where `Amul Milk` has quantity 3, `Milk Bread` has quantity 40 and `Curd` has quantity 0
- **THEN** the response is 200 and `items` holds `Amul Milk` only, with `quantity` 3

#### Scenario: Inactive products are not listed
- **WHEN** a product is inactive and has a stock row at the store
- **THEN** the store's stock list does not contain it

## ADDED Requirements

### Requirement: Stock rows carry the product image
A row of the stock list SHALL carry `imageUrl` when its product has an image, with the same value as that product's `imageUrl` on `GET /api/core/v1/stores/{id}/products/{slug}`, and SHALL have no `imageUrl` member when the product has no image.

#### Scenario: Product with an image
- **WHEN** store staff list the stock of their store and a listed product has the image `products/stock-image.png`
- **THEN** its row has `imageUrl` `/api/core/v1/files/products/stock-image.png`, the value `GET /api/core/v1/stores/{id}/products/{slug}` answers for that product

#### Scenario: Product without an image
- **WHEN** an admin lists the stock of a store and a listed product has no image
- **THEN** its row has no `imageUrl` member
