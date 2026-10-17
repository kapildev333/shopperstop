-- Where a store is, for rider dispatch (D57): ETA from a rider's position to the store.
-- Both null (no location; the store dispatches nothing) or both set.
alter table stores add column lat double precision check (lat between -90 and 90);
alter table stores add column lng double precision check (lng between -180 and 180);
alter table stores add constraint stores_location_both check ((lat is null) = (lng is null));
