import { useTransition } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { money, compact, fmtDay } from "@/lib/format";
import { clearSnapshots } from "@/app/actions";

export interface SnapshotPoint {
  snapshot_date: string;
  total_value: number;
}

export default function DevelopmentChart({
  snapshots,
}: {
  snapshots: SnapshotPoint[];
}) {
  const [pending, startTransition] = useTransition();
  const data = snapshots.map((s) => ({
    date: s.snapshot_date,
    value: s.total_value,
  }));

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Development</h2>
          <p className="text-xs text-muted">
            {data.length > 1
              ? `Total value across ${data.length} days`
              : "Total value over time"}
          </p>
        </div>
        {data.length > 0 && (
          <button
            onClick={() =>
              startTransition(async () => {
                await clearSnapshots();
              })
            }
            disabled={pending}
            className="text-xs text-[#9CA3AF] transition-colors hover:text-negative disabled:opacity-40"
          >
            Reset history
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm leading-relaxed text-muted">
          No snapshots yet. Each day your total value is saved here — the line
          fills in as the days go by.
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="#F1F2F4" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => fmtDay(String(value))}
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <YAxis
                tickFormatter={(value) => compact(Number(value))}
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                formatter={(value) => money(Number(value))}
                labelFormatter={(label) => fmtDay(String(label))}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1E3A5F"
                strokeWidth={2}
                dot={{ r: 3, fill: "#1E3A5F" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
