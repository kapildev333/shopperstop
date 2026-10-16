-- Email verification and password reset (core-accounts-security).
-- Existing customers start unverified.
alter table customers add column email_verified boolean not null default false;

-- One-time tokens mailed to a customer. Like sessions, only sha256(token || pepper)
-- is stored. A customer holds at most one token per purpose: a new one replaces it.
create table customer_tokens (
    id          uuid primary key default gen_random_uuid(),
    token_hash  bytea not null unique,
    customer_id uuid not null references customers (id) on delete cascade,
    purpose     text not null check (purpose in ('verify_email', 'reset_password')),
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index customer_tokens_one_per_purpose on customer_tokens (customer_id, purpose);
create trigger customer_tokens_updated_at before update on customer_tokens for each row execute function set_updated_at();
