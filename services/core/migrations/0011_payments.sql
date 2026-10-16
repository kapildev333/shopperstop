-- Payments (core-payments, D50, D51): how an order is paid and, for an online
-- order, where its payment stands; a sequence number on every order event so
-- services can tail them in commit order.
alter table orders drop constraint orders_payment_method_check;
alter table orders add constraint orders_payment_method_check check (payment_method in ('cod', 'online'));
create type payment_status as enum ('pending', 'paid', 'refunded');
alter table orders add column payment_status payment_status;
alter table orders add column payment_reference text not null default '';
-- A cash order has no payment status; an online order always has one.
alter table orders add constraint orders_payment_status check ((payment_method = 'online') = (payment_status is not null));

-- Existing events are numbered in no particular order; new ones in commit order
-- (every event insert takes the events lock first, see queries/order.sql LockEvents).
alter table order_events add column seq bigserial not null;
create unique index order_events_seq on order_events (seq);
