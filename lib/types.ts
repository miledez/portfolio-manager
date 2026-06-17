import type { AssetClass } from "./constants";

// One purchase = one `holdings` row (a "lot"). Mirrors supabase/schema.sql.
export interface Holding {
  id: string;
  user_id: string;
  ticker: string;
  asset_class: AssetClass;
  quantity: number;
  buy_price: number; // cash = 1
  buy_date: string; // ISO date (YYYY-MM-DD)
  created_at: string;
}

// A holding enriched with a live price + derived figures.
// `price` is fetched on demand and held in client state — not persisted on `holdings`.
export interface PricedHolding extends Holding {
  price: number | null;
  costBasis: number;
  value: number | null;
  gain: number | null;
  gainPct: number | null;
}

// One row per user per day.
export interface Snapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_value: number;
  created_at: string;
}

// Target allocation per asset class (strategy analyzer, Phase 6).
export interface AllocationTarget {
  user_id: string;
  asset_class: AssetClass;
  target_pct: number;
}
