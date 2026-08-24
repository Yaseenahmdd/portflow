alter table public.holdings
add column if not exists previous_close double precision,
add column if not exists day_change_percent double precision;
