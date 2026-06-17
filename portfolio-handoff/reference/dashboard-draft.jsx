import React, { useState, useMemo, useEffect } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Plus, RefreshCw, Trash2, TrendingUp, TrendingDown } from "lucide-react";

// ── palette ───────────────────────────────────────────────
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#1E3A5F";
const POS = "#15803D";
const NEG = "#B91C1C";
const DONUT = ["#1E3A5F", "#3F6FA3", "#6FA0C9", "#A9B8C9", "#C9A35B", "#8A8F98", "#5B7C99"];

// ── asset classes ─────────────────────────────────────────
const CLASSES = ["Stock", "ETF", "Crypto", "Cash"];
const CLASS_COLOR = { Stock: "#1E3A5F", ETF: "#3F6FA3", Crypto: "#C9A35B", Cash: "#6B7280" };
const isCash = (c) => c === "Cash";

// ── formatters ────────────────────────────────────────────
const usd = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const pct = (n) => `${n >= 0 ? "+" : ""}${(n || 0).toFixed(2)}%`;
const compact = (n) =>
  new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 }).format(n || 0);
const fmtDay = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const STORE_KEY = "portfolio-snapshots";

const SAMPLE = [
  { id: 1, ticker: "AAPL", cls: "Stock", qty: 15, date: "2024-03-12", cost: 172.4, price: null },
  { id: 2, ticker: "MSFT", cls: "Stock", qty: 8, date: "2023-11-02", cost: 338.1, price: null },
  { id: 3, ticker: "NVDA", cls: "Stock", qty: 20, date: "2024-06-18", cost: 118.9, price: null },
  { id: 4, ticker: "VWCE", cls: "ETF", qty: 40, date: "2024-01-15", cost: 108.2, price: null },
  { id: 5, ticker: "BTC", cls: "Crypto", qty: 0.25, date: "2024-09-01", cost: 56000, price: null },
  { id: 6, ticker: "Cash", cls: "Cash", qty: 5000, date: "2024-01-01", cost: 1, price: 1 },
];

