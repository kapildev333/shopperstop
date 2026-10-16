-- name: CreateDelivery :one
insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, customer_phone,
    address_line1, address_line2, address_pincode, total_cents, payment_method, item_count, items)
values (@order_id, @order_number, @store_id, @rider_id, @customer_name, @customer_phone,
    @address_line1, @address_line2, @address_pincode, @total_cents, @payment_method, @item_count, @items)
returning *;

-- name: ClaimedOrders :many
select order_id from deliveries where order_id = any(sqlc.arg(order_ids)::uuid[]);

-- name: RiderDeliveries :many
select * from deliveries where rider_id = $1 and status = $2
order by assigned_at desc, id limit $3 offset $4;

-- name: CountRiderDeliveries :one
select count(*) from deliveries where rider_id = $1 and status = $2;

-- name: RiderDelivery :one
select * from deliveries where id = $1 and rider_id = $2;

-- name: LockRiderDelivery :one
select * from deliveries where id = $1 and rider_id = $2 for update;

-- name: MarkDelivered :one
update deliveries set status = 'delivered', delivered_at = now() where id = $1 returning *;

-- name: UpsertLocation :exec
insert into rider_locations (rider_id, lat, lng) values ($1, $2, $3)
on conflict (rider_id) do update set lat = excluded.lat, lng = excluded.lng, recorded_at = now();

-- name: OrderDelivery :one
select d.status, r.name as rider_name, l.lat, l.lng, l.recorded_at
from deliveries d
join riders r on r.id = d.rider_id
left join rider_locations l
  on l.rider_id = d.rider_id and d.status = 'assigned' and l.recorded_at >= d.assigned_at
where d.order_id = $1;
