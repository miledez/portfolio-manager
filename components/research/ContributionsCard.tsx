"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import Field from "@/components/ui/Field";
import { addContribution, removeContribution } from "@/app/actions";
import { money, pct } from "@/lib/format";
import type { Contribution } from "@/lib/types";

const EMPTY = { amount: "", flowDate: "", note: "" };

export default function ContributionsCard({
  contributions,
  portfolioReturn,
}: {
  contributions: Contribution[];
  portfolioReturn: number | null;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  function submit() {
    if (!form.amount) {
      setError("Enter an amount (+ deposit, − withdrawal).");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addContribution({
        amount: Number(form.amount),
        flowDate: form.flowDate,
        note: form.note,
      });
      if (res?.error) setError(res.error);
      else setForm(EMPTY);
    });
  }

  function remove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      await removeContribution(id);
      setRemovingId(null);
    });
  }

  const retClass =
    portfolioReturn == null
      ? "text-muted"
      : portfolioReturn >= 0
        ? "text-positive"
        : "text-negative";

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Contributions</h2>
        <div className="text-right">
          <span className="text-[11px] text-muted">Money-weighted return p.a.</span>
          <div className={`text-xl font-semibold ${retClass}`}>
            {portfolioReturn == null ? "—" : pct(portfolioReturn * 100)}
          </div>
        </div>
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        Log deposits (+) and withdrawals (−) so your return (XIRR) reflects gains,
        not the cash you put in.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4"
      >
        <Field
          label="Amount (BRL)"
          placeholder="5000 or -2000"
          type="number"
          value={form.amount}
          onChange={(v) => setForm({ ...form, amount: v })}
        />
        <Field
          label="Date"
          type="date"
          value={form.flowDate}
          onChange={(v) => setForm({ ...form, flowDate: v })}
        />
        <Field
          label="Note"
          placeholder="Monthly deposit"
          value={form.note}
          onChange={(v) => setForm({ ...form, note: v })}
        />
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
          >
            <Plus size={15} /> {pending ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}

      {contributions.length > 0 && (
        <ul className="mt-3 divide-y divide-[#F1F2F4] text-sm">
          {contributions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-muted">{c.flow_date}</span>
                <span className="font-medium">
                  {c.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(c.amount))}
                </span>
                <span className="text-[11px] text-muted">
                  {c.amount >= 0 ? "Deposit" : "Withdrawal"}
                  {c.note ? ` · ${c.note}` : ""}
                </span>
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={removingId === c.id}
                aria-label="Remove contribution"
                className="text-[#9CA3AF] transition-colors hover:text-negative disabled:opacity-40"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
