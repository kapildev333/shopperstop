-- Riders and their bearer sessions (rider-service-foundation).
create table riders (
    id            uuid primary key default gen_random_uuid(),
    store_id      uuid not null, -- core's store id, no foreign key (D32)
    email         citext not null unique,
    name          text not null,
    phone         text not null default '',
    password_hash text not null,
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index riders_store_id on riders (store_id);
create trigger riders_updated_at before update on riders for each row execute function set_updated_at();

create table sessions (
    id           uuid primary key default gen_random_uuid(),
    rider_id     uuid not null references riders (id) on delete cascade,
    token_hash   bytea not null unique,
    expires_at   timestamptz not null,
    last_seen_at timestamptz not null default now(),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index sessions_rider_id on sessions (rider_id);
create trigger sessions_updated_at before update on sessions for each row execute function set_updated_at();
