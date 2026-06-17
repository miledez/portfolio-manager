-- Portfolio dashboard schema
-- Apply in Supabase SQL editor, or via `supabase db push` as a migration.

create extension if not exists "pgcrypto";

-- Holdings: one row per purchase lot
create table public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  asset_class text not null check (asset_class in ('Stock','ETF','Crypto','Cash')),
  quantity    numeric not null check (quantity > 0),
  buy_price   numeric not null default 1 check (buy_price >= 0), -- cash = 1
  buy_date    date not null default current_date,
  created_at  timestamptz not null default now()
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
create index holdings_user_idx       on public.holdings (user_id);
create index snapshots_user_date_idx on public.snapshots (user_id, snapshot_date);

-- Row Level Security: users only ever see/write their own rows
alter table public.holdings           enable row level security;
alter table public.snapshots          enable row level security;
alter table public.allocation_targets enable row level security;

create policy "own holdings" on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own snapshots" on public.snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own targets" on public.allocation_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
