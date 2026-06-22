// Banco Central do Brasil — SGS (Sistema Gerenciador de Séries Temporais).
// Public, keyless, official. Server-side only.
//
//   https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json
//     &dataInicial=dd/MM/yyyy&dataFinal=dd/MM/yyyy
//
// The backbone for Brazilian fixed-income valuation and benchmarks:
//   CDI (daily)  -> series 12   (% per business day)
//   Selic (daily)-> series 11   (% per business day)
//   IPCA (monthly)-> series 433 (% per month)
//
// Note (BCB, 2025): date filters are mandatory and a single request spans at
// most 10 years. We always pass a range.

export const SGS = {
  CDI_DAILY: 12,
  SELIC_DAILY: 11,
  IPCA_MONTHLY: 433,
} as const;

export interface SgsPoint {
  date: string; // ISO YYYY-MM-DD
  value: number; // percent, as published (e.g. 0.041634 for a daily CDI)
}

const BASE = "https://api.bcb.gov.br/dados/serie";

// dd/MM/yyyy <-> ISO. SGS speaks dd/MM/yyyy in both directions.
function toBrDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function fromBrDate(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
}

// Fetch a raw SGS series between two ISO dates (inclusive). Returns chronological
// points; empty array on any failure (callers degrade gracefully, like pricing).
export async function fetchSgsSeries(
  code: number,
  startIso: string,
  endIso: string,
): Promise<SgsPoint[]> {
  const url =
    `${BASE}/bcdata.sgs.${code}/dados?formato=json` +
    `&dataInicial=${encodeURIComponent(toBrDate(startIso))}` +
    `&dataFinal=${encodeURIComponent(toBrDate(endIso))}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Macro series move at most daily — let the platform cache for an hour.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as { data?: string; valor?: string }[];
    if (!Array.isArray(raw)) return [];
    const points: SgsPoint[] = [];
    for (const row of raw) {
      const value = Number(row.valor);
      if (!row.data || !Number.isFinite(value)) continue;
      points.push({ date: fromBrDate(row.data), value });
    }
    return points;
  } catch {
    return [];
  }
}

// Compounded growth factor of a post-fixed CDI investment over the series'
// span, for an investment paying `pctOfCdi`% of the CDI (e.g. 110).
//   factor = Π (1 + dailyRate/100 * pctOfCdi/100)
// Market practice for "% do CDI" applied to the published daily DI rate. A
// factor of 1.12 means +12% over the period.
export function compoundCdiFactor(series: SgsPoint[], pctOfCdi: number): number {
  const mult = pctOfCdi / 100;
  return series.reduce((f, p) => f * (1 + (p.value / 100) * mult), 1);
}

// Cumulative IPCA inflation factor across a monthly series (1.05 => +5%).
export function cumulativeIpcaFactor(series: SgsPoint[]): number {
  return series.reduce((f, p) => f * (1 + p.value / 100), 1);
}

// Convenience: latest value in a series (e.g. current CDI/Selic), or null.
export function latestValue(series: SgsPoint[]): number | null {
  return series.length ? series[series.length - 1].value : null;
}
