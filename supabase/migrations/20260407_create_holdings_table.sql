create table if not exists public.holdings (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  platform text not null,
  asset_name text not null,
  ticker text not null default '',
  asset_class text not null,
  sector text not null default '',
  geography text not null,
  risk text not null,
  quantity double precision not null default 0,
  avg_buy_price double precision not null default 0,
  current_price double precision not null default 0,
  currency text not null,
  notes text not null default '',
  price_source text not null,
  scheme_code text,
  last_price_update timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create or replace function public.set_holdings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists holdings_set_updated_at on public.holdings;

create trigger holdings_set_updated_at
before update on public.holdings
for each row
execute function public.set_holdings_updated_at();

alter table public.holdings enable row level security;

create policy "holdings_select_own"
on public.holdings
for select
using (auth.uid() = user_id);

create policy "holdings_insert_own"
on public.holdings
for insert
with check (auth.uid() = user_id);

create policy "holdings_update_own"
on public.holdings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "holdings_delete_own"
on public.holdings
for delete
using (auth.uid() = user_id);
