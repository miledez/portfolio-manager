"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { addFixedIncome } from "@/app/actions";

const FI_INDEXES = ["CDI", "IPCA", "PRE"] as const;
const EMPTY = { label: "", principal: "", rate: "", maturity: "" };

// What fi_rate means for each index (matches lib/types FiIndex).
const RATE_HINT: Record<(typeof FI_INDEXES)[number], string> = {
  CDI: "% of CDI — e.g. 110",
  IPCA: "spread % p.a. — IPCA + 6 → 6",
  PRE: "fixed % p.a. — e.g. 12",
};

export default function AddFixedIncomeForm() {
  const [index, setIndex] = useState<string>("CDI");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const hint = RATE_HINT[index as (typeof FI_INDEXES)[number]] ?? "";

  function submit() {
    if (!form.label.trim() || !form.principal || !form.rate) {
      setError("Fill in the label, principal and rate.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addFixedIncome({
        label: form.label.trim(),
        principal: Number(form.principal),
        fiIndex: index,
        fiRate: Number(form.rate),
        buyDate: "", // server defaults to today when blank
        fiMaturity: form.maturity || undefined,
      });
      if (res?.error) setError(res.error);
      else setForm(EMPTY);
    });
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Add fixed income</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6"
      >
        <Field
          label="Label"
          placeholder="CDB Inter"
          value={form.label}
          onChange={(v) => setForm({ ...form, label: v })}
        />
        <Field
          label="Principal (BRL)"
          placeholder="10000"
          type="number"
          value={form.principal}
          onChange={(v) => setForm({ ...form, principal: v })}
        />
        <Select
          label="Index"
          value={index}
          options={FI_INDEXES}
          onChange={setIndex}
        />
        <Field
          label="Rate"
          placeholder="110"
          type="number"
          value={form.rate}
          onChange={(v) => setForm({ ...form, rate: v })}
        />
        <Field
          label="Maturity"
          type="date"
          value={form.maturity}
          onChange={(v) => setForm({ ...form, maturity: v })}
        />
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
          >
            <Plus size={15} /> {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Rate for <span className="text-ink">{index}</span>: {hint}. Application
        date defaults to today. Value accrues from the BCB CDI/IPCA series.
      </p>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </section>
  );
}
