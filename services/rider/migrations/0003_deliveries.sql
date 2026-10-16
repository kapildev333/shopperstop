-- Deliveries (one rider carrying one core order) and each rider's last position (rider-deliveries).
create type delivery_status as enum ('assigned', 'delivered');

create table deliveries (
    id              uuid primary key default gen_random_uuid(),
    order_id        uuid not null unique, -- core's order id, no foreign key (D32)
    order_number    text not null,
    store_id        uuid not null,        -- core's store id
    rider_id        uuid not null references riders (id),
    status          delivery_status not null default 'assigned',
    customer_name   text not null,
    customer_phone  text not null default '',
    address_line1   text not null,
    address_line2   text not null default '',
    address_pincode text not null,
    total_cents     bigint not null check (total_cents >= 0),
    payment_method  text not null,
    item_count      integer not null check (item_count > 0),
    items           jsonb not null,
    assigned_at     timestamptz not null default now(),
    delivered_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    check ((status = 'delivered') = (delivered_at is not null))
);
create index deliveries_rider_id_status on deliveries (rider_id, status);
create trigger deliveries_updated_at before update on deliveries for each row execute function set_updated_at();

create table rider_locations (
    rider_id    uuid primary key references riders (id) on delete cascade,
    lat         double precision not null check (lat between -90 and 90),
    lng         double precision not null check (lng between -180 and 180),
    recorded_at timestamptz not null default now(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create trigger rider_locations_updated_at before update on rider_locations for each row execute function set_updated_at();
