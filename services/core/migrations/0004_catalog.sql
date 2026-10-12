-- Catalog: two-level categories and products.
create table categories (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    slug       text not null unique,
    parent_id  uuid references categories (id) on delete restrict,
    sort_order integer not null default 0,
    image_key  text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index categories_parent_id on categories (parent_id);
create trigger categories_updated_at before update on categories for each row execute function set_updated_at();

create table products (
    id          uuid primary key default gen_random_uuid(),
    category_id uuid not null references categories (id) on delete restrict,
    name        text not null,
    slug        text not null unique,
    description text not null default '',
    brand       text not null default '',
    unit_label  text not null,
    mrp_cents   bigint not null,
    price_cents bigint not null,
    is_active   boolean not null default true,
    image_key   text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    constraint products_price_positive check (price_cents > 0),
    constraint products_price_lte_mrp check (price_cents <= mrp_cents)
);
create index products_category_id on products (category_id);
create trigger products_updated_at before update on products for each row execute function set_updated_at();
