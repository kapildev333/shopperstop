-- Dispatch (rider-dispatch, D57): riders go online and offline, and the dispatcher offers
-- one ready order at a time to one online rider for a short time.
alter table riders add column is_online boolean not null default false;
alter table riders add column online_since timestamptz;
alter table riders add constraint riders_online_since check (is_online = (online_since is not null));
alter table riders add constraint riders_online_active check (is_active or not is_online);

create type offer_status as enum ('offered', 'accepted', 'declined', 'expired');

create table offers (
    id             uuid primary key default gen_random_uuid(),
    order_id       uuid not null, -- core's order id, no foreign key (D32)
    order_number   text not null,
    store_id       uuid not null, -- core's store id
    rider_id       uuid not null references riders (id),
    status         offer_status not null default 'offered',
    eta_seconds    integer not null check (eta_seconds >= 0),
    item_count     integer not null check (item_count > 0),
    total_cents    bigint not null check (total_cents >= 0),
    payment_method text not null,
    payment_status text not null default '',
    pincode        text not null,
    placed_at      timestamptz not null,
    offered_at     timestamptz not null,
    expires_at     timestamptz not null,
    answered_at    timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    check (expires_at > offered_at),
    check ((status = 'offered') = (answered_at is null))
);
create unique index offers_open_order on offers (order_id) where status = 'offered';
create unique index offers_open_rider on offers (rider_id) where status = 'offered';
create index offers_order_rider_answered on offers (order_id, rider_id, answered_at);
create trigger offers_updated_at before update on offers for each row execute function set_updated_at();
