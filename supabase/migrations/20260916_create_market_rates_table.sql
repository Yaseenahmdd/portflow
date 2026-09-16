create table if not exists public.market_rates (
  pair text primary key,
  rate double precision not null check (rate > 0),
  fetched_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_market_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists market_rates_set_updated_at on public.market_rates;

create trigger market_rates_set_updated_at
before update on public.market_rates
for each row
execute function public.set_market_rates_updated_at();

alter table public.market_rates enable row level security;

create policy "market_rates_select_all"
on public.market_rates
for select
using (true);
