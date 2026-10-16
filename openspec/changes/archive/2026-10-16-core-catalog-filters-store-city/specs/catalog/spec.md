## MODIFIED Requirements

### Requirement: Store products are listed and searched
`GET /api/core/v1/stores/{id}/products` SHALL answer the paged active products ordered by name, then id, unless `sort` orders them by price, filtered by `q` and `categoryId` exactly as the admin product list filters them, and by `inStock`. Inactive products SHALL not be listed. A `q` containing a NUL byte SHALL be 400 `validation` naming field `q`. An unknown store SHALL answer 404 `not_found`. No session is needed.

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

## ADDED Requirements

### Requirement: Store products can be limited to those in stock
On the store's product list, `inStock=true` SHALL keep only the products whose quantity at that store is above 0, a product with no stock row there included as 0, before paging, so `total` counts only those. `inStock=false`, an empty or an absent `inStock` SHALL not filter. Any other value SHALL answer 400 `validation` with field `inStock`.

#### Scenario: In stock only, paged
- **WHEN** the store holds 3 of product `a`, 0 of `b`, 1 of `c` and has no row for `d`, and a client lists them with `inStock=true&pageSize=1`, then with `page=2`
- **THEN** both responses have `total` 2, the first lists `a` and the second lists `c`

#### Scenario: No filter
- **WHEN** a client lists the same products with `inStock=false`, and again with `inStock=` empty
- **THEN** both responses have `total` 4

#### Scenario: Bad value
- **WHEN** a client lists the store's products with `inStock=yes` or `inStock=TRUE`
- **THEN** the response is 400 with code `validation` and field `inStock`

### Requirement: Store products can be sorted by price
On the store's product list, `sort=price_asc` SHALL order by `priceCents` ascending and `sort=price_desc` descending, equal prices by name, then id, before paging. An empty or absent `sort` SHALL keep the order by name, then id. Any other value SHALL answer 400 `validation` with field `sort`.

#### Scenario: Cheapest first, ties by name
- **WHEN** products `b` and `a` cost 3000, `c` 1000 and `d` 5000 and a client lists them with `sort=price_asc`
- **THEN** the order is `c`, `a`, `b`, `d`

#### Scenario: Dearest first, paged
- **WHEN** a client lists the same products with `sort=price_desc`, and with `sort=price_desc&pageSize=2&page=2`
- **THEN** the first order is `d`, `a`, `b`, `c` and the second response has `total` 4 and lists `b`, `c`

#### Scenario: Default order
- **WHEN** a client lists the same products with `sort=` empty
- **THEN** the order is `a`, `b`, `c`, `d`

#### Scenario: Bad value
- **WHEN** a client lists the store's products with `sort=price`, `sort=PRICE_ASC` or `sort=name`
- **THEN** the response is 400 with code `validation` and field `sort`
