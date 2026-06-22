// Comparison engine — normalizes every holding and benchmark to comparable
// annualized returns through three lenses: nominal, real (inflation-adjusted),
// and after-tax. Pure: it consumes already-computed BRL figures (equity values
// from lib/portfolio, fixed income from lib/fixedincome, benchmark totals from
// the connectors), so it has no I/O and is fully testable.
//
// This answers the headline question — "is my CDB actually keeping up with my
// ETFs and stocks?" — on an apples-to-apples basis.
import { annualize, realReturn, daysBetween } from "./returns";
import { afterTaxReturn } from "./tax/br";

export interface ReturnBreakdown {
  name: string;
  assetClass: string; // "" for benchmarks
  holdingDays: number;
  periodReturn: number; // total return over the period
  annualizedNominal: number | null;
  annualizedReal: number | null; // null when inflation is unknown
  annualizedAfterTax: number | null; // null for benchmarks (shown gross)
}

export interface AssetReturnInput {
  name: string;
  assetClass: string;
  costBasis: number; // BRL invested
  currentValue: number; // BRL now
  startDate: string; // ISO (buy/application date)
  asOf?: string; // ISO (defaults to today)
}

const today = () => new Date().toISOString().slice(0, 10);

// Annualized inflation from a cumulative IPCA factor over `days` (factor 1.05
// over 365 days -> ~5%). Feed this as `inflationAnnual` for the real lens.
export function annualizedInflation(
  cumulativeIpcaFactor: number,
  days: number,
): number | null {
  return annualize(cumulativeIpcaFactor - 1, days);
}

// Break a single holding's return into the three lenses. `inflationAnnual` is
// the annualized inflation over the holding period (omit to skip the real lens).
export function analyzeAsset(
  input: AssetReturnInput,
  inflationAnnual?: number,
): ReturnBreakdown {
  const asOf = input.asOf ?? today();
  const holdingDays = Math.max(0, daysBetween(input.startDate, asOf));
  const periodReturn =
    input.costBasis > 0 ? input.currentValue / input.costBasis - 1 : 0;
  const annualizedNominal = annualize(periodReturn, holdingDays);

  return {
    name: input.name,
    assetClass: input.assetClass,
    holdingDays,
    periodReturn,
    annualizedNominal,
    annualizedReal:
      annualizedNominal != null && inflationAnnual != null
        ? realReturn(annualizedNominal, inflationAnnual)
        : null,
    annualizedAfterTax:
      annualizedNominal != null
        ? afterTaxReturn(annualizedNominal, input.assetClass, holdingDays)
        : null,
  };
}

// Break a benchmark's return into the same lenses (shown gross / pre-tax).
// `totalReturn` is the benchmark's total return over [startDate, asOf].
export function analyzeBenchmark(
  name: string,
  totalReturn: number,
  startDate: string,
  asOf: string = today(),
  inflationAnnual?: number,
): ReturnBreakdown {
  const holdingDays = Math.max(0, daysBetween(startDate, asOf));
  const annualizedNominal = annualize(totalReturn, holdingDays);
  return {
    name,
    assetClass: "",
    holdingDays,
    periodReturn: totalReturn,
    annualizedNominal,
    annualizedReal:
      annualizedNominal != null && inflationAnnual != null
        ? realReturn(annualizedNominal, inflationAnnual)
        : null,
    annualizedAfterTax: null,
  };
}

// Build a comparison table: every holding plus benchmarks, ranked by
// annualized nominal return (descending; unknowns last). Benchmarks share the
// earliest holding start so the periods line up.
export function buildComparison(
  assets: AssetReturnInput[],
  benchmarks: { name: string; totalReturn: number; startDate: string }[],
  inflationAnnual?: number,
): ReturnBreakdown[] {
  const rows = [
    ...assets.map((a) => analyzeAsset(a, inflationAnnual)),
    ...benchmarks.map((b) =>
      analyzeBenchmark(b.name, b.totalReturn, b.startDate, today(), inflationAnnual),
    ),
  ];
  return rows.sort(
    (a, b) => (b.annualizedNominal ?? -Infinity) - (a.annualizedNominal ?? -Infinity),
  );
}
