-- Baseline: citext for case-insensitive emails and the updated_at trigger every table uses.
create extension if not exists citext with schema public;

create function set_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end
$$;
