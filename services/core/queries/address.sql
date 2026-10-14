-- name: ListAddresses :many
select id, label, line1, line2, pincode, is_default from addresses
where customer_id = $1
order by is_default desc, created_at desc, id
limit $2 offset $3;

-- name: CountAddresses :one
select count(*) from addresses where customer_id = $1;

-- name: CreateAddress :one
insert into addresses (customer_id, label, line1, line2, pincode, is_default)
values ($1, $2, $3, $4, $5, $6)
returning id, label, line1, line2, pincode, is_default;

-- name: ClearDefaultAddress :exec
update addresses set is_default = false where customer_id = $1 and is_default;

-- name: UpdateAddress :one
update addresses
set label = coalesce(sqlc.narg(label), label),
    line1 = coalesce(sqlc.narg(line1), line1),
    line2 = coalesce(sqlc.narg(line2), line2),
    pincode = coalesce(sqlc.narg(pincode), pincode),
    is_default = coalesce(sqlc.narg(is_default), is_default)
where id = @id and customer_id = @customer_id
returning id, label, line1, line2, pincode, is_default;

-- name: DeleteAddress :execrows
delete from addresses where id = $1 and customer_id = $2;

-- name: AddressByID :one
select id, label, line1, line2, pincode, is_default from addresses where id = $1 and customer_id = $2;
