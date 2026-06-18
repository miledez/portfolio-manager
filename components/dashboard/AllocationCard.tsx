import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CLASS_COLOR, DONUT, type AssetClass } from "@/lib/constants";
import { money } from "@/lib/format";
import type { AllocSlice, AllocBy } from "@/lib/portfolio";

export default function AllocationCard({
  allocation,
  allocBy,
  onAllocByChange,
  totalValue,
}: {
  allocation: AllocSlice[];
  allocBy: AllocBy;
  onAllocByChange: (by: AllocBy) => void;
  totalValue: number;
}) {
  const colorFor = (name: string, i: number) =>
    allocBy === "class"
      ? (CLASS_COLOR[name as AssetClass] ?? DONUT[i % DONUT.length])
      : DONUT[i % DONUT.length];

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Allocation</h2>
        <div className="inline-flex rounded-md border border-hairline p-0.5 text-xs">
          {(["ticker", "class"] as const).map((k) => (
            <button
              key={k}
              onClick={() => onAllocByChange(k)}
              className={`rounded px-2.5 py-1 ${
                allocBy === k
                  ? "bg-primary text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              {k === "ticker" ? "Ticker" : "Class"}
            </button>
          ))}
        </div>
      </div>

      {allocation.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          Update prices to see your allocation.
        </p>
      ) : (
        <>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {allocation.map((a, i) => (
                    <Cell key={a.name} fill={colorFor(a.name, i)} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {allocation.map((a, i) => (
              <li
                key={a.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: colorFor(a.name, i) }}
                  />
                  {a.name}
                </span>
                <span className="text-muted">
                  {totalValue ? ((a.value / totalValue) * 100).toFixed(1) : "0.0"}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
