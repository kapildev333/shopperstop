-- name: ListCategories :many
select * from categories
order by sort_order, name, id;

-- name: GetCategory :one
select * from categories where id = $1;

-- name: CreateCategory :one
insert into categories (name, slug, parent_id, sort_order)
values ($1, $2, $3, $4)
returning *;

-- name: UpdateCategory :one
update categories
set name = coalesce(sqlc.narg(name), name),
    sort_order = coalesce(sqlc.narg(sort_order), sort_order)
where id = @id
returning *;

-- name: SetCategoryImage :one
update categories set image_key = $2 where id = $1
returning *;

-- name: DeleteCategory :execrows
delete from categories where id = $1;

-- name: ListProducts :many
select *
from products
where (sqlc.narg(pattern)::text is null or name ilike sqlc.narg(pattern) or brand ilike sqlc.narg(pattern))
  and (sqlc.narg(category_id)::uuid is null
       or category_id = sqlc.narg(category_id)
       or category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
  and (sqlc.narg(is_active)::boolean is null or is_active = sqlc.narg(is_active))
order by name, id
limit @page_size offset @page_offset;

-- name: CountProducts :one
select count(*) from products
where (sqlc.narg(pattern)::text is null or name ilike sqlc.narg(pattern) or brand ilike sqlc.narg(pattern))
  and (sqlc.narg(category_id)::uuid is null
       or category_id = sqlc.narg(category_id)
       or category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
  and (sqlc.narg(is_active)::boolean is null or is_active = sqlc.narg(is_active));

-- name: GetProduct :one
select *
from products where id = $1;

-- name: CreateProduct :one
insert into products (category_id, name, slug, description, brand, unit_label, mrp_cents, price_cents, is_active)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
returning *;

-- name: UpdateProduct :one
update products
set category_id = coalesce(sqlc.narg(category_id), category_id),
    name = coalesce(sqlc.narg(name), name),
    description = coalesce(sqlc.narg(description), description),
    brand = coalesce(sqlc.narg(brand), brand),
    unit_label = coalesce(sqlc.narg(unit_label), unit_label),
    mrp_cents = coalesce(sqlc.narg(mrp_cents), mrp_cents),
    price_cents = coalesce(sqlc.narg(price_cents), price_cents),
    is_active = coalesce(sqlc.narg(is_active), is_active)
where id = @id
returning *;

-- name: SetProductImage :one
update products set image_key = $2 where id = $1
returning *;

-- name: DeleteProduct :execrows
delete from products where id = $1;

-- name: StoreProducts :many
-- in_stock keeps quantity above 0 at the store; sort 'price_asc' or 'price_desc' orders by price first, anything else by name.
select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
       p.category_id, p.image_key, coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (sqlc.narg(pattern)::text is null or p.name ilike sqlc.narg(pattern) or p.brand ilike sqlc.narg(pattern))
  and (sqlc.narg(category_id)::uuid is null
       or p.category_id = sqlc.narg(category_id)
       or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
  and (not @in_stock::boolean or coalesce(s.quantity, 0) > 0)
order by case when @sort::text = 'price_asc' then p.price_cents end asc,
         case when @sort::text = 'price_desc' then p.price_cents end desc,
         p.name, p.id
limit @page_size offset @page_offset;

-- name: CountStoreProducts :one
select count(*) from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (sqlc.narg(pattern)::text is null or p.name ilike sqlc.narg(pattern) or p.brand ilike sqlc.narg(pattern))
  and (sqlc.narg(category_id)::uuid is null
       or p.category_id = sqlc.narg(category_id)
       or p.category_id in (select c.id from categories c where c.parent_id = sqlc.narg(category_id)))
  and (not @in_stock::boolean or coalesce(s.quantity, 0) > 0);

-- name: StoreProductBySlug :one
select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
       p.category_id, p.image_key, coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.slug = @slug and p.is_active;

-- name: StoreProductsByID :many
-- Active and inactive products by id with their quantity at the store, for the cart.
select p.id, p.name, p.slug, p.description, p.brand, p.unit_label, p.mrp_cents, p.price_cents,
       p.category_id, p.image_key, p.is_active, coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.id = any(@ids::uuid[]);

-- name: StoreCategories :many
select c.* from categories c
where exists (
    select 1 from products p join store_stock s on s.product_id = p.id
    where s.store_id = @store_id and s.quantity > 0 and p.is_active
      and (p.category_id = c.id or p.category_id in (select k.id from categories k where k.parent_id = c.id)))
order by c.sort_order, c.name, c.id;
