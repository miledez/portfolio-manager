"use client";

import { useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";

interface AdviceRow {
  area: string;
  observation: string;
  risk: string;
}

interface Advice {
  summary: string;
  rows: AdviceRow[];
  citations: { url: string; title: string }[];
}

export default function AdvisorCard({ enabled }: { enabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/advice", { method: "POST" });
      // The handler returns JSON, but a platform-level timeout/crash (the
      // analysis can run close to the function limit) yields a plain-text
      // error page. Parse defensively so we never surface a JSON parse error.
      const raw = await res.text();
      let data: Partial<Advice> & { error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          res.status === 504
            ? "The analysis took too long and timed out. Try again in a moment."
            : "Couldn't generate the analysis. Try again in a moment.",
        );
      }
      if (!res.ok) throw new Error(data?.error || "request failed");
      setAdvice(data as Advice);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't generate the analysis.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">AI analysis</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Reads the figures above and adds current market context via web
            search. Narrates your numbers — it doesn&apos;t compute them.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading || !enabled}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          <Sparkles size={15} className={loading ? "animate-pulse" : ""} />
          {loading ? "Analyzing…" : advice ? "Regenerate" : "Generate analysis"}
        </button>
      </div>

      {!enabled && (
        <p className="mt-3 text-[11px] text-muted">
          Set <span className="text-ink">ANTHROPIC_API_KEY</span> to enable the
          AI analysis.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {advice && (
        <div className="mt-4 border-t border-hairline pt-4">
          {advice.summary && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {advice.summary}
            </p>
          )}

          {advice.rows.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-hairline">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 py-2.5 font-medium">Area</th>
                      <th className="px-4 py-2.5 font-medium">Observation</th>
                      <th className="px-4 py-2.5 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advice.rows.map((r, i) => (
                      <tr
                        key={`${r.area}-${i}`}
                        className="border-b border-[#F1F2F4] last:border-0 hover:bg-[#FAFBFC]"
                      >
                        <td className="px-4 py-3 font-semibold">{r.area}</td>
                        <td className="px-4 py-3 text-ink">{r.observation}</td>
                        <td className="px-4 py-3 text-muted">{r.risk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {advice.citations.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                Sources
              </p>
              <ul className="space-y-1">
                {advice.citations.map((c) => (
                  <li key={c.url}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={12} />
                      <span className="truncate">{c.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
