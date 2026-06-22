// Value a fixed-income holding (CDB-style) from BCB rate series. Server-side
// (fetches from the BCB connector). Base currency is BRL throughout.
//
// A holding stores principal in buy_price (quantity = 1), the application date
// in buy_date, and the rate in fi_index/fi_rate:
//   CDI  -> fi_rate% of the daily CDI, compounded
//   IPCA -> cumulative IPCA × (1 + fi_rate%)^years   (IPCA + spread)
//   PRE  -> (1 + fi_rate%)^years                       (prefixed)
import type { Holding } from "./types";
import { daysBetween } from "./returns";
import {
  SGS,
  fetchSgsSeries,
  compoundCdiFactor,
  cumulativeIpcaFactor,
} from "./marketdata/bcb";

export interface FixedIncomeValuation {
  principal: number; // BRL invested
  currentValue: number; // BRL accrued to asOf
  gain: number; // currentValue - principal
  factor: number; // growth factor (1.12 = +12%)
  asOf: string; // ISO date the value is computed to
  matured: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

// Accrue a fixed-income holding to `asOf` (defaults to today, but never past
// maturity). Returns null if it isn't a fixed-income holding or the rate series
// can't be fetched.
export async function valueFixedIncome(
  holding: Holding,
  asOf: string = today(),
): Promise<FixedIncomeValuation | null> {
  if (holding.asset_class !== "FixedIncome") return null;
  if (holding.fi_index == null || holding.fi_rate == null) return null;

  const principal = holding.quantity * holding.buy_price;
  const start = holding.buy_date.slice(0, 10);

  // Stop accruing at maturity if the bond has already matured.
  const matured =
    holding.fi_maturity != null && holding.fi_maturity.slice(0, 10) <= asOf;
  const end = matured ? holding.fi_maturity!.slice(0, 10) : asOf;

  if (end <= start) {
    return { principal, currentValue: principal, gain: 0, factor: 1, asOf: end, matured };
  }

  const factor = await growthFactor(holding.fi_index, holding.fi_rate, start, end);
  if (factor == null) return null;

  const currentValue = principal * factor;
  return {
    principal,
    currentValue,
    gain: currentValue - principal,
    factor,
    asOf: end,
    matured,
  };
}

async function growthFactor(
  index: string,
  rate: number,
  start: string,
  end: string,
): Promise<number | null> {
  if (index === "CDI") {
    const series = await fetchSgsSeries(SGS.CDI_DAILY, start, end);
    if (series.length === 0) return null;
    return compoundCdiFactor(series, rate);
  }

  // Prefixed and IPCA+ accrue on a 252-business-day basis; we annualize over
  // calendar years (a close, calendar-simple approximation).
  const years = daysBetween(start, end) / 365;
  const spread = Math.pow(1 + rate / 100, years);

  if (index === "PRE") return spread;

  if (index === "IPCA") {
    const series = await fetchSgsSeries(SGS.IPCA_MONTHLY, start, end);
    if (series.length === 0) return null;
    return cumulativeIpcaFactor(series) * spread;
  }

  return null;
}
