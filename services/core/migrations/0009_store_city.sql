-- The city a store is in, for the customer's header ("560034, Bengaluru"). '' means not set;
-- existing stores get '' and an admin sets it later.
alter table stores add column city text not null default '';
