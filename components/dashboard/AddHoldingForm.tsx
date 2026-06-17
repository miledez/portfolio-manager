"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { ASSET_CLASSES, isCash } from "@/lib/constants";
import { addHolding } from "@/app/actions";

const EMPTY = { ticker: "", quantity: "", buyPrice: "", buyDate: "" };

export default function AddHoldingForm() {
  const [assetClass, setAssetClass] = useState<string>("Stock");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const cash = isCash(assetClass);

  function submit() {
    const ticker = form.ticker.trim();
    if (!ticker || !form.quantity || (!cash && !form.buyPrice)) {
      setError("Fill in the required fields.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addHolding({
        assetClass,
        ticker,
        quantity: Number(form.quantity),
        buyPrice: cash ? 1 : Number(form.buyPrice),
        buyDate: form.buyDate,
      });
      if (res?.error) setError(res.error);
      else setForm(EMPTY);
    });
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Add a holding</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6"
      >
        <Select
          label="Type"
          value={assetClass}
          options={ASSET_CLASSES}
          onChange={setAssetClass}
        />
        <Field
          label={cash ? "Label" : "Ticker"}
          placeholder={cash ? "Savings" : "AAPL"}
          value={form.ticker}
          onChange={(v) => setForm({ ...form, ticker: v })}
        />
        <Field
          label={cash ? "Amount" : "Quantity"}
          placeholder={cash ? "5000" : "10"}
          type="number"
          value={form.quantity}
          onChange={(v) => setForm({ ...form, quantity: v })}
        />
        <Field
          label="Buy price"
          placeholder="172.40"
          type="number"
          value={cash ? "" : form.buyPrice}
          disabled={cash}
          onChange={(v) => setForm({ ...form, buyPrice: v })}
        />
        <Field
          label="Date"
          type="date"
          value={form.buyDate}
          onChange={(v) => setForm({ ...form, buyDate: v })}
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
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </section>
  );
}
