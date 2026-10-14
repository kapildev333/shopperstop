-- Orders with snapshot lines and their status history.
create table orders (
    id                 uuid primary key default gen_random_uuid(),
    number             text not null unique check (number ~ '^SS-[A-Z2-7]{8}$'),
    customer_id        uuid not null references customers (id),
    store_id           uuid not null references stores (id),
    status             order_status not null default 'placed',
    customer_name      text not null,
    customer_phone     text not null default '',
    address_label      text not null,
    address_line1      text not null,
    address_line2      text not null default '',
    address_pincode    text not null,
    subtotal_cents     bigint not null check (subtotal_cents >= 0),
    delivery_fee_cents bigint not null check (delivery_fee_cents >= 0),
    total_cents        bigint not null,
    payment_method     text not null default 'cod' check (payment_method = 'cod'),
    placed_at          timestamptz not null default now(),
    delivered_at       timestamptz,
    cancelled_at       timestamptz,
    cancel_reason      text not null default '',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint orders_total check (total_cents = subtotal_cents + delivery_fee_cents)
);
create index orders_customer_placed on orders (customer_id, placed_at desc, id desc);
create index orders_store_placed on orders (store_id, placed_at desc, id desc);
create trigger orders_updated_at before update on orders for each row execute function set_updated_at();

create table order_items (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references orders (id),
    product_id  uuid not null references products (id) on delete restrict,
    name        text not null,
    unit_label  text not null,
    image_url   text not null default '',
    price_cents bigint not null check (price_cents > 0),
    mrp_cents   bigint not null,
    quantity    integer not null check (quantity between 1 and 20),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (order_id, product_id)
);
create index order_items_product_id on order_items (product_id);
create trigger order_items_updated_at before update on order_items for each row execute function set_updated_at();

create table order_events (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references orders (id),
    from_status order_status,
    to_status   order_status not null,
    actor_type  text not null check (actor_type in ('customer', 'staff', 'system')),
    actor_id    uuid,
    note        text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index order_events_order_id on order_events (order_id, created_at);
create trigger order_events_updated_at before update on order_events for each row execute function set_updated_at();
