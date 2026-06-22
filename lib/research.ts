// Shared server-side builder for the research view's deterministic figures.
// Used by both the /research page and the /api/advice route so the AI narrates
// exactly the numbers the user sees — it never recomputes or invents them.
import type { createClient } from "@/lib/supabase/server";
import { isCash, isFixedIncome } from "@/lib/constants";
import { nativeCurrency } from "@/lib/currency";
import { fetchPrices, fetchFxRates, type PriceItem } from "@/lib/pricing";
import { valueFixedIncome } from "@/lib/fixedincome";
import { computeRows } from "@/lib/portfolio";
import {
  SGS,
  fetchSgsSeries,
  compoundCdiFactor,
  cumulativeIpcaFactor,
} from "@/lib/marketdata/bcb";
import {
  BRAPI_TICKERS,
  fetchBrapiHistory,
  historyReturn,
} from "@/lib/marketdata/brapi";
import {
  buildComparison,
  annualizedInflation,
  type ReturnBreakdown,
  type AssetReturnInput,
} from "@/lib/compare";
import { xirr, daysBetween, type CashFlow } from "@/lib/returns";
import type { Holding, Contribution } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ResearchData {
  comparison: ReturnBreakdown[];
  benchmarks: { name: string; totalReturn: number; startDate: string }[];
  totalValue: number;
  portfolioReturn: number | null;
  inflationAnnual: number | undefined;
  earliestStart: string;
  asOf: string;
  contributions: Contribution[];
}

// brapi history range that covers a span of `days`.
function brapiRange(days: number): string {
  if (days <= 180) return "6mo";
  if (days <= 365) return "1y";
  if (days <= 730) return "2y";
  if (days <= 1825) return "5y";
  return "10y";
}

export async function buildResearchData(
  supabase: SupabaseServerClient,
): Promise<ResearchData> {
  const asOf = new Date().toISOString().slice(0, 10);

  const [holdingsRes, contributionsRes] = await Promise.all([
    supabase.from("holdings").select("*").order("buy_date", { ascending: true }),
    supabase
      .from("contributions")
      .select("*")
      .order("flow_date", { ascending: true }),
  ]);
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const contributions = (contributionsRes.data ?? []) as Contribution[];

  // Earliest holding date anchors the benchmark periods (fallback: 1 year).
  const earliestStart =
    holdings.length > 0
      ? holdings.reduce(
          (min, h) => (h.buy_date < min ? h.buy_date : min),
          holdings[0].buy_date,
        )
      : new Date(Date.parse(asOf) - 365 * 86_400_000).toISOString().slice(0, 10);
  const spanDays = Math.max(1, daysBetween(earliestStart, asOf));

  const apiKey = process.env.MARKET_DATA_API_KEY;
  const priceItems: PriceItem[] = holdings
    .filter((h) => !isCash(h.asset_class) && !isFixedIncome(h.asset_class))
    .map((h) => ({ ticker: h.ticker, assetClass: h.asset_class }));

  const [priceResult, fx, fiVals, cdiSeries, ipcaSeries, ibovHistory] =
    await Promise.all([
      apiKey
        ? fetchPrices(priceItems, apiKey)
        : Promise.resolve({ prices: {}, missing: [] }),
      fetchFxRates(holdings.map((h) => nativeCurrency(h.ticker, h.asset_class))),
      Promise.all(
        holdings
          .filter((h) => isFixedIncome(h.asset_class))
          .map(async (h) => [h.id, await valueFixedIncome(h)] as const),
      ),
      fetchSgsSeries(SGS.CDI_DAILY, earliestStart, asOf),
      fetchSgsSeries(SGS.IPCA_MONTHLY, earliestStart, asOf),
      fetchBrapiHistory(BRAPI_TICKERS.IBOVESPA, brapiRange(spanDays)),
    ]);

  const fiValues: Record<string, number> = {};
  for (const [id, v] of fiVals) if (v) fiValues[id] = v.currentValue;

  const rows = computeRows(holdings, priceResult.prices, fx, fiValues);
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);

  const ipcaFactor =
    ipcaSeries.length > 0 ? cumulativeIpcaFactor(ipcaSeries) : null;
  const inflationAnnual =
    ipcaFactor != null
      ? (annualizedInflation(ipcaFactor, spanDays) ?? undefined)
      : undefined;

  const assets: AssetReturnInput[] = rows
    .filter((r) => r.value != null && r.costBasis != null && r.costBasis > 0)
    .map((r) => ({
      name: r.ticker,
      assetClass: r.asset_class,
      costBasis: r.costBasis as number,
      currentValue: r.value as number,
      startDate: r.buy_date,
    }));

  const benchmarks: { name: string; totalReturn: number; startDate: string }[] = [];
  if (cdiSeries.length > 0) {
    benchmarks.push({
      name: "CDI",
      totalReturn: compoundCdiFactor(cdiSeries, 100) - 1,
      startDate: earliestStart,
    });
  }
  if (ipcaFactor != null) {
    benchmarks.push({
      name: "IPCA (inflation)",
      totalReturn: ipcaFactor - 1,
      startDate: earliestStart,
    });
  }
  const ibovReturn = historyReturn(ibovHistory, earliestStart);
  if (ibovReturn != null) {
    benchmarks.push({
      name: "Ibovespa",
      totalReturn: ibovReturn,
      startDate: earliestStart,
    });
  }

  const comparison = buildComparison(assets, benchmarks, inflationAnnual);

  // Money-weighted portfolio return: prefer the contributions log; otherwise
  // treat each buy lot as the cash invested. Terminal = today's total value.
  const flows: CashFlow[] =
    contributions.length > 0
      ? contributions.map((c) => ({ date: c.flow_date, amount: -c.amount }))
      : assets.map((a) => ({ date: a.startDate, amount: -a.costBasis }));
  if (totalValue > 0) flows.push({ date: asOf, amount: totalValue });
  const portfolioReturn = xirr(flows);

  return {
    comparison,
    benchmarks,
    totalValue,
    portfolioReturn,
    inflationAnnual,
    earliestStart,
    asOf,
    contributions,
  };
}
