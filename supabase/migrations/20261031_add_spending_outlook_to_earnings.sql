-- Capex/cost outlook per report, kept apart from revenue/profit guidance
-- because a higher spending plan is not a raised forecast.

alter table public.earnings_reports
  add column if not exists spending_outlook text check (spending_outlook in ('raised', 'lowered')),
  add column if not exists spending_headline text,
  add column if not exists spending_url text;
