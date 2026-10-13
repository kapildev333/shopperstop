-- name: CartByCustomer :one
select id, store_id from carts where customer_id = $1;

-- name: EnsureCart :exec
insert into carts (customer_id, store_id) values ($1, $2)
on conflict (customer_id) do nothing;

-- name: LockCart :one
select id, store_id from carts where customer_id = $1 for update;

-- name: ClearCart :exec
delete from cart_items where cart_id = $1;

-- name: MoveCart :exec
update carts set store_id = $2 where id = $1;

-- name: CartItems :many
select product_id, quantity from cart_items where cart_id = $1 order by created_at, product_id;

-- name: SetCartItem :exec
insert into cart_items (cart_id, product_id, quantity) values ($1, $2, $3)
on conflict (cart_id, product_id) do update set quantity = excluded.quantity;

-- name: DeleteCartItem :exec
delete from cart_items where cart_id = $1 and product_id = $2;

-- name: DeleteEmptyCart :exec
delete from carts c where c.id = $1 and not exists (select 1 from cart_items i where i.cart_id = c.id);

-- name: DeleteCart :exec
delete from carts where customer_id = $1;
