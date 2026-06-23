// AI narrative layer (Phase 4). Server-side only. Takes the deterministic
// research figures and asks Claude to explain them and add current market
// context via web search — Claude narrates the numbers, it never recomputes
// or invents them. Informational only, not personalized financial advice.
import Anthropic from "@anthropic-ai/sdk";
import type { ResearchData } from "./research";
import { money, pct } from "./format";

export interface AdviceRow {
  area: string;
  observation: string;
  risk: string;
}

export interface AdviceResult {
  summary: string;
  rows: AdviceRow[];
  citations: { url: string; title: string }[];
}

const MODEL = "claude-opus-4-8";

const SYSTEM = `You are an analyst writing a brief, plain-language portfolio note for a Brazilian investor whose base currency is BRL. The portfolio tracks stocks, ETFs, crypto, cash, and Brazilian fixed income (CDBs).

Rules:
- Use ONLY the figures provided in the user message. Quote them exactly — never recompute, round differently, or invent any number, return, or price.
- Use web search to add CURRENT qualitative context (recent news, rate environment, sentiment) for the major holdings and for the CDI/IPCA/Ibovespa benchmarks. Keep it lean: at most 3 targeted searches, batching topics into broad queries rather than searching each holding separately. Do not rely on memory for anything time-sensitive.
- Frame everything as informational observations about the user's own portfolio. Do not tell the user to buy or sell specific securities. This is not personalized financial advice.

Output ONLY a single JSON object (no prose before or after, no markdown fences) with this exact shape:
{
  "summary": string,   // an executive summary of 4 to 5 short lines, separated by "\\n". Plain prose, no markdown symbols. Lead with the headline performance vs. benchmarks and inflation, then the one or two things that most matter. End the last line with a brief "Not financial advice." reminder.
  "rows": [             // an overview of the portfolio by area; one row per relevant area (e.g. Equities, Crypto, Fixed income, FX, Tax). Order by importance.
    { "area": string, "observation": string, "risk": string }
  ]
}
Each "observation" and "risk" is one short, concrete phrase (no trailing period needed). Cite numbers from the figures where they sharpen the point.`;

// Format the deterministic figures into a readable block the model quotes verbatim.
function findingsText(data: ResearchData): string {
  const lines: string[] = [];
  lines.push(`As of ${data.asOf}; figures annualized since ${data.earliestStart}.`);
  lines.push(`Total portfolio value: ${money(data.totalValue)} (BRL).`);
  lines.push(
    `Portfolio money-weighted return (XIRR) p.a.: ${
      data.portfolioReturn != null ? pct(data.portfolioReturn * 100) : "n/a"
    }.`,
  );
  if (data.inflationAnnual != null) {
    lines.push(`Inflation (IPCA) annualized: ${pct(data.inflationAnnual * 100)}.`);
  }
  lines.push("");
  lines.push("Per-asset and benchmark returns (annualized unless noted):");
  for (const r of data.comparison) {
    const kind = r.assetClass === "" ? "benchmark, gross of tax" : r.assetClass;
    const real = r.annualizedReal != null ? pct(r.annualizedReal * 100) : "n/a";
    const tax =
      r.annualizedAfterTax != null ? pct(r.annualizedAfterTax * 100) : "n/a";
    const nominal =
      r.annualizedNominal != null ? pct(r.annualizedNominal * 100) : "n/a";
    lines.push(
      `- ${r.name} (${kind}): total ${pct(r.periodReturn * 100)}, nominal p.a. ${nominal}, real p.a. ${real}, after-tax p.a. ${tax}.`,
    );
  }
  return lines.join("\n");
}

export async function generateAdvice(data: ResearchData): Promise<AdviceResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI advisor is not configured.");
  }
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    // Each search round-trips to the web and back through the model, so it's
    // the dominant latency cost. Cap it tighter to stay well under the 60s
    // function limit — 3 targeted searches are enough for qualitative context.
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content: `Here are the computed figures for my portfolio. Write the note.\n\n${findingsText(
          data,
        )}`,
      },
    ],
  };

  let response = await client.messages.create(params);
  // Web search runs a server-side loop; resume on pause_turn. Bounded low so a
  // stalled search loop can't run the route past its function timeout.
  for (let i = 0; i < 3 && response.stop_reason === "pause_turn"; i++) {
    params.messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create(params);
  }

  const textParts: string[] = [];
  const citations: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const block of response.content) {
    if (block.type !== "text") continue;
    textParts.push(block.text);
    for (const c of block.citations ?? []) {
      const url = (c as { url?: string }).url;
      const title = (c as { title?: string }).title;
      if (url && !seen.has(url)) {
        seen.add(url);
        citations.push({ url, title: title || url });
      }
    }
  }

  const { summary, rows } = parseAdvice(textParts.join("").trim());
  return { summary, rows, citations };
}

// The model is asked for a single JSON object, but tolerate stray prose or a
// markdown fence around it. Falls back to showing the raw text as the summary.
function parseAdvice(text: string): { summary: string; rows: AdviceRow[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as {
        summary?: unknown;
        rows?: unknown;
      };
      const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
      const rows = Array.isArray(obj.rows)
        ? obj.rows
            .map((r) => {
              const o = (r ?? {}) as Record<string, unknown>;
              return {
                area: typeof o.area === "string" ? o.area : "",
                observation:
                  typeof o.observation === "string" ? o.observation : "",
                risk: typeof o.risk === "string" ? o.risk : "",
              };
            })
            .filter((r) => r.area || r.observation || r.risk)
        : [];
      if (summary || rows.length) return { summary, rows };
    } catch {
      // fall through to the raw-text fallback
    }
  }
  return { summary: text, rows: [] };
}
