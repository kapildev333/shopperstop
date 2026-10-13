-- Stock per store and product; one open cart per customer with its lines.
create table store_stock (
    id         uuid primary key default gen_random_uuid(),
    store_id   uuid not null references stores (id) on delete cascade,
    product_id uuid not null references products (id) on delete cascade,
    quantity   integer not null check (quantity >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (store_id, product_id)
);
create trigger store_stock_updated_at before update on store_stock for each row execute function set_updated_at();

create table carts (
    id          uuid primary key default gen_random_uuid(),
    customer_id uuid not null unique references customers (id) on delete cascade,
    store_id    uuid not null references stores (id) on delete cascade,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create trigger carts_updated_at before update on carts for each row execute function set_updated_at();

create table cart_items (
    id         uuid primary key default gen_random_uuid(),
    cart_id    uuid not null references carts (id) on delete cascade,
    product_id uuid not null references products (id) on delete cascade,
    quantity   integer not null check (quantity between 1 and 20),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (cart_id, product_id)
);
create trigger cart_items_updated_at before update on cart_items for each row execute function set_updated_at();
