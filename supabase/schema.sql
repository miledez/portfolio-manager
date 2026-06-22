-- Portfolio dashboard schema
-- Apply in Supabase SQL editor, or via `supabase db push` as a migration.

create extension if not exists "pgcrypto";

-- Holdings: one row per purchase lot
create table public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  asset_class text not null check (asset_class in ('Stock','ETF','Crypto','Cash','FixedIncome')),
  quantity    numeric not null check (quantity > 0),
  buy_price   numeric not null default 1 check (buy_price >= 0), -- cash = 1
  buy_date    date not null default current_date,
  -- Fixed-income terms (NULL for every non-FixedIncome row). A CDB is stored as
  -- quantity = 1, buy_price = principal (BRL), buy_date = application date.
  --   fi_index = 'CDI'  -> fi_rate is "% of CDI"        (110)
  --   fi_index = 'IPCA' -> fi_rate is the spread % p.a.  (IPCA + 6 -> 6)
  --   fi_index = 'PRE'  -> fi_rate is the fixed  % p.a.  (12)
  fi_index    text check (fi_index is null or fi_index in ('CDI','IPCA','PRE')),
  fi_rate     numeric,
  fi_maturity date,
  created_at  timestamptz not null default now(),
  constraint holdings_fi_consistency_check check (
    (asset_class = 'FixedIncome' and fi_index is not null and fi_rate is not null)
    or
    (asset_class <> 'FixedIncome' and fi_index is null and fi_rate is null)
  )
);

-- Contributions: external cash moving in/out of the portfolio. Powers
-- money-weighted (XIRR) returns that don't mistake deposits for gains.
-- amount > 0 = deposit (money in), amount < 0 = withdrawal.
create table public.contributions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  flow_date  date not null default current_date,
  amount     numeric not null check (amount <> 0), -- BRL
  note       text,
  created_at timestamptz not null default now()
);

-- Daily total-value snapshots: one per user per day
create table public.snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  total_value   numeric not null,
  created_at    timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

-- Target allocation per asset class (strategy analyzer, Phase 6)
create table public.allocation_targets (
  user_id     uuid not null references auth.users(id) on delete cascade,
  asset_class text not null check (asset_class in ('Stock','ETF','Crypto','Cash')),
  target_pct  numeric not null check (target_pct between 0 and 100),
  primary key (user_id, asset_class)
);

-- Indexes
create index holdings_user_idx          on public.holdings (user_id);
create index snapshots_user_date_idx    on public.snapshots (user_id, snapshot_date);
create index contributions_user_date_idx on public.contributions (user_id, flow_date);

-- Row Level Security: users only ever see/write their own rows
alter table public.holdings           enable row level security;
alter table public.snapshots          enable row level security;
alter table public.allocation_targets enable row level security;
alter table public.contributions      enable row level security;

create policy "own holdings" on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own snapshots" on public.snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own targets" on public.allocation_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own contributions" on public.contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
