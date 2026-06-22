// Asset classes and the design palette. See portfolio-handoff/DESIGN.md.

// Classes shown in the add-holding form and allocation-target editor. Fixed
// income is entered through its own flow (it carries rate terms, not a market
// price), so it is intentionally NOT in this list — see ALL_ASSET_CLASSES.
export const ASSET_CLASSES = ["Stock", "ETF", "Crypto", "Cash"] as const;

// 'FixedIncome' is a first-class asset class at the data/engine level (CDBs,
// Tesouro, LCI/LCA): stored on `holdings`, valued from BCB rate series rather
// than a live quote.
export const FIXED_INCOME = "FixedIncome" as const;

// Every asset class the system understands (validation + typing).
export const ALL_ASSET_CLASSES = [...ASSET_CLASSES, FIXED_INCOME] as const;
export type AssetClass = (typeof ALL_ASSET_CLASSES)[number];

// Badge + class-allocation colors, one per asset class.
export const CLASS_COLOR: Record<AssetClass, string> = {
  Stock: "#1E3A5F",
  ETF: "#3F6FA3",
  Crypto: "#C9A35B",
  Cash: "#6B7280",
  FixedIncome: "#5B7C99",
};

// Donut palette for ticker-level allocation.
export const DONUT = [
  "#1E3A5F",
  "#3F6FA3",
  "#6FA0C9",
  "#A9B8C9",
  "#C9A35B",
  "#8A8F98",
  "#5B7C99",
];

export const isCash = (assetClass: string): boolean => assetClass === "Cash";
export const isFixedIncome = (assetClass: string): boolean =>
  assetClass === FIXED_INCOME;
