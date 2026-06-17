// Live price fetching via Finnhub. Server-side only — never expose the key.
// Stocks/ETFs use /quote (free tier). Finnhub's free /quote is stock-only, so
// crypto is priced from Binance daily candles (BINANCE:<TICKER>USDT).

const FINNHUB = "https://finnhub.io/api/v1";

export interface PriceItem {
  ticker: string;
  assetClass: string;
}

export interface PriceResult {
  prices: Record<string, number>;
  missing: string[];
}

export async function fetchPrices(
  items: PriceItem[],
  apiKey: string,
): Promise<PriceResult> {
  // De-dupe by ticker (many lots can share a ticker).
  const unique = [...new Map(items.map((i) => [i.ticker, i])).values()];

  const prices: Record<string, number> = {};
  const missing: string[] = [];

  await Promise.all(
    unique.map(async ({ ticker, assetClass }) => {
      try {
        const price =
          assetClass === "Crypto"
            ? await fetchCryptoPrice(ticker, apiKey)
            : await fetchStockQuote(ticker, apiKey);
        if (price != null && Number.isFinite(price) && price > 0) {
          prices[ticker] = price;
        } else {
          missing.push(ticker);
        }
      } catch {
        missing.push(ticker);
      }
    }),
  );

  return { prices, missing };
}

async function fetchStockQuote(
  ticker: string,
  apiKey: string,
): Promise<number | null> {
  const url = `${FINNHUB}/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { c?: number };
  // `c` is the current price; 0 means an unknown/unsupported symbol.
  return typeof data.c === "number" && data.c > 0 ? data.c : null;
}

async function fetchCryptoPrice(
  ticker: string,
  apiKey: string,
): Promise<number | null> {
  const symbol = `BINANCE:${ticker.toUpperCase()}USDT`;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * 7; // 7-day window; take the latest close
  const url = `${FINNHUB}/crypto/candle?symbol=${encodeURIComponent(
    symbol,
  )}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { s?: string; c?: number[] };
  if (data.s !== "ok" || !Array.isArray(data.c) || data.c.length === 0) {
    return null;
  }
  const last = data.c[data.c.length - 1];
  return typeof last === "number" && last > 0 ? last : null;
}
