-- name: CreateRider :one
insert into riders (store_id, email, name, phone, password_hash)
values ($1, $2, $3, $4, $5)
returning id, store_id, email, name, phone, is_active, is_online;

-- name: RiderByEmail :one
select id, store_id, email, name, phone, password_hash, is_active, is_online from riders where email = $1;

-- name: RiderByID :one
select id, store_id, email, name, phone, is_active, is_online from riders where id = $1;

-- name: LockRider :one
select id, store_id from riders where id = $1 for update;

-- name: ListRiders :many
select id, store_id, email, name, phone, is_active, is_online from riders
where sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id)::uuid
order by email limit sqlc.arg(page_limit) offset sqlc.arg(page_offset);

-- name: CountRiders :one
select count(*) from riders
where sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id)::uuid;

-- name: UpdateRider :one
update riders
set name = coalesce(sqlc.narg(name), name),
    phone = coalesce(sqlc.narg(phone), phone),
    password_hash = coalesce(sqlc.narg(password_hash), password_hash),
    is_active = coalesce(sqlc.narg(is_active), is_active),
    -- deactivation takes the rider offline (riders_online_active)
    is_online = is_online and coalesce(sqlc.narg(is_active), is_active),
    online_since = case when is_online and coalesce(sqlc.narg(is_active), is_active) then online_since end
where id = @id
returning id, store_id, email, name, phone, is_active, is_online;

-- name: CreateSession :exec
insert into sessions (rider_id, token_hash, expires_at)
values ($1, $2, now() + interval '30 days');

-- name: RiderSession :one
select s.id as session_id, r.id, r.store_id, r.email, r.name, r.phone, r.is_active, r.is_online
from sessions s join riders r on r.id = s.rider_id
where s.token_hash = $1 and s.expires_at > now() and r.is_active;

-- name: TouchSession :exec
update sessions set last_seen_at = now(), expires_at = now() + interval '30 days'
where id = $1 and last_seen_at < now() - interval '1 hour';

-- name: DeleteExpiredSessions :exec
-- A session at or past its expiry can never be used again: RiderSession
-- admits only expires_at > now().
delete from sessions where expires_at <= now();

-- name: DeleteSession :exec
delete from sessions where id = $1;

-- name: DeleteRiderSessions :exec
delete from sessions where rider_id = $1;

-- name: LockDispatch :exec
-- Waits for a running dispatcher tick (queries/dispatch.sql TryTickLock, the same
-- key), so a rider going offline never races the tick's offer to them.
select pg_advisory_xact_lock(727102, hashtext(current_schema()));

-- name: SetAvailability :one
-- online_since keeps its value when the rider is already online.
update riders
set is_online = sqlc.arg(online)::boolean,
    online_since = case when sqlc.arg(online)::boolean then coalesce(online_since, now()) end
where id = sqlc.arg(id)
returning id, store_id, email, name, phone, is_active, is_online;

-- name: ExpireRiderOffers :exec
update offers set status = 'expired', answered_at = now() where rider_id = $1 and status = 'offered';
