-- Store snapshots on orders (D34): the store's name and promised minutes at placement.
-- Every order has a store, so existing rows are backfilled from it and both columns are NOT NULL.
alter table orders add column store_name text, add column promised_minutes integer;
update orders o set store_name = s.name, promised_minutes = s.promised_minutes from stores s where s.id = o.store_id;
alter table orders alter column store_name set not null, alter column promised_minutes set not null;
