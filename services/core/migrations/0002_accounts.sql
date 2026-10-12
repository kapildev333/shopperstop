-- Accounts: customers, staff users, bearer sessions, customer addresses.
create extension if not exists citext with schema public;

create type order_status as enum ('placed', 'accepted', 'packing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
create type staff_role as enum ('admin', 'store_staff');

create function set_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end
$$;

create table customers (
    id            uuid primary key default gen_random_uuid(),
    email         citext not null unique,
    password_hash text not null,
    name          text not null,
    phone         text not null default '',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create trigger customers_updated_at before update on customers for each row execute function set_updated_at();

create table staff_users (
    id            uuid primary key default gen_random_uuid(),
    email         citext not null unique,
    password_hash text not null,
    name          text not null,
    role          staff_role not null,
    store_id      uuid,
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint staff_users_admin_has_no_store check ((role = 'admin') = (store_id is null))
);
create trigger staff_users_updated_at before update on staff_users for each row execute function set_updated_at();

create table sessions (
    id           uuid primary key default gen_random_uuid(),
    token_hash   bytea not null unique,
    subject_type text not null check (subject_type in ('customer', 'staff')),
    subject_id   uuid not null,
    expires_at   timestamptz not null,
    last_seen_at timestamptz not null default now(),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create trigger sessions_updated_at before update on sessions for each row execute function set_updated_at();

create table addresses (
    id          uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers (id) on delete cascade,
    label       text not null,
    line1       text not null,
    line2       text not null default '',
    pincode     text not null,
    is_default  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index addresses_customer_id on addresses (customer_id);
create unique index addresses_one_default on addresses (customer_id) where is_default;
create trigger addresses_updated_at before update on addresses for each row execute function set_updated_at();
