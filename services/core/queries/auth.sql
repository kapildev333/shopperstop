-- name: CreateCustomer :one
insert into customers (email, password_hash, name)
values ($1, $2, $3)
returning id, email, name, phone;

-- name: CustomerByEmail :one
select id, email, password_hash, name, phone from customers where email = $1;

-- name: CustomerByID :one
select id, email, name, phone from customers where id = $1;

-- name: UpdateCustomer :one
update customers
set name = coalesce(sqlc.narg(name), name), phone = coalesce(sqlc.narg(phone), phone)
where id = @id
returning id, email, name, phone;

-- name: CreateCustomerSession :exec
insert into sessions (token_hash, subject_type, subject_id, expires_at)
values ($1, 'customer', $2, now() + interval '30 days');

-- name: CreateStaffSession :exec
insert into sessions (token_hash, subject_type, subject_id, expires_at)
values ($1, 'staff', $2, now() + interval '12 hours');

-- name: CustomerSession :one
select id, subject_id from sessions
where token_hash = $1 and subject_type = 'customer' and expires_at > now();

-- name: TouchCustomerSession :exec
update sessions set last_seen_at = now(), expires_at = now() + interval '30 days'
where id = $1 and last_seen_at < now() - interval '1 hour';

-- name: StaffSession :one
select s.id as session_id, u.id, u.email, u.name, u.role, u.store_id, u.is_active
from sessions s join staff_users u on u.id = s.subject_id
where s.token_hash = $1 and s.subject_type = 'staff' and s.expires_at > now() and u.is_active;

-- name: DeleteExpiredSessions :exec
-- A session at or past its expiry can never be used again: CustomerSession and
-- StaffSession admit only expires_at > now().
delete from sessions where expires_at <= now();

-- name: DeleteSession :exec
delete from sessions where id = $1;

-- name: CreateStaff :one
insert into staff_users (email, password_hash, name, role, store_id)
values ($1, $2, $3, $4, $5)
returning id, email, name, role, store_id, is_active;

-- name: StaffByEmail :one
select id, email, password_hash, name, role, store_id, is_active from staff_users where email = $1;

-- name: ListStaff :many
select id, email, name, role, store_id, is_active from staff_users
order by email limit $1 offset $2;

-- name: CountStaff :one
select count(*) from staff_users;

-- name: UpdateStaff :one
update staff_users
set name = coalesce(sqlc.narg(name), name),
    password_hash = coalesce(sqlc.narg(password_hash), password_hash),
    is_active = coalesce(sqlc.narg(is_active), is_active)
where id = @id
returning id, email, name, role, store_id, is_active;

-- name: LockActiveAdmins :many
-- Locks the active admins in id order so concurrent deactivations serialise without deadlock.
select id from staff_users where role = 'admin' and is_active order by id for update;