export default function PortfolioDashboard() {
  const [lots, setLots] = useState(SAMPLE);
  const [form, setForm] = useState({ ticker: "", cls: "Stock", qty: "", date: "", cost: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [allocBy, setAllocBy] = useState("ticker"); // "ticker" | "class"
  const [snapshots, setSnapshots] = useState([]);

  // load saved daily snapshots on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORE_KEY);
        if (r && r.value) setSnapshots(JSON.parse(r.value));
      } catch (_) {
        /* no history saved yet */
      }
    })();
  }, []);

  // ── derived totals ──────────────────────────────────────
  const rows = lots.map((l) => {
    const costBasis = l.qty * l.cost;
    const value = l.price != null ? l.qty * l.price : null;
    const gain = value != null ? value - costBasis : null;
    const gainPct = value != null && costBasis ? (gain / costBasis) * 100 : null;
    return { ...l, costBasis, value, gain, gainPct };
  });

  const totals = useMemo(() => {
    const cost = rows.reduce((s, r) => s + r.costBasis, 0);
    const priced = rows.filter((r) => r.value != null);
    const value = priced.reduce((s, r) => s + r.value, 0);
    const valuedCost = priced.reduce((s, r) => s + r.costBasis, 0);
    const gain = value - valuedCost;
    const gainPct = valuedCost ? (gain / valuedCost) * 100 : 0;
    return { cost, value, gain, gainPct, fullyPriced: priced.length === rows.length && rows.length > 0 };
  }, [rows]);

  const allocation = useMemo(() => {
    const key = allocBy === "class" ? "cls" : "ticker";
    const groups = {};
    rows.forEach((r) => {
      if (r.value == null) return;
      const g = r[key];
      groups[g] = (groups[g] || 0) + r.value;
    });
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, allocBy]);

  const colorFor = (name, i) =>
    allocBy === "class" ? CLASS_COLOR[name] || DONUT[i % DONUT.length] : DONUT[i % DONUT.length];

  // ── actions ─────────────────────────────────────────────
  const addLot = () => {
    const { ticker, cls, qty, date, cost } = form;
    const cash = isCash(cls);
    if (!ticker.trim() || !qty || (!cash && !cost)) return;
    setLots((p) => [
      ...p,
      {
        id: Date.now(),
        ticker: ticker.trim().toUpperCase(),
        cls,
        qty: parseFloat(qty),
        date: date || new Date().toISOString().slice(0, 10),
        cost: cash ? 1 : parseFloat(cost),
        price: cash ? 1 : null, // cash counts immediately; others need a price update
      },
    ]);
    setForm({ ticker: "", cls, qty: "", date: "", cost: "" });
  };

  const removeLot = (id) => setLots((p) => p.filter((l) => l.id !== id));

  const resetHistory = async () => {
    setSnapshots([]);
    try {
      await window.storage.delete(STORE_KEY);
    } catch (_) {}
  };

  const updatePrices = async () => {
    const tickers = [...new Set(lots.filter((l) => !isCash(l.cls)).map((l) => l.ticker))];
    if (tickers.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system:
            "You are a market data assistant. Use web search to find the most recent available price for each symbol (stocks, ETFs, or crypto). Reply with ONLY a JSON object mapping each symbol to its latest price in USD as a number. No prose, no markdown, no code fences. Example: {\"AAPL\": 213.40, \"BTC\": 68000}",
          messages: [{ role: "user", content: `Latest prices for: ${tickers.join(", ")}` }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const prices = JSON.parse(json);
      const updated = lots.map((l) => (prices[l.ticker] != null ? { ...l, price: prices[l.ticker] } : l));
      setLots(updated);
      setUpdatedAt(new Date());

      // record one snapshot per calendar day (latest update of the day wins)
      const totalValue = updated.reduce((s, l) => s + (l.price != null ? l.qty * l.price : 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const next = [
        ...snapshots.filter((s) => s.date !== today),
        { date: today, value: Math.round(totalValue * 100) / 100 },
      ].sort((a, b) => a.date.localeCompare(b.date));
      setSnapshots(next);
      try {
        await window.storage.set(STORE_KEY, JSON.stringify(next));
      } catch (_) {
        /* storage unavailable — chart still works for this session */
      }
    } catch (e) {
      setError("Couldn't fetch prices. Check your tickers are valid symbols and try again.");
    } finally {
      setLoading(false);
    }
  };

  const gainColor = (n) => (n == null ? MUTED : n >= 0 ? POS : NEG);

  // ── UI ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#111827] tabular-nums" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {/* header */}
      <header className="sticky top-0 z-10 bg-[#F7F8FA]/90 backdrop-blur border-b border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
            <p className="text-xs text-[#6B7280]">
              {updatedAt ? `Prices updated ${updatedAt.toLocaleTimeString()}` : "Prices not yet updated"}
            </p>
          </div>
          <button
            onClick={updatePrices}
            disabled={loading || lots.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-[#1E3A5F] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#16314f] transition-colors"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {loading ? "Updating…" : "Update prices"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        {error && (
          <div className="rounded-md border border-[#B91C1C]/30 bg-[#B91C1C]/5 px-4 py-3 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}

        {/* summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total value" value={totals.fullyPriced || totals.value ? usd(totals.value) : "—"} big />
          <Stat label="Cost basis" value={usd(totals.cost)} />
          <div className="rounded-lg bg-white border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#6B7280] mb-1">Total gain / loss</p>
            <p className="text-xl font-semibold flex items-center gap-1.5" style={{ color: gainColor(totals.value ? totals.gain : null) }}>
              {totals.value ? (
                <>
                  {totals.gain >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {usd(totals.gain)}
                </>
              ) : "—"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: gainColor(totals.value ? totals.gain : null) }}>
              {totals.value ? pct(totals.gainPct) : "update prices to see"}
            </p>
          </div>
          <Stat label="Holdings" value={`${lots.length}`} sub={`${new Set(lots.map((l) => l.cls)).size} asset types`} />
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* left: add + table */}
          <div className="lg:col-span-2 space-y-4">
            {/* add lot */}
            <section className="rounded-lg bg-white border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold mb-3">Add a holding</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <Select label="Type" value={form.cls} options={CLASSES} onChange={(v) => setForm({ ...form, cls: v })} />
                <Field
                  label={isCash(form.cls) ? "Label" : "Ticker"}
                  placeholder={isCash(form.cls) ? "Savings" : "AAPL"}
                  value={form.ticker}
                  onChange={(v) => setForm({ ...form, ticker: v })}
                />
                <Field
                  label={isCash(form.cls) ? "Amount" : "Quantity"}
                  placeholder={isCash(form.cls) ? "5000" : "10"}
                  type="number"
                  value={form.qty}
                  onChange={(v) => setForm({ ...form, qty: v })}
                />
                <Field
                  label="Buy price"
                  placeholder="172.40"
                  type="number"
                  value={isCash(form.cls) ? "" : form.cost}
                  disabled={isCash(form.cls)}
                  onChange={(v) => setForm({ ...form, cost: v })}
                />
                <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
                <div className="flex items-end">
                  <button
                    onClick={addLot}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[#111827] px-3 py-2 text-sm font-medium text-white hover:bg-[#000] transition-colors"
                  >
                    <Plus size={15} /> Add
                  </button>
                </div>
              </div>
            </section>

            {/* table */}
            <section className="rounded-lg bg-white border border-[#E5E7EB] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[#6B7280] border-b border-[#E5E7EB]">
                      <Th>Ticker</Th><Th>Type</Th><Th>Qty</Th><Th>Buy price</Th><Th>Date</Th>
                      <Th>Now</Th><Th>Value</Th><Th>Gain / loss</Th><Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-[#6B7280]">No holdings yet. Add your first holding above.</td></tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-[#F1F2F4] last:border-0 hover:bg-[#FAFBFC]">
                        <td className="px-4 py-3 font-semibold">{r.ticker}</td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ color: CLASS_COLOR[r.cls], background: `${CLASS_COLOR[r.cls]}14` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: CLASS_COLOR[r.cls] }} />
                            {r.cls}
                          </span>
                        </td>
                        <td className="px-4 py-3">{r.qty}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{isCash(r.cls) ? "—" : usd(r.cost)}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{r.date}</td>
                        <td className="px-4 py-3">{isCash(r.cls) ? "—" : r.price != null ? usd(r.price) : "—"}</td>
                        <td className="px-4 py-3">{r.value != null ? usd(r.value) : "—"}</td>
                        <td className="px-4 py-3" style={{ color: gainColor(isCash(r.cls) ? null : r.gain) }}>
                          {isCash(r.cls) ? "—" : r.gain != null ? `${usd(r.gain)} (${pct(r.gainPct)})` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeLot(r.id)} className="text-[#9CA3AF] hover:text-[#B91C1C] transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* right: allocation */}
          <section className="rounded-lg bg-white border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Allocation</h2>
              <div className="inline-flex rounded-md border border-[#E5E7EB] p-0.5 text-xs">
                {[["ticker", "Ticker"], ["class", "Class"]].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setAllocBy(k)}
                    className={`px-2.5 py-1 rounded ${allocBy === k ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:text-[#111827]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {allocation.length === 0 ? (
              <p className="text-sm text-[#6B7280] py-12 text-center">Update prices to see your allocation.</p>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2}>
                        {allocation.map((a, i) => <Cell key={i} fill={colorFor(a.name, i)} />)}
                      </Pie>
                      <Tooltip formatter={(v) => usd(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {allocation.map((a, i) => (
                    <li key={a.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colorFor(a.name, i) }} />
                        {a.name}
                      </span>
                      <span className="text-[#6B7280]">{((a.value / totals.value) * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {/* development over time */}
        <section className="rounded-lg bg-white border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">Development</h2>
              <p className="text-xs text-[#6B7280]">
                {snapshots.length > 1
                  ? `Total value across ${snapshots.length} days`
                  : "Total value over time"}
              </p>
            </div>
            {snapshots.length > 0 && (
              <button onClick={resetHistory} className="text-xs text-[#9CA3AF] hover:text-[#B91C1C] transition-colors">
                Reset history
              </button>
            )}
          </div>
          {snapshots.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-12 text-center">
              No snapshots yet. Each time you update prices, today's total value is saved here — the line fills in as the days go by.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#F1F2F4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip formatter={(v) => usd(v)} labelFormatter={fmtDay} />
                  <Line type="monotone" dataKey="value" stroke="#1E3A5F" strokeWidth={2} dot={{ r: 3, fill: "#1E3A5F" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <p className="text-xs text-[#9CA3AF] leading-relaxed">
          Sample holdings are loaded for preview. Prices fetched live via web search on request and may be delayed.
          Daily value snapshots are saved on your device and persist between sessions. Not financial advice.
        </p>
      </main>
    </div>
  );
}

// ── small components ──────────────────────────────────────
function Stat({ label, value, sub, big }) {
  return (
    <div className="rounded-lg bg-white border border-[#E5E7EB] p-4">
      <p className="text-xs text-[#6B7280] mb-1">{label}</p>
      <p className={`${big ? "text-2xl" : "text-xl"} font-semibold tracking-tight`}>{value}</p>
      {sub && <p className="text-xs text-[#6B7280] mt-0.5">{sub}</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[#6B7280] mb-1">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={disabled ? "n/a" : placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[#E5E7EB] px-2.5 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[#6B7280] mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
