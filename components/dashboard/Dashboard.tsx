"use client";

import { useMemo, useState, useTransition } from "react";
import { signOut, removeHolding } from "@/app/actions";
import type { Holding } from "@/lib/types";
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

export default function Dashboard({
  holdings,
  userEmail,
}: {
  holdings: Holding[];
  userEmail: string;
}) {
  const [allocBy, setAllocBy] = useState<AllocBy>("ticker");
  // Live prices are fetched on demand and held here (wired up in Phase 4).
  const [prices] = useState<Record<string, number>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => computeRows(holdings, prices), [holdings, prices]);
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const allocation = useMemo(
    () => computeAllocation(rows, allocBy),
    [rows, allocBy],
  );
  const assetTypes = new Set(holdings.map((h) => h.asset_class)).size;

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
            <p className="text-xs text-muted">{userEmail}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-negative"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
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
      </main>
    </div>
  );
}
