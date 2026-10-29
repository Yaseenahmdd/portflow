-- Earnings data is about a company, not a user, so these tables are shared.
-- The nightly job writes with the service role; signed-in users only read.

create or replace function public.set_earnings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Latest snapshot per symbol: next report, estimates, analysts, revenue, headlines.
create table if not exists public.earnings_symbols (
  symbol text primary key,
  upcoming jsonb,
  details jsonb not null default '{}'::jsonb,
  headlines jsonb not null default '[]'::jsonb,
  price double precision,
  fetched_at timestamptz not null,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists earnings_symbols_set_updated_at on public.earnings_symbols;

create trigger earnings_symbols_set_updated_at
before update on public.earnings_symbols
for each row
execute function public.set_earnings_updated_at();

alter table public.earnings_symbols enable row level security;

create policy "earnings_symbols_select_authenticated"
on public.earnings_symbols
for select
to authenticated
using (true);

-- One row per reported quarter. Rows are never deleted, so history grows
-- past the four quarters the source returns.
create table if not exists public.earnings_reports (
  symbol text not null,
  fiscal_quarter text not null,
  reported_date date not null,
  eps double precision,
  consensus_eps double precision,
  surprise_percent double precision,
  reaction_before_date date,
  reaction_after_date date,
  reaction_change_percent double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (symbol, fiscal_quarter)
);

create index if not exists earnings_reports_symbol_date_idx
on public.earnings_reports (symbol, reported_date desc);

drop trigger if exists earnings_reports_set_updated_at on public.earnings_reports;

create trigger earnings_reports_set_updated_at
before update on public.earnings_reports
for each row
execute function public.set_earnings_updated_at();

alter table public.earnings_reports enable row level security;

create policy "earnings_reports_select_authenticated"
on public.earnings_reports
for select
to authenticated
using (true);

-- One row per symbol, period and night, to show how expectations moved.
create table if not exists public.earnings_estimate_history (
  symbol text not null,
  period_type text not null check (period_type in ('quarter', 'year')),
  fiscal_period text not null,
  as_of_date date not null,
  consensus double precision,
  high double precision,
  low double precision,
  analysts integer,
  revisions_up integer,
  revisions_down integer,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (symbol, period_type, fiscal_period, as_of_date)
);

alter table public.earnings_estimate_history enable row level security;

create policy "earnings_estimate_history_select_authenticated"
on public.earnings_estimate_history
for select
to authenticated
using (true);
