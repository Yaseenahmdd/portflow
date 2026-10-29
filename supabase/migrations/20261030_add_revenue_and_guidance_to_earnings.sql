-- Revenue beat/miss (Finnhub) and guidance signals per reported quarter.
-- Revenue is in the company's reporting currency, so compare it as a ratio.

alter table public.earnings_reports
  add column if not exists revenue_estimate double precision,
  add column if not exists revenue_actual double precision,
  add column if not exists revenue_surprise_percent double precision,
  add column if not exists guidance text check (guidance in ('raised', 'lowered', 'reaffirmed')),
  add column if not exists guidance_headline text,
  add column if not exists guidance_url text,
  add column if not exists estimate_change_percent double precision;

alter table public.earnings_symbols
  add column if not exists company_name text;
