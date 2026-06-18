// Formatting helpers — format only at the edge (UI), never in the data layer.
import { BASE_CURRENCY } from "./currency";

// Format an amount in a given currency (defaults to the base currency, BRL).
// pt-BR locale renders R$ / US$ / DKK with Brazilian number grouping.
export const money = (
  n: number | null | undefined,
  currency: string = BASE_CURRENCY,
): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n || 0);

export const pct = (n: number | null | undefined): string =>
  `${(n ?? 0) >= 0 ? "+" : ""}${(n || 0).toFixed(2)}%`;

export const compact = (n: number | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    style: "currency",
    currency: BASE_CURRENCY,
    maximumFractionDigits: 1,
  }).format(n || 0);

export const fmtDay = (d: string | number | Date): string =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
