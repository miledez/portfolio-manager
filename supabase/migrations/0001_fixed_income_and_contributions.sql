-- Phase 1: fixed-income holdings + a contributions (cash-flow) log.
-- Apply to an existing database in the Supabase SQL editor, or via
-- `supabase db push`. supabase/schema.sql carries the same changes for
-- fresh installs.

-- 1) Allow 'FixedIncome' as an asset class (CDBs, Tesouro, LCI/LCA, ...).
alter table public.holdings
  drop constraint if exists holdings_asset_class_check;
alter table public.holdings
  add constraint holdings_asset_class_check
  check (asset_class in ('Stock','ETF','Crypto','Cash','FixedIncome'));

-- 2) Fixed-income terms. NULL for every non-FixedIncome row.
--    A CDB is stored as quantity = 1, buy_price = principal (BRL),
--    buy_date = application date. The rate is described by:
--      fi_index = 'CDI'  -> fi_rate is "% of CDI"      (e.g. 110)
--      fi_index = 'IPCA' -> fi_rate is the spread % p.a. (IPCA + 6  -> 6)
--      fi_index = 'PRE'  -> fi_rate is the fixed   % p.a. (12)
alter table public.holdings add column if not exists fi_index    text;
alter table public.holdings add column if not exists fi_rate     numeric;
alter table public.holdings add column if not exists fi_maturity date;

alter table public.holdings
  drop constraint if exists holdings_fi_index_check;
alter table public.holdings
  add constraint holdings_fi_index_check
  check (fi_index is null or fi_index in ('CDI','IPCA','PRE'));

-- FixedIncome rows must carry an index + rate; other classes must not.
alter table public.holdings
  drop constraint if exists holdings_fi_consistency_check;
alter table public.holdings
  add constraint holdings_fi_consistency_check
  check (
    (asset_class = 'FixedIncome' and fi_index is not null and fi_rate is not null)
    or
    (asset_class <> 'FixedIncome' and fi_index is null and fi_rate is null)
  );

-- 3) Contributions: external cash moving in/out of the portfolio.
--    Powers money-weighted (XIRR) returns that don't mistake deposits
--    for gains. amount > 0 = deposit (money in), amount < 0 = withdrawal.
create table if not exists public.contributions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  flow_date  date not null default current_date,
  amount     numeric not null check (amount <> 0), -- BRL; +deposit / -withdrawal
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists contributions_user_date_idx
  on public.contributions (user_id, flow_date);

alter table public.contributions enable row level security;

drop policy if exists "own contributions" on public.contributions;
create policy "own contributions" on public.contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
