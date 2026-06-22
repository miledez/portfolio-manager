import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
  type AssetReturnInput,
} from "@/lib/compare";
import { xirr, daysBetween, type CashFlow } from "@/lib/returns";
import { money } from "@/lib/format";
import type { Holding, Contribution } from "@/lib/types";
import ComparisonTable from "@/components/research/ComparisonTable";
import AddFixedIncomeForm from "@/components/research/AddFixedIncomeForm";
import ContributionsCard from "@/components/research/ContributionsCard";

// brapi history range that covers a span of `days`.
function brapiRange(days: number): string {
  if (days <= 180) return "6mo";
  if (days <= 365) return "1y";
  if (days <= 730) return "2y";
  if (days <= 1825) return "5y";
  return "10y";
}

export default async function ResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

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
      : new Date(Date.parse(today) - 365 * 86_400_000).toISOString().slice(0, 10);
  const spanDays = Math.max(1, daysBetween(earliestStart, today));

  // Market holdings are priced server-side here (this is an on-demand analysis
  // page, not the live dashboard). Fixed income is valued from BCB series.
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
      fetchSgsSeries(SGS.CDI_DAILY, earliestStart, today),
      fetchSgsSeries(SGS.IPCA_MONTHLY, earliestStart, today),
      fetchBrapiHistory(BRAPI_TICKERS.IBOVESPA, brapiRange(spanDays)),
    ]);

  const fiValues: Record<string, number> = {};
  for (const [id, v] of fiVals) if (v) fiValues[id] = v.currentValue;

  const rows = computeRows(holdings, priceResult.prices, fx, fiValues);
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);

  // Inflation (annualized) drives the "real" lens.
  const ipcaFactor =
    ipcaSeries.length > 0 ? cumulativeIpcaFactor(ipcaSeries) : null;
  const inflationAnnual =
    ipcaFactor != null
      ? (annualizedInflation(ipcaFactor, spanDays) ?? undefined)
      : undefined;

  // Each priced holding becomes a comparison row.
  const assets: AssetReturnInput[] = rows
    .filter((r) => r.value != null && r.costBasis != null && r.costBasis > 0)
    .map((r) => ({
      name: r.ticker,
      assetClass: r.asset_class,
      costBasis: r.costBasis as number,
      currentValue: r.value as number,
      startDate: r.buy_date,
    }));

  // Benchmarks over the same horizon (omit any that failed to fetch).
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
  if (totalValue > 0) flows.push({ date: today, amount: totalValue });
  const portfolioReturn = xirr(flows);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Research</h1>
            <p className="text-xs text-muted">
              Comparison &amp; returns across your holdings
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
          >
            <ArrowLeft size={15} /> Portfolio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <p className="text-xs text-muted">Total value</p>
            <p className="text-xl font-semibold">{money(totalValue)}</p>
          </div>
        </div>

        <ComparisonTable rows={comparison} />

        <ContributionsCard
          contributions={contributions}
          portfolioReturn={portfolioReturn}
        />

        <AddFixedIncomeForm />

        <p className="text-xs leading-relaxed text-[#9CA3AF]">
          Benchmarks (CDI, IPCA, Ibovespa) are annualized over your earliest
          holding&apos;s horizon and shown gross of tax. Returns annualize each
          asset over its own holding period, so different periods aren&apos;t
          strictly comparable. After-tax figures apply the Brazilian IR rules and
          ignore monthly sale-value exemptions. Not financial advice.
        </p>
      </main>
    </div>
  );
}
