-- Stores and the pincodes each one delivers to; staff users now reference their store.
create table stores (
    id                        uuid primary key default gen_random_uuid(),
    name                      text not null,
    address_line              text not null,
    pincode                   text not null,
    is_open                   boolean not null default false,
    delivery_fee_cents        bigint not null default 0 check (delivery_fee_cents >= 0),
    free_delivery_above_cents bigint not null default 0 check (free_delivery_above_cents >= 0),
    min_order_cents           bigint not null default 0 check (min_order_cents >= 0),
    promised_minutes          integer not null check (promised_minutes > 0),
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now()
);
create trigger stores_updated_at before update on stores for each row execute function set_updated_at();

create table store_service_areas (
    id         uuid primary key default gen_random_uuid(),
    store_id   uuid not null references stores (id) on delete cascade,
    pincode    text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index store_service_areas_store_id on store_service_areas (store_id);
create trigger store_service_areas_updated_at before update on store_service_areas for each row execute function set_updated_at();

-- not valid: rows written before this migration are not checked (a fresh database has none);
-- every insert and update from now on is, and a referenced store cannot be deleted.
alter table staff_users add constraint staff_users_store_id_fkey
    foreign key (store_id) references stores (id) not valid;
