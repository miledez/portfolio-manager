// Brazilian income-tax rules for investment gains — pure functions.
// Rates are decimals (0.15 = 15%). These cover the common resident-individual
// cases; they intentionally ignore IOF (only relevant under 30 days) and the
// monthly sale-value exemptions, which are surfaced as flags/notes rather than
// auto-applied (the engine can't know your month's total sales).

// Regressive IR table for fixed income (renda fixa: CDB, Tesouro, etc.),
// by holding period in days.
export function fixedIncomeIrRate(holdingDays: number): number {
  if (holdingDays <= 180) return 0.225;
  if (holdingDays <= 360) return 0.2;
  if (holdingDays <= 720) return 0.175;
  return 0.15;
}

// Flat 15% on net gains from common share/ETF sales (swing trade).
export const EQUITY_IR_RATE = 0.15;

// Stocks (not ETFs) are exempt when total stock sales in the month are at or
// below this. Surfaced as a note; not auto-applied.
export const EQUITY_MONTHLY_EXEMPTION_BRL = 20_000;

// Flat 15% on crypto gains when monthly disposals exceed this.
export const CRYPTO_MONTHLY_EXEMPTION_BRL = 35_000;

// The IR rate that applies to gains on a holding of this class/age.
export function taxRateFor(assetClass: string, holdingDays: number): number {
  switch (assetClass) {
    case "FixedIncome":
      return fixedIncomeIrRate(holdingDays);
    case "Stock":
    case "ETF":
    case "Crypto":
      return EQUITY_IR_RATE;
    case "Cash":
    default:
      return 0;
  }
}

// After-tax version of a gross holding-period (or annualized) return. Tax
// applies only to the gain portion, so a 0.20 gain taxed at 15% nets 0.17.
// Losses are returned unchanged (no gain to tax).
export function afterTaxReturn(
  grossReturn: number,
  assetClass: string,
  holdingDays: number,
): number {
  if (grossReturn <= 0) return grossReturn;
  return grossReturn * (1 - taxRateFor(assetClass, holdingDays));
}
