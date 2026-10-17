-- name: CreateDelivery :one
insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, customer_phone,
    address_line1, address_line2, address_pincode, total_cents, payment_method, payment_status, item_count, items)
values (@order_id, @order_number, @store_id, @rider_id, @customer_name, @customer_phone,
    @address_line1, @address_line2, @address_pincode, @total_cents, @payment_method, @payment_status, @item_count, @items)
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

-- name: OpenOffer :one
-- The rider's open offer; one past its expiry, or whose order a delivery holds, counts as none.
select o.* from offers o
where o.rider_id = $1 and o.status = 'offered' and o.expires_at > now()
  and not exists (select 1 from deliveries d where d.order_id = o.order_id);

-- name: RiderOffer :one
select o.*, (o.status = 'offered' and o.expires_at > now())::boolean as open
from offers o where o.id = $1 and o.rider_id = $2;

-- name: AcceptOffer :one
update offers set status = 'accepted', answered_at = now()
where id = $1 and rider_id = $2 and status = 'offered' and expires_at > now()
returning id;

-- name: DeclineOffer :one
update offers set status = 'declined', answered_at = now()
where id = $1 and rider_id = $2 and status = 'offered' and expires_at > now()
returning order_id, order_number;

-- name: VoidOffer :exec
-- The offer's order went to another rider or left ready: the offer can never be accepted.
update offers set status = 'expired', answered_at = now() where id = $1 and status = 'offered';
