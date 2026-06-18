import { Trash2 } from "lucide-react";
import ClassBadge from "@/components/ui/ClassBadge";
import { money, pct } from "@/lib/format";
import { isCash } from "@/lib/constants";
import type { Row } from "@/lib/portfolio";

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}

export default function HoldingsTable({
  rows,
  onRemove,
  removingId,
}: {
  rows: Row[];
  onRemove: (id: string) => void;
  removingId: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted">
              <Th>Ticker</Th>
              <Th>Type</Th>
              <Th>Qty</Th>
              <Th>Buy price</Th>
              <Th>Date</Th>
              <Th>Now</Th>
              <Th>Value</Th>
              <Th>Gain / loss</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  No holdings yet. Add your first holding above.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const cash = isCash(r.asset_class);
              const gainClass =
                r.gain == null
                  ? "text-muted"
                  : r.gain >= 0
                    ? "text-positive"
                    : "text-negative";
              return (
                <tr
                  key={r.id}
                  className="border-b border-[#F1F2F4] last:border-0 hover:bg-[#FAFBFC]"
                >
                  <td className="px-4 py-3 font-semibold">{r.ticker}</td>
                  <td className="px-4 py-3">
                    <ClassBadge assetClass={r.asset_class} />
                  </td>
                  <td className="px-4 py-3">{r.quantity}</td>
                  <td className="px-4 py-3 text-muted">
                    {cash ? "—" : money(r.buy_price, r.currency)}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.buy_date}</td>
                  <td className="px-4 py-3">
                    {cash ? "—" : r.price != null ? money(r.price, r.currency) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.value != null ? money(r.value) : "—"}
                  </td>
                  <td className={`px-4 py-3 ${cash ? "text-muted" : gainClass}`}>
                    {cash
                      ? "—"
                      : r.gain != null
                        ? `${money(r.gain)} (${pct(r.gainPct)})`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRemove(r.id)}
                      disabled={removingId === r.id}
                      aria-label={`Remove ${r.ticker}`}
                      className="text-[#9CA3AF] transition-colors hover:text-negative disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
