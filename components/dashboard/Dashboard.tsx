"use client";

import { useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { signOut, removeHolding } from "@/app/actions";
import type { Holding } from "@/lib/types";
import { isCash } from "@/lib/constants";
import {
  computeRows,
  computeTotals,
  computeAllocation,
  type AllocBy,
} from "@/lib/portfolio";
import SummaryStats from "./SummaryStats";
import AddHoldingForm from "./AddHoldingForm";
import HoldingsTable from "./HoldingsTable";
import AllocationCard from "./AllocationCard";
import DevelopmentChart, { type SnapshotPoint } from "./DevelopmentChart";
import StrategyCard from "./StrategyCard";

export default function Dashboard({
  holdings,
  snapshots,
  initialTargets,
  userEmail,
}: {
  holdings: Holding[];
  snapshots: SnapshotPoint[];
  initialTargets: Record<string, number>;
  userEmail: string;
}) {
  const [allocBy, setAllocBy] = useState<AllocBy>("ticker");
  // Live prices are fetched on demand and held here, keyed by ticker.
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => computeRows(holdings, prices), [holdings, prices]);
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const allocation = useMemo(
    () => computeAllocation(rows, allocBy),
    [rows, allocBy],
  );
  const assetTypes = new Set(holdings.map((h) => h.asset_class)).size;
  const classValues = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.value != null) m[r.asset_class] = (m[r.asset_class] ?? 0) + r.value;
    });
    return m;
  }, [rows]);

  async function updatePrices() {
    const items = holdings
      .filter((h) => !isCash(h.asset_class))
      .map((h) => ({ ticker: h.ticker, assetClass: h.asset_class }));

    if (items.length === 0) {
      setUpdatedAt(new Date());
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { prices?: Record<string, number> };
      const fetched = data.prices ?? {};
      if (Object.keys(fetched).length === 0) throw new Error("no prices");
      setPrices((prev) => ({ ...prev, ...fetched }));
      setUpdatedAt(new Date());
    } catch {
      setError(
        "Couldn't fetch prices. Check your tickers are valid symbols and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      await removeHolding(id);
      setRemovingId(null);
    });
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
            <p className="text-xs text-muted">
              {updatedAt
                ? `Prices updated ${updatedAt.toLocaleTimeString()}`
                : "Prices not yet updated"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={updatePrices}
              disabled={loading || holdings.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Updating…" : "Update prices"}
            </button>
            <span className="hidden text-xs text-muted sm:inline">
              {userEmail}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-2 py-2 text-sm text-muted transition-colors hover:text-negative"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        {error && (
          <div className="rounded-md border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">
            {error}
          </div>
        )}

        <SummaryStats
          totals={totals}
          holdingsCount={holdings.length}
          assetTypes={assetTypes}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <AddHoldingForm />
            <HoldingsTable
              rows={rows}
              onRemove={handleRemove}
              removingId={removingId}
            />
          </div>
          <AllocationCard
            allocation={allocation}
            allocBy={allocBy}
            onAllocByChange={setAllocBy}
            totalValue={totals.value}
          />
        </div>

        <StrategyCard
          initialTargets={initialTargets}
          currentByClass={classValues}
          totalValue={totals.value}
        />

        <DevelopmentChart snapshots={snapshots} />

        <p className="text-xs leading-relaxed text-[#9CA3AF]">
          Prices are fetched live on request and may be delayed. Daily value
          snapshots are saved server-side and build up over time. Not financial
          advice.
        </p>
      </main>
    </div>
  );
}
