# Spec Delta

## Purpose
What customers read of the catalog: a store's category tree, its products and one product by slug, the images served without a session, the image URL each category and product carries, and the demo catalog loaded for local use.

## ADDED Requirements

### Requirement: Customers read a store's category tree
`GET /api/core/v1/stores/{id}/categories` SHALL answer without a session with `{items}`, where each item is a parent category with a `children` array, parents and children each ordered by `sortOrder`, then `name`; an unknown store id SHALL answer 404 `not_found`.

#### Scenario: Tree order
- **WHEN** a client reads the categories of a store and the catalog holds parents `B` (sortOrder 1) and `A` (sortOrder 2) with children `y` and `x` (both sortOrder 0) under `B`
- **THEN** `B` comes before `A` and `B.children` lists `x` before `y`

#### Scenario: Unknown store
- **WHEN** a client reads the categories of a store id that does not exist
- **THEN** the response is 404 with code `not_found`

### Requirement: Customers list a store's products
`GET /api/core/v1/stores/{id}/products` SHALL answer without a session with the paged list of active products only, ordered by `name`, filtered by `q` (case-insensitive substring of name or brand, `%` and `_` literal) and `categoryId` (that category and its children); each product SHALL carry `id`, `name`, `slug`, `unitLabel`, `mrpCents`, `priceCents`, `categoryId`, and `description`, `brand`, `imageUrl` when set, and no `isActive`.

#### Scenario: Inactive products are hidden
- **WHEN** a client lists a store's products and the catalog holds an active and an inactive product in the same category
- **THEN** only the active product is listed and no product carries `isActive`

#### Scenario: Search and category
- **WHEN** a client lists a store's products with `q=farm` and the `categoryId` of a parent whose child holds an active product of brand `Daily Farm`
- **THEN** that product is listed

#### Scenario: Paging
- **WHEN** a client lists a store's products without `page` and `pageSize`, and again with `pageSize=101`
- **THEN** the first response has `page` 1 and `pageSize` 24, and the second is 400 with code `validation` and field `pageSize`

#### Scenario: Unknown store or bad filter
- **WHEN** a client lists the products of a store id that does not exist, or passes a `categoryId` that is not a uuid
- **THEN** the response is 404 `not_found`, or 400 `validation` with field `categoryId`

### Requirement: Customers read one product by slug
`GET /api/core/v1/stores/{id}/products/{slug}` SHALL answer without a session with the active product whose slug matches, in the same shape as the list, and 404 `not_found` for an unknown or inactive slug or an unknown store.

#### Scenario: Active product
- **WHEN** a client reads a store's product by the slug of an active product
- **THEN** the response is 200 with that product

#### Scenario: Inactive or unknown slug
- **WHEN** a client reads a store's product by the slug of an inactive product, or by a slug that no product has
- **THEN** the response is 404 with code `not_found`

### Requirement: Catalog images are served publicly
`GET /api/core/v1/files/{kind}/{name}` SHALL answer without a session with the stored file for kind `products` or `categories` and the content type of its extension (`png` image/png, `jpg` image/jpeg, `webp` image/webp), with `Cache-Control: no-cache` and `X-Content-Type-Options: nosniff`.

#### Scenario: Uploaded image is served
- **WHEN** an admin has uploaded a PNG for a product and a client without a token requests the product's `imageUrl`
- **THEN** the response is 200 with `Content-Type: image/png`, `Cache-Control: no-cache`, `X-Content-Type-Options: nosniff` and exactly the uploaded bytes

#### Scenario: Unchanged image is not sent again
- **WHEN** a client requests a stored image with `If-Modified-Since` equal to the `Last-Modified` it was given
- **THEN** the response is 304 with no body

### Requirement: Only stored catalog files are reachable
The file route SHALL answer 404 `not_found` for a kind other than `products` or `categories`, a name that is not lowercase letters, digits and hyphens followed by `.png`, `.jpg` or `.webp`, and a file that is not stored, so no request reaches a path outside the files directory.

#### Scenario: Missing file
- **WHEN** a client requests `GET /api/core/v1/files/products/00000000-0000-4000-8000-000000000000.png` and no such file is stored
- **THEN** the response is 404 with code `not_found`

#### Scenario: Unsafe name or kind
- **WHEN** a client requests `GET /api/core/v1/files/products/..%2Fsecret.png` or `GET /api/core/v1/files/orders/x.png`
- **THEN** each response is 404 with code `not_found`

### Requirement: Categories and products carry an image URL
Every category and product in a response SHALL carry `imageUrl`, the path `/api/core/v1/files/<kind>/<name>` of its stored image, when it has one, and SHALL omit `imageUrl` when it has none.

#### Scenario: No image yet
- **WHEN** an admin creates a product
- **THEN** the created product has no `imageUrl` member

#### Scenario: After an upload
- **WHEN** an admin uploads a PNG for product `P`
- **THEN** the response and every later read of `P` carry `imageUrl` `/api/core/v1/files/products/<P's id>.png`

### Requirement: Demo catalog
`core-admin seed-demo` SHALL load 12 parent categories with 2 to 4 children each and 148 products with fixed ids (the first is `00000000-0000-4000-8000-000000000601`), each category and product with an image that the file route serves; `--reset` SHALL leave exactly these rows however often it runs.

#### Scenario: Reset twice leaves the demo catalog
- **WHEN** `seed-demo --reset` runs twice on a database holding an extra category and product
- **THEN** exactly the 12 parents, their children and the 148 fixed products exist, and product `00000000-0000-4000-8000-000000000601` is among them

#### Scenario: Demo images are served
- **WHEN** after `seed-demo --reset` a client requests the `imageUrl` of product `00000000-0000-4000-8000-000000000601`
- **THEN** the response is 200 with `Content-Type: image/png`
