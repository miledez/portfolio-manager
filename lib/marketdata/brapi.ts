// brapi.dev — Brazilian market (B3) quotes + history. Server-side only.
// Covers .SA equities/ETFs/FIIs and indices (Ibovespa = ^BVSP), and is the
// benchmark source for the comparison engine.
//
// Auth: an optional free token lifts the free tier's ticker limit. Set
// BRAPI_TOKEN in the environment; requests still work (rate-limited) without it.

const BASE = "https://brapi.dev/api";

export const BRAPI_TICKERS = {
  IBOVESPA: "^BVSP",
} as const;

export interface HistoryPoint {
  date: string; // ISO YYYY-MM-DD
  close: number;
}

function withToken(url: string): string {
  const token = process.env.BRAPI_TOKEN;
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${token}` : url;
}

// Latest price for a B3 symbol, or null on failure.
export async function fetchBrapiQuote(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      withToken(`${BASE}/quote/${encodeURIComponent(ticker)}`),
      { next: { revalidate: 900 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { regularMarketPrice?: number }[];
    };
    const price = data.results?.[0]?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// Daily close history for a B3 symbol/index. `range` accepts brapi values
// (e.g. "3mo", "1y", "5y"). Returns chronological points; [] on failure.
export async function fetchBrapiHistory(
  ticker: string,
  range = "1y",
): Promise<HistoryPoint[]> {
  try {
    const res = await fetch(
      withToken(
        `${BASE}/quote/${encodeURIComponent(ticker)}?range=${range}&interval=1d`,
      ),
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        historicalDataPrice?: { date?: number; close?: number }[];
      }[];
    };
    const raw = data.results?.[0]?.historicalDataPrice ?? [];
    const points: HistoryPoint[] = [];
    for (const row of raw) {
      if (typeof row.date !== "number" || typeof row.close !== "number") continue;
      if (!(row.close > 0)) continue;
      points.push({
        date: new Date(row.date * 1000).toISOString().slice(0, 10),
        close: row.close,
      });
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// Total return of a history series between the first point on/after `startIso`
// and the latest point (e.g. 0.14 => +14%). null if the range isn't covered.
export function historyReturn(
  series: HistoryPoint[],
  startIso: string,
): number | null {
  if (series.length < 2) return null;
  const start = series.find((p) => p.date >= startIso);
  const end = series[series.length - 1];
  if (!start || !end || start.date >= end.date || start.close <= 0) return null;
  return end.close / start.close - 1;
}
