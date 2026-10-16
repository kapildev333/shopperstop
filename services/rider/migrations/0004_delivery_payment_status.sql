-- The payment status core held for an online order when a rider claimed it (rider-collect-cash); '' for cash.
alter table deliveries add column payment_status text not null default '';
