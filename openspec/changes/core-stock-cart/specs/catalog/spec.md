## ADDED Requirements

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
`GET /api/core/v1/stores/{id}/products` SHALL answer the paged active products ordered by name, filtered by `q` and `categoryId` exactly as the admin product list filters them. Inactive products SHALL not be listed. An unknown store SHALL answer 404 `not_found`. No session is needed.

#### Scenario: Category with children and search
- **WHEN** a client lists the store's products with `categoryId` of a parent and `q=CURD`
- **THEN** only active products in that parent or its children whose name or brand contains `curd` are listed

#### Scenario: Inactive product hidden
- **WHEN** an inactive product has quantity 9 at the store
- **THEN** the store's product list does not contain it

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
