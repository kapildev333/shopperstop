-- Rider handoff (D30): the rider's name on the order and the actor's name on its events.
alter table orders add column rider_name text;
alter table order_events add column actor_name text;
alter table order_events drop constraint order_events_actor_type_check;
alter table order_events add constraint order_events_actor_type_check
    check (actor_type in ('customer', 'staff', 'system', 'rider'));
