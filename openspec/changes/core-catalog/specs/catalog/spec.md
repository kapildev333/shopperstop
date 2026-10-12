# Spec Delta

## Purpose
What customers and every client read of the catalog: images served without a session, the image URL each category and product carries, and the demo catalog loaded for local use. core-P2-L4 adds the store-facing category and product reads with stock.

## ADDED Requirements

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
