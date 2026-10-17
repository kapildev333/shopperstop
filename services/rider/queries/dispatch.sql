-- name: TryTickLock :one
-- One dispatcher tick at a time across every rider process sharing the schema
-- (the schema in the key keeps parallel test packages apart; migrate holds
-- 727101 alone). queries/auth.sql LockDispatch waits for the same key.
select pg_try_advisory_xact_lock(727102, hashtext(current_schema())) as locked;

-- name: ExpireOffers :many
-- Open offers past their expiry, or whose order a delivery now holds (a hand claim won).
update offers o set status = 'expired', answered_at = @now
where o.status = 'offered'
  and (o.expires_at <= @now or exists (select 1 from deliveries d where d.order_id = o.order_id))
returning o.id, o.order_id, o.order_number, o.rider_id;

-- name: OnlineStores :many
select distinct store_id from riders where is_online order by store_id;

-- name: BusyOrders :many
-- The orders among order_ids that a delivery or an open offer holds.
select order_id from deliveries where order_id = any(sqlc.arg(order_ids)::uuid[])
union
select order_id from offers where status = 'offered' and order_id = any(sqlc.arg(order_ids)::uuid[]);

-- name: Candidates :many
-- The store's online riders with a position recorded after located_after, no
-- assigned delivery and no open offer; idle_since is the later of going online
-- and their last delivery.
select r.id, l.lat, l.lng,
       greatest(r.online_since, (select max(d.delivered_at) from deliveries d where d.rider_id = r.id))::timestamptz as idle_since
from riders r
join rider_locations l on l.rider_id = r.id
where r.store_id = @store_id and r.is_online and l.recorded_at > @located_after
  and not exists (select 1 from deliveries d where d.rider_id = r.id and d.status = 'assigned')
  and not exists (select 1 from offers o where o.rider_id = r.id and o.status = 'offered')
order by r.id;

-- name: RecentlyRefused :many
-- Riders who declined the order, or let an offer of it expire, after answered_after.
select distinct rider_id from offers
where order_id = @order_id and status in ('declined', 'expired') and answered_at > @answered_after;

-- name: CreateOffer :one
insert into offers (order_id, order_number, store_id, rider_id, eta_seconds, item_count, total_cents,
    payment_method, payment_status, pincode, placed_at, offered_at, expires_at)
values (@order_id, @order_number, @store_id, @rider_id, @eta_seconds, @item_count, @total_cents,
    @payment_method, @payment_status, @pincode, @placed_at, @offered_at, @expires_at)
returning id;

-- name: CountOnline :one
select count(*) from riders where store_id = $1 and is_online;

-- name: OrderOffers :many
select o.id, r.name as rider_name, o.status, o.eta_seconds, o.offered_at, o.answered_at
from offers o join riders r on r.id = o.rider_id
where o.order_id = $1
order by o.offered_at desc, o.id
limit 10;
