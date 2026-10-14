# admin-catalog Specification

## Purpose
How admins run the catalog from the admin panel: the two-level category tree, products with prices and an active flag, stable slugs, search and filters, deletion rules and image uploads.

## Requirements

### Requirement: Catalog administration is admin-only
Every route under `/api/core/v1/admin/categories` and `/api/core/v1/admin/products` SHALL answer 401 `unauthorized` without a staff session (a customer token counts as none) and 403 `forbidden` to store staff.

#### Scenario: Anonymous or customer
- **WHEN** a request without a token, or with a customer token, is sent to any admin catalog route
- **THEN** the response is 401 with code `unauthorized`

#### Scenario: Store staff
- **WHEN** a store-staff user sends a request to any admin catalog route
- **THEN** the response is 403 with code `forbidden`

### Requirement: Admins read the category tree
`GET /api/core/v1/admin/categories` SHALL return `{items}` where each item is a parent category with a `children` array (empty when it has none), parents and children each ordered by `sortOrder`, then `name`.

#### Scenario: Tree order
- **WHEN** an admin has created parents `B` (sortOrder 1) and `A` (sortOrder 2), and children `y` (sortOrder 0) and `x` (sortOrder 0) under `B`
- **THEN** the items are `B` then `A`, `B.children` is `x` then `y`, and `A.children` is `[]`

### Requirement: Admins create categories in two levels
`POST /api/core/v1/admin/categories` with `name`, optional `parentId` and optional `sortOrder` (default 0) SHALL answer 201 with the category; `parentId` SHALL name a category that has no parent, so the tree never has more than two levels.

#### Scenario: Child under a parent
- **WHEN** an admin creates `Milk` with `parentId` set to a parent category
- **THEN** the response is 201 and the category has that `parentId` and `sortOrder` 0

#### Scenario: Third level refused
- **WHEN** an admin creates a category whose `parentId` is a child category
- **THEN** the response is 400 with code `validation` and field `parentId`

#### Scenario: Unknown parent
- **WHEN** an admin creates a category whose `parentId` matches no category
- **THEN** the response is 400 with code `validation` and field `parentId`

#### Scenario: Missing name
- **WHEN** an admin creates a category with an empty or blank `name`
- **THEN** the response is 400 with code `validation` and field `name`

### Requirement: Slugs are derived once
The server SHALL set a category's or product's `slug` on create from its name, lowercase ASCII letters and digits joined by single hyphens, falling back to `category` or `product` when nothing remains, SHALL make it unique with a hyphenated suffix on a clash, and SHALL never change it afterwards.

#### Scenario: Derived slug
- **WHEN** an admin creates a category named `Fruits & Vegetables`
- **THEN** its `slug` is `fruits-vegetables`

#### Scenario: Clash gets a suffix
- **WHEN** an admin creates two products both named `Toned Milk`
- **THEN** the first has slug `toned-milk` and the second a different slug that starts with `toned-milk-`

#### Scenario: Rename keeps the slug
- **WHEN** an admin renames a product or a category
- **THEN** the response has the new `name` and the old `slug`

### Requirement: Admins edit categories
`PATCH /api/core/v1/admin/categories/{id}` SHALL change `name` and `sortOrder` when present and leave absent fields unchanged; an unknown id SHALL answer 404 `not_found`.

#### Scenario: Rename and reorder
- **WHEN** an admin patches a category with `{"name":"Fresh Milk","sortOrder":5}`
- **THEN** the response is 200 with that name and sortOrder

#### Scenario: Unknown category
- **WHEN** an admin patches a category id that does not exist
- **THEN** the response is 404 with code `not_found`

### Requirement: Categories in use cannot be deleted
`DELETE /api/core/v1/admin/categories/{id}` SHALL answer 204 when the category has no products and no children, 409 `conflict` when it has either, and 404 `not_found` for an unknown id.

#### Scenario: Empty category
- **WHEN** an admin deletes a category with no products and no children
- **THEN** the response is 204 and the category is gone from the tree

#### Scenario: Category with a child or a product
- **WHEN** an admin deletes a parent that has a child, or a category that has a product
- **THEN** the response is 409 with code `conflict` and the category remains

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

### Requirement: Admins create and read products
`POST /api/core/v1/admin/products` with `name`, `categoryId`, `unitLabel`, `mrpCents`, `priceCents` and optional `brand`, `description`, `isActive` (default true) SHALL answer 201 with the product; `GET /api/core/v1/admin/products/{id}` SHALL return it, or 404 `not_found`.

