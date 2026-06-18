// Base (display/total) currency for the whole portfolio.
export const BASE_CURRENCY = "BRL";

// Native quote currency for a holding, inferred from its ticker/class:
//   Cash            -> BASE (entered in BRL)
//   Crypto          -> USD  (priced via Finnhub/Binance)
//   *.CO  (Nasdaq Copenhagen) -> DKK (Yahoo)
//   *.SA  (B3 São Paulo)      -> BRL (Yahoo)
//   everything else (US)      -> USD (Finnhub /quote)
export function nativeCurrency(ticker: string, assetClass: string): string {
  if (assetClass === "Cash") return BASE_CURRENCY;
  if (assetClass === "Crypto") return "USD";
  const t = ticker.toUpperCase();
  if (t.endsWith(".CO")) return "DKK";
  if (t.endsWith(".SA")) return "BRL";
  return "USD";
}
