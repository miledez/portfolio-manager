import type { Holding } from "./types";
import { isCash, isFixedIncome } from "./constants";
import { BASE_CURRENCY, nativeCurrency } from "./currency";

// View-model: a holding with its native price and base-currency (BRL) figures.
export interface Row extends Holding {
  currency: string; // native quote currency (for per-share display)
  price: number | null; // native per-share price
  costBasis: number | null; // in base currency (BRL)
  value: number | null; // in base currency (BRL)
  gain: number | null; // in base currency (BRL)
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

// `prices` are native per-share; `fx` maps currency -> rate into BASE_CURRENCY.
// Cash counts immediately (price = 1, native = base). Fixed income is valued
// from BCB rate series server-side and passed in via `fiValues` (current BRL
// value keyed by holding id). Everything is converted to the base currency.
export function computeRows(
  holdings: Holding[],
  prices: Record<string, number>,
  fx: Record<string, number>,
  fiValues: Record<string, number> = {},
): Row[] {
  return holdings.map((h) => {
    const currency = nativeCurrency(h.ticker, h.asset_class);
    const rate = fx[currency] ?? (currency === BASE_CURRENCY ? 1 : null);
    // Cash/FI are native BRL; market holdings convert native -> BRL.
    const costBasis = rate != null ? h.quantity * h.buy_price * rate : null;

    let price: number | null;
    let value: number | null;
    if (isCash(h.asset_class)) {
      price = 1;
      value = rate != null ? h.quantity * rate : null;
    } else if (isFixedIncome(h.asset_class)) {
      value = fiValues[h.id] ?? null;
      price = value != null && h.quantity > 0 ? value / h.quantity : null;
    } else {
      price = prices[h.ticker] ?? null;
      value = price != null && rate != null ? h.quantity * price * rate : null;
    }

    const gain = value != null && costBasis != null ? value - costBasis : null;
    const gainPct =
      value != null && costBasis ? ((value - costBasis) / costBasis) * 100 : null;
    return { ...h, currency, price, costBasis, value, gain, gainPct };
  });
}

export function computeTotals(rows: Row[]): Totals {
  const cost = rows.reduce((s, r) => s + (r.costBasis ?? 0), 0);
  const priced = rows.filter((r) => r.value != null);
  const value = priced.reduce((s, r) => s + (r.value ?? 0), 0);
  const valuedCost = priced.reduce((s, r) => s + (r.costBasis ?? 0), 0);
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
