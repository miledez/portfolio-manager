import { TrendingUp, TrendingDown } from "lucide-react";
import Stat from "@/components/ui/Stat";
import { usd, pct } from "@/lib/format";
import type { Totals } from "@/lib/portfolio";

export default function SummaryStats({
  totals,
  holdingsCount,
  assetTypes,
}: {
  totals: Totals;
  holdingsCount: number;
  assetTypes: number;
}) {
  const hasValue = totals.value > 0;
  const gainClass = !hasValue
    ? "text-muted"
    : totals.gain >= 0
      ? "text-positive"
      : "text-negative";

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat
        label="Total value"
        value={totals.fullyPriced || hasValue ? usd(totals.value) : "—"}
        big
      />
      <Stat label="Cost basis" value={usd(totals.cost)} />

      <div className="rounded-lg border border-hairline bg-surface p-4">
        <p className="mb-1 text-xs text-muted">Total gain / loss</p>
        <p className={`flex items-center gap-1.5 text-xl font-semibold ${gainClass}`}>
          {hasValue ? (
            <>
              {totals.gain >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {usd(totals.gain)}
            </>
          ) : (
            "—"
          )}
        </p>
        <p className={`mt-0.5 text-xs ${gainClass}`}>
          {hasValue ? pct(totals.gainPct) : "update prices to see"}
        </p>
      </div>

      <Stat
        label="Holdings"
        value={`${holdingsCount}`}
        sub={`${assetTypes} asset ${assetTypes === 1 ? "type" : "types"}`}
      />
    </section>
  );
}
