// Asset classes and the design palette. See portfolio-handoff/DESIGN.md.

export const ASSET_CLASSES = ["Stock", "ETF", "Crypto", "Cash"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

// Badge + class-allocation colors, one per asset class.
export const CLASS_COLOR: Record<AssetClass, string> = {
  Stock: "#1E3A5F",
  ETF: "#3F6FA3",
  Crypto: "#C9A35B",
  Cash: "#6B7280",
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
