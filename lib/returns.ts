// Return math — pure, dependency-free, testable. All rates are decimals
// (0.12 = 12%). Dates are ISO "YYYY-MM-DD".

const MS_PER_DAY = 86_400_000;

export function daysBetween(startIso: string, endIso: string): number {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  return Math.round((b - a) / MS_PER_DAY);
}

// Annualize a holding-period total return over `days` (365-day year).
export function annualize(totalReturn: number, days: number): number | null {
  if (days <= 0) return null;
  return Math.pow(1 + totalReturn, 365 / days) - 1;
}

// Compound annual growth rate from start to end value over `days`.
export function cagr(
  startValue: number,
  endValue: number,
  days: number,
): number | null {
  if (startValue <= 0 || days <= 0) return null;
  return annualize(endValue / startValue - 1, days);
}

// Inflation-adjusted ("real") return given a nominal return and inflation over
// the same period (Fisher): (1 + nominal) / (1 + inflation) - 1.
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

export interface CashFlow {
  date: string; // ISO
  amount: number; // negative = invested (out of pocket), positive = received
}

// Money-weighted return (XIRR): the annualized rate r where the NPV of the
// cash flows is zero. Returns null if it can't be solved (e.g. all-positive or
// all-negative flows). Uses Newton's method with a bisection fallback.
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = sorted[0].date;
  const hasPos = sorted.some((f) => f.amount > 0);
  const hasNeg = sorted.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const years = (f: CashFlow) => daysBetween(t0, f.date) / 365;
  const npv = (r: number) =>
    sorted.reduce((s, f) => s + f.amount / Math.pow(1 + r, years(f)), 0);

  // Newton's method from a sensible guess.
  let r = 0.1;
  for (let i = 0; i < 60; i++) {
    const f = npv(r);
    const dr = 1e-6;
    const d = (npv(r + dr) - f) / dr;
    if (!Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - r) < 1e-8) return next;
    r = next;
  }

  // Bisection fallback over a wide bracket.
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo);
  if (flo * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) hi = mid;
    else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}
