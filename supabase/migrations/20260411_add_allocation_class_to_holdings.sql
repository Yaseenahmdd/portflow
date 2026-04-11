alter table public.holdings
add column if not exists allocation_class text;

update public.holdings
set allocation_class = asset_class
where allocation_class is null;