#### Scenario: Create
- **WHEN** an admin creates a product with valid fields
- **THEN** the response is 201 with the product, `isActive` true and a server-made `slug`, and `GET` by its id returns the same product

#### Scenario: Unknown category
- **WHEN** an admin creates a product whose `categoryId` matches no category
- **THEN** the response is 400 with code `validation` and field `categoryId`

#### Scenario: Unknown product
- **WHEN** an admin reads a product id that does not exist
- **THEN** the response is 404 with code `not_found`

### Requirement: Product prices are bounded by the MRP
A product's `priceCents` SHALL be at least 1 and at most its `mrpCents`, on create and after every patch, including a patch that changes only one of the two; a violation SHALL answer 400 `validation` with field `priceCents`.

#### Scenario: Price above MRP on create
- **WHEN** an admin creates a product with `mrpCents` 5000 and `priceCents` 5100
- **THEN** the response is 400 with code `validation` and field `priceCents`

#### Scenario: MRP lowered below the stored price
- **WHEN** an admin patches a product priced 4500 with `{"mrpCents":4000}`
- **THEN** the response is 400 with code `validation` and field `priceCents`, and the product is unchanged

### Requirement: Admins edit products
`PATCH /api/core/v1/admin/products/{id}` SHALL change any of `name`, `categoryId`, `brand`, `description`, `unitLabel`, `mrpCents`, `priceCents`, `isActive` when present, treat `""` for `brand` or `description` as clearing it (then omitted from responses), and answer 404 `not_found` for an unknown id.

#### Scenario: Deactivate
- **WHEN** an admin patches a product with `{"isActive":false}`
- **THEN** the response is 200 with `isActive` false and every other field unchanged

#### Scenario: Clear the description
- **WHEN** an admin patches a product with `{"description":""}`
- **THEN** the response has no `description` member

### Requirement: Only never-ordered products can be deleted
`DELETE /api/core/v1/admin/products/{id}` SHALL answer 204 when no order line refers to the product, and otherwise 409 `conflict` with the message `product was ordered; set isActive to false instead`, keeping the product; an unknown id SHALL answer 404 `not_found`.

#### Scenario: Never ordered
- **WHEN** an admin deletes a product that no order line refers to
- **THEN** the response is 204 and reading it afterwards is 404

#### Scenario: Ordered product
- **WHEN** an admin deletes a product that an order line refers to
- **THEN** the response is 409 with code `conflict` and message `product was ordered; set isActive to false instead`, and the product remains

### Requirement: Admins upload catalog images
`PUT /api/core/v1/admin/products/{id}/image` and `PUT /api/core/v1/admin/categories/{id}/image` SHALL take `multipart/form-data` with one part `file` holding a PNG, JPEG or WebP image (by its content), store it as `<kind>/<id>.<ext>` (`png`, `jpg`, `webp`), replacing any earlier one, and answer 200 with the updated row.

#### Scenario: Product PNG
- **WHEN** an admin uploads a PNG for product `P`
- **THEN** the response is 200 with `imageUrl` `/api/core/v1/files/products/<P's id>.png`

#### Scenario: Category WebP and product JPEG
- **WHEN** an admin uploads a WebP for a category and a JPEG for a product
- **THEN** their `imageUrl` values end in `.webp` and `.jpg`

#### Scenario: Re-upload replaces
- **WHEN** an admin uploads a second PNG for the same product
- **THEN** the image URL serves the second file's bytes

### Requirement: Image uploads are validated
An image upload SHALL answer 400 `validation` with field `file` when the request is not multipart, has no `file` part, or the file is over 5 MiB or not PNG, JPEG or WebP; 400 `validation` with message `body too large` when the body exceeds 16 MiB; and 404 `not_found` for an unknown id, storing nothing in each case.

#### Scenario: Wrong type
- **WHEN** an admin uploads a GIF or a text file as `file`
- **THEN** the response is 400 with code `validation` and field `file`

#### Scenario: Over 5 MiB
- **WHEN** an admin uploads a PNG of 5 MiB plus one byte
- **THEN** the response is 400 with code `validation` and field `file`

#### Scenario: Missing part or not multipart
- **WHEN** an admin sends an upload with no `file` part, or a JSON body
- **THEN** the response is 400 with code `validation` and field `file`

#### Scenario: Body over 16 MiB
- **WHEN** an admin sends a multipart body with a 17 MiB part before `file`
- **THEN** the response is 400 with code `validation` and message `body too large`

#### Scenario: Unknown product
- **WHEN** an admin uploads a valid PNG for a product id that does not exist
- **THEN** the response is 404 with code `not_found` and no file is stored
