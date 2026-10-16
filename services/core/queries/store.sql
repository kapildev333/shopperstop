-- name: GetStore :one
select * from stores where id = $1;

-- name: StoreForPincode :one
select s.*
from store_service_areas a join stores s on s.id = a.store_id
where a.pincode = $1;

-- name: ListStores :many
select * from stores order by name, id limit $1 offset $2;

-- name: CountStores :one
select count(*) from stores;

-- name: CreateStore :one
insert into stores (name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
returning *;

-- name: UpdateStore :one
update stores
set name = coalesce(sqlc.narg(name), name),
    city = coalesce(sqlc.narg(city), city),
    address_line = coalesce(sqlc.narg(address_line), address_line),
    pincode = coalesce(sqlc.narg(pincode), pincode),
    is_open = coalesce(sqlc.narg(is_open), is_open),
    delivery_fee_cents = coalesce(sqlc.narg(delivery_fee_cents), delivery_fee_cents),
    free_delivery_above_cents = coalesce(sqlc.narg(free_delivery_above_cents), free_delivery_above_cents),
    min_order_cents = coalesce(sqlc.narg(min_order_cents), min_order_cents),
    promised_minutes = coalesce(sqlc.narg(promised_minutes), promised_minutes)
where id = @id
returning *;

-- name: DeleteStore :execrows
delete from stores where id = $1;

-- name: LockStore :one
select id from stores where id = $1 for update;

-- name: ListServiceAreas :many
select pincode from store_service_areas where store_id = $1 order by pincode;

-- name: PincodeHolder :one
select pincode, store_id from store_service_areas
where pincode = any(@pincodes::text[]) and store_id <> @store_id
order by pincode limit 1;

-- name: DeleteServiceAreas :exec
delete from store_service_areas where store_id = $1;

-- name: AddServiceAreas :exec
insert into store_service_areas (store_id, pincode)
select @store_id::uuid, unnest(@pincodes::text[]);
