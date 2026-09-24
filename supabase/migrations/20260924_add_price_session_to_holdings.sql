alter table public.holdings
add column if not exists price_as_of timestamptz,
add column if not exists price_session text;
