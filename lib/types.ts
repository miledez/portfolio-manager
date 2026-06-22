import type { AssetClass } from "./constants";

// Fixed-income index a CDB-style holding tracks. See supabase/schema.sql.
//   CDI  -> fi_rate is "% of CDI"        (110)
//   IPCA -> fi_rate is the spread % p.a.  (IPCA + 6 -> 6)
//   PRE  -> fi_rate is the fixed  % p.a.  (12)
export type FiIndex = "CDI" | "IPCA" | "PRE";

// One purchase = one `holdings` row (a "lot"). Mirrors supabase/schema.sql.
// Fixed-income rows: quantity = 1, buy_price = principal (BRL), buy_date =
// application date, and the fi_* fields carry the rate terms (NULL otherwise).
export interface Holding {
  id: string;
  user_id: string;
  ticker: string;
  asset_class: AssetClass;
  quantity: number;
  buy_price: number; // cash = 1; fixed income = principal in BRL
  buy_date: string; // ISO date (YYYY-MM-DD)
  fi_index: FiIndex | null;
  fi_rate: number | null;
  fi_maturity: string | null; // ISO date
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

// External cash moving in/out of the portfolio. Mirrors supabase/schema.sql.
// amount > 0 = deposit (money in), amount < 0 = withdrawal.
export interface Contribution {
  id: string;
  user_id: string;
  flow_date: string; // ISO date (YYYY-MM-DD)
  amount: number; // BRL, signed
  note: string | null;
  created_at: string;
}
