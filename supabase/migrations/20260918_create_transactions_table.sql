create table if not exists public.transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  transaction_type text not null check (
    transaction_type in ('buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'fee', 'split', 'fx')
  ),
  transaction_date date not null,
  holding_id text,
  platform text not null default '',
  asset_name text not null default '',
  ticker text not null default '',
  currency text not null check (currency in ('AED', 'USD', 'INR')),
  quantity double precision check (quantity is null or quantity > 0),
  unit_price double precision check (unit_price is null or unit_price >= 0),
  amount double precision check (amount is null or amount >= 0),
  fees double precision not null default 0 check (fees >= 0),
  fx_rate_to_aed double precision check (fx_rate_to_aed is null or fx_rate_to_aed > 0),
  target_currency text check (target_currency is null or target_currency in ('AED', 'USD', 'INR')),
  target_amount double precision check (target_amount is null or target_amount > 0),
  split_ratio double precision check (split_ratio is null or split_ratio > 0),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create index if not exists transactions_user_date_idx
on public.transactions (user_id, transaction_date desc);

create index if not exists transactions_user_holding_idx
on public.transactions (user_id, holding_id)
where holding_id is not null;

create or replace function public.set_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_transactions_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_select_own"
on public.transactions
for select
using (auth.uid() = user_id);

create policy "transactions_insert_own"
on public.transactions
for insert
with check (auth.uid() = user_id);

create policy "transactions_update_own"
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "transactions_delete_own"
on public.transactions
for delete
using (auth.uid() = user_id);
