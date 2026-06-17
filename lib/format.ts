// Formatting helpers — format only at the edge (UI), never in the data layer.

export const usd = (n: number | null | undefined): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );

export const pct = (n: number | null | undefined): string =>
  `${(n ?? 0) >= 0 ? "+" : ""}${(n || 0).toFixed(2)}%`;

export const compact = (n: number | null | undefined): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
  }).format(n || 0);

export const fmtDay = (d: string | number | Date): string =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
