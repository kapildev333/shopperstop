-- name: ListStock :many
-- Every active product with its quantity at the store (0 without a row).
-- Reads products (catalog's table) read-only: design Decision 1.
select p.id as product_id, p.name, p.brand, p.unit_label, p.price_cents,
       coalesce(s.quantity, 0)::integer as quantity
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (@pattern::text = '' or p.name ilike @pattern or p.brand ilike @pattern)
  and (not @low_stock::boolean or coalesce(s.quantity, 0) < 5)
order by p.name, p.id
limit @lim offset @off;

-- name: CountStock :one
select count(*)
from products p
left join store_stock s on s.product_id = p.id and s.store_id = @store_id
where p.is_active
  and (@pattern::text = '' or p.name ilike @pattern or p.brand ilike @pattern)
  and (not @low_stock::boolean or coalesce(s.quantity, 0) < 5);

-- name: UpsertStock :exec
insert into store_stock (store_id, product_id, quantity)
select @store_id::uuid, unnest(@product_ids::uuid[]), unnest(@quantities::integer[])
on conflict (store_id, product_id) do update set quantity = excluded.quantity;

-- name: Quantity :one
select quantity from store_stock where store_id = $1 and product_id = $2;

-- name: LockStock :many
-- Locks the store's stock rows for these products in product id order (deadlock-free).
select s.product_id, s.quantity, p.is_active
from store_stock s join products p on p.id = s.product_id
where s.store_id = @store_id and s.product_id = any(@product_ids::uuid[])
order by s.product_id
for update of s;

-- name: AddStock :exec
-- Adds each delta (negative to take) to the locked rows.
update store_stock s set quantity = s.quantity + d.delta
from (select unnest(@product_ids::uuid[]) as product_id, unnest(@deltas::integer[]) as delta) d
where s.store_id = @store_id and s.product_id = d.product_id;
