import ClassBadge from "@/components/ui/ClassBadge";
import { pct } from "@/lib/format";
import type { ReturnBreakdown } from "@/lib/compare";

function Th({
  children,
  right = false,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

// A percentage cell, colored green/red by sign (performance figure).
function Ret({ value }: { value: number | null }) {
  if (value == null) return <td className="px-4 py-3 text-right text-muted">—</td>;
  const cls = value >= 0 ? "text-positive" : "text-negative";
  return <td className={`px-4 py-3 text-right ${cls}`}>{pct(value * 100)}</td>;
}

function years(days: number): string {
  if (days <= 0) return "—";
  const y = days / 365;
  return y >= 1 ? `${y.toFixed(1)}y` : `${days}d`;
}

export default function ComparisonTable({
  rows,
}: {
  rows: ReturnBreakdown[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="text-sm font-semibold">Return comparison</h2>
        <p className="mt-0.5 text-[11px] text-muted">
          Every holding and benchmark, annualized over its own period — nominal,
          inflation-adjusted (real), and after Brazilian income tax.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted">
              <Th>Asset</Th>
              <Th>Type</Th>
              <Th right>Period</Th>
              <Th right>Total return</Th>
              <Th right>Nominal p.a.</Th>
              <Th right>Real p.a.</Th>
              <Th right>After-tax p.a.</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Nothing to compare yet. Add a fixed-income holding below, or
                  update prices on the dashboard so equities can be valued.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const benchmark = r.assetClass === "";
              return (
                <tr
                  key={`${r.name}-${i}`}
                  className={`border-b border-[#F1F2F4] last:border-0 hover:bg-[#FAFBFC] ${
                    benchmark ? "bg-[#FAFBFC]" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3">
                    {benchmark ? (
                      <span className="text-[11px] uppercase tracking-wide text-muted">
                        Benchmark
                      </span>
                    ) : (
                      <ClassBadge assetClass={r.assetClass} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {years(r.holdingDays)}
                  </td>
                  <Ret value={r.periodReturn} />
                  <Ret value={r.annualizedNominal} />
                  <Ret value={r.annualizedReal} />
                  <Ret value={r.annualizedAfterTax} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
