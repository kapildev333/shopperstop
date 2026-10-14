# catalog Specification

## Purpose
What customers and every client read of the catalog: images served without a session, the image URL each category and product carries, and the demo catalog loaded for local use. core-P2-L4 adds the store-facing category and product reads with stock.

## Requirements

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

### Requirement: Store categories list only what is in stock
`GET /api/core/v1/stores/{id}/categories` SHALL answer `{items}` with the category tree (parents in sort order, each with `children`) holding only the categories that have, themselves or through a child, an active product with a quantity above 0 at that store; a listed parent's `children` SHALL hold only the children that qualify themselves. An unknown store SHALL answer 404 `not_found`. No session is needed.

#### Scenario: Out-of-stock child hidden
- **WHEN** child category `Milk` has only products with quantity 0 at the store, and its sibling `Curd` has one with quantity 4
- **THEN** their parent is listed with `Curd` and without `Milk`

#### Scenario: Inactive stock does not count
- **WHEN** a parent's only product with stock at the store is inactive
- **THEN** the parent is not listed

#### Scenario: Unknown store
- **WHEN** a client requests the categories of a store id that does not exist
- **THEN** the response is 404 with code `not_found`

### Requirement: Store products are listed and searched
`GET /api/core/v1/stores/{id}/products` SHALL answer the paged active products ordered by name, filtered by `q` and `categoryId` exactly as the admin product list filters them. Inactive products SHALL not be listed. A `q` containing a NUL byte SHALL be 400 `validation` naming field `q`. An unknown store SHALL answer 404 `not_found`. No session is needed.

#### Scenario: Category with children and search
- **WHEN** a client lists the store's products with `categoryId` of a parent and `q=CURD`
- **THEN** only active products in that parent or its children whose name or brand contains `curd` are listed

#### Scenario: Inactive product hidden
- **WHEN** an inactive product has quantity 9 at the store
- **THEN** the store's product list does not contain it

#### Scenario: NUL byte in q
- **WHEN** a client lists the store's products with `q=milk%00`
- **THEN** the response is 400 with code `validation` and field `q`

#### Scenario: Unknown store
- **WHEN** a client lists the products of a store id that does not exist
- **THEN** the response is 404 with code `not_found`

### Requirement: Store products carry their stock
Every product the store's product list answers SHALL carry `inStock` (its quantity at that store is above 0) and `quantity`, its quantity at that store capped at 10 for display (D7); a product with no stock row at the store SHALL have `inStock` false and `quantity` 0.

#### Scenario: Plenty, a few, none
- **WHEN** the store holds 37 of product A, 3 of product B and has no row for product C
- **THEN** A is listed with `inStock` true and `quantity` 10, B with true and 3, and C with false and 0

### Requirement: One store product by slug
`GET /api/core/v1/stores/{id}/products/{slug}` SHALL answer one active product with `inStock` and `quantity` as in the store's product list; an unknown store, an unknown slug or an inactive product SHALL answer 404 `not_found`.

#### Scenario: A few left
- **WHEN** the store holds 3 of the product with slug `amul-curd`
- **THEN** the response is 200 with that product, `inStock` true and `quantity` 3

#### Scenario: Inactive or unknown slug
- **WHEN** a client requests the slug of an inactive product, or a slug no product has
- **THEN** the response is 404 with code `not_found`
