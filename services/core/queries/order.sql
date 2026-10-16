-- name: CreateOrder :one
insert into orders (number, customer_id, store_id, store_name, promised_minutes, customer_name, customer_phone,
                    address_label, address_line1, address_line2, address_pincode,
                    subtotal_cents, delivery_fee_cents, total_cents)
values (@number, @customer_id, @store_id, @store_name, @promised_minutes, @customer_name, @customer_phone,
        @address_label, @address_line1, @address_line2, @address_pincode,
        @subtotal_cents, @delivery_fee_cents, @total_cents)
returning id;

-- name: AddItems :exec
-- Zips equal-length arrays, one row per order line.
insert into order_items (order_id, product_id, name, unit_label, image_url, price_cents, mrp_cents, quantity)
select @order_id::uuid, unnest(@product_ids::uuid[]), unnest(@names::text[]), unnest(@unit_labels::text[]),
       unnest(@image_urls::text[]), unnest(@price_cents::bigint[]), unnest(@mrp_cents::bigint[]), unnest(@quantities::integer[]);

-- name: AddEvent :exec
insert into order_events (order_id, from_status, to_status, actor_type, actor_id, actor_name, note)
values (@order_id, sqlc.narg(from_status), @to_status, @actor_type, sqlc.narg(actor_id), sqlc.narg(actor_name), @note);

-- name: GetOrder :one
-- A null customer_id or store_id does not filter: the caller's scope.
select * from orders
where id = @id
  and (sqlc.narg(customer_id)::uuid is null or customer_id = sqlc.narg(customer_id))
  and (sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id));

-- name: LockOrder :one
select id, number, status, store_id from orders
where id = @id
  and (sqlc.narg(customer_id)::uuid is null or customer_id = sqlc.narg(customer_id))
  and (sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id))
for update;

-- name: SetStatus :exec
update orders
set status        = @status,
    delivered_at  = case when @status = 'delivered'::order_status then now() else delivered_at end,
    cancelled_at  = case when @status = 'cancelled'::order_status then now() else cancelled_at end,
    cancel_reason = case when @status = 'cancelled'::order_status then @cancel_reason else cancel_reason end,
    rider_name    = coalesce(sqlc.narg(rider_name), rider_name)
where id = @id;

-- name: CustomerOrders :many
select * from orders where customer_id = @customer_id
order by placed_at desc, id desc
limit @lim offset @off;

-- name: CountCustomerOrders :one
select count(*) from orders where customer_id = $1;

-- name: StoreOrders :many
select * from orders
where store_id = @store_id and (sqlc.narg(status)::order_status is null or status = sqlc.narg(status))
order by placed_at desc, id desc
limit @lim offset @off;

-- name: CountStoreOrders :one
select count(*) from orders
where store_id = @store_id and (sqlc.narg(status)::order_status is null or status = sqlc.narg(status));

-- name: OrderItems :many
select order_id, product_id, name, unit_label, image_url, price_cents, mrp_cents, quantity
from order_items where order_id = any(@order_ids::uuid[])
order by order_id, name, product_id;

-- name: OrderEvents :many
select order_id, from_status, to_status, actor_type, actor_name, note, created_at
from order_events where order_id = any(@order_ids::uuid[])
order by order_id, created_at, id;

-- name: CountsToday :many
-- Orders placed since midnight in Bengaluru, by current status.
select status, count(*) as orders from orders
where store_id = $1 and placed_at >= date_trunc('day', now(), 'Asia/Kolkata')
group by status;

-- name: RevenueToday :one
select coalesce(sum(total_cents), 0)::bigint from orders
where store_id = $1 and status = 'delivered' and delivered_at >= date_trunc('day', now(), 'Asia/Kolkata');
