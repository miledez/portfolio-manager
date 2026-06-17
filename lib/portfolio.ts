import type { Holding } from "./types";
import { isCash } from "./constants";

// View-model: a holding enriched with a live price + derived figures.
export interface Row extends Holding {
  price: number | null;
  costBasis: number;
  value: number | null;
  gain: number | null;
  gainPct: number | null;
}

export interface Totals {
  cost: number;
  value: number;
  gain: number;
  gainPct: number;
  fullyPriced: boolean;
}

export interface AllocSlice {
  name: string;
  value: number;
}

export type AllocBy = "ticker" | "class";

// Cash counts immediately (price = 1); everything else needs a fetched price.
export function computeRows(
  holdings: Holding[],
  prices: Record<string, number>,
): Row[] {
  return holdings.map((h) => {
    const price = isCash(h.asset_class) ? 1 : (prices[h.ticker] ?? null);
    const costBasis = h.quantity * h.buy_price;
    const value = price != null ? h.quantity * price : null;
    const gain = value != null ? value - costBasis : null;
    const gainPct =
      value != null && costBasis ? ((value - costBasis) / costBasis) * 100 : null;
    return { ...h, price, costBasis, value, gain, gainPct };
  });
}

export function computeTotals(rows: Row[]): Totals {
  const cost = rows.reduce((s, r) => s + r.costBasis, 0);
  const priced = rows.filter((r) => r.value != null);
  const value = priced.reduce((s, r) => s + (r.value ?? 0), 0);
  const valuedCost = priced.reduce((s, r) => s + r.costBasis, 0);
  const gain = value - valuedCost;
  const gainPct = valuedCost ? (gain / valuedCost) * 100 : 0;
  return {
    cost,
    value,
    gain,
    gainPct,
    fullyPriced: priced.length === rows.length && rows.length > 0,
  };
}

export function computeAllocation(rows: Row[], by: AllocBy): AllocSlice[] {
  const groups: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.value == null) return;
    const key = by === "class" ? r.asset_class : r.ticker;
    groups[key] = (groups[key] || 0) + r.value;
  });
  return Object.entries(groups)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
