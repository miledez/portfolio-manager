import { useState, useTransition } from "react";
import { ASSET_CLASSES, CLASS_COLOR, type AssetClass } from "@/lib/constants";
import { money } from "@/lib/format";
import { saveTargets } from "@/app/actions";

export default function StrategyCard({
  initialTargets,
  currentByClass,
  totalValue,
}: {
  initialTargets: Record<string, number>;
  currentByClass: Record<string, number>;
  totalValue: number;
}) {
  const [targets, setTargets] = useState<Record<string, number>>(initialTargets);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const totalTarget = ASSET_CLASSES.reduce((s, c) => s + (targets[c] ?? 0), 0);
  const priced = totalValue > 0;

  function setTarget(cls: string, value: number) {
    setSaved(false);
    setTargets((prev) => ({ ...prev, [cls]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveTargets(targets);
      if (!res?.error) setSaved(true);
    });
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Strategy</h2>
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save targets"}
        </button>
      </div>
      <p className="mb-4 text-xs text-muted">
        Set a target mix; see how far each class has drifted and what it takes to
        rebalance.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {ASSET_CLASSES.map((cls) => {
          const target = targets[cls] ?? 0;
          const currentVal = currentByClass[cls] ?? 0;
          const currentPct = priced ? (currentVal / totalValue) * 100 : 0;
          const drift = currentPct - target;
          const delta = totalValue * (target / 100) - currentVal; // + add, - trim

          let hint = "—";
          if (priced) {
            if (Math.abs(delta) < 1) hint = "On target";
            else if (delta > 0) hint = `Add ${money(delta)}`;
            else hint = `Trim ${money(-delta)}`;
          }
          const actionable = priced && hint !== "On target";

          return (
            <div key={cls}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: CLASS_COLOR[cls as AssetClass] }}
                  />
                  {cls}
                </span>
                <span className="text-xs text-muted">
                  now {currentPct.toFixed(1)}% · target {target}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={target}
                onChange={(e) => setTarget(cls, Number(e.target.value))}
                aria-label={`${cls} target percent`}
                className="mt-2 w-full accent-primary"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted">
                  {priced
                    ? `${drift >= 0 ? "+" : ""}${drift.toFixed(1)} pts vs target`
                    : "set a target"}
                </span>
                <span className={actionable ? "text-ink" : "text-muted"}>
                  {hint}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-xs">
        <span className="text-muted">Targets total</span>
        <span className={totalTarget === 100 ? "text-ink" : "text-muted"}>
          {totalTarget}%{totalTarget !== 100 ? " · aim for 100%" : ""}
        </span>
      </div>
      {!priced && (
        <p className="mt-3 text-xs text-muted">
          Update prices to see drift and rebalance amounts.
        </p>
      )}
    </section>
  );
}
