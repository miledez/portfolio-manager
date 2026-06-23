// AI narrative layer (Phase 4). Server-side only. Takes the deterministic
// research figures and asks Claude to explain them and add current market
// context via web search — Claude narrates the numbers, it never recomputes
// or invents them. Informational only, not personalized financial advice.
import Anthropic from "@anthropic-ai/sdk";
import type { ResearchData } from "./research";
import { money, pct } from "./format";

export interface AdviceResult {
  analysis: string;
  citations: { url: string; title: string }[];
}

const MODEL = "claude-opus-4-8";

const SYSTEM = `You are an analyst writing a brief, plain-language portfolio note for a Brazilian investor whose base currency is BRL. The portfolio tracks stocks, ETFs, crypto, cash, and Brazilian fixed income (CDBs).

Rules:
- Use ONLY the figures provided in the user message. Quote them exactly — never recompute, round differently, or invent any number, return, or price.
- Use web search to add CURRENT qualitative context (recent news, rate environment, sentiment) for the major holdings and for the CDI/IPCA/Ibovespa benchmarks. Keep it lean: at most 3 targeted searches, batching topics into broad queries rather than searching each holding separately. Do not rely on memory for anything time-sensitive.
- Be concise and concrete. Organise the note into short labelled sections in plain prose (no markdown symbols, no tables): "Performance", "Versus benchmarks", "Risks & FX", "Tax angle", and "What to watch". A few sentences each.
- Frame everything as informational observations about the user's own portfolio. Do not tell the user to buy or sell specific securities. End with a one-line reminder that this is not financial advice.`;

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

  return { analysis: textParts.join("").trim(), citations };
}
