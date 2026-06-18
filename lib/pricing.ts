// Live prices + FX. Server-side only — never expose the Finnhub key.
//   US stocks/ETFs -> Finnhub /quote (USD)
//   Crypto         -> Finnhub Binance candles (USD)
//   *.CO / *.SA    -> Yahoo chart endpoint (native: DKK / BRL)
//   FX rates       -> Yahoo "<CUR>BRL=X"
import { BASE_CURRENCY } from "./currency";

const FINNHUB = "https://finnhub.io/api/v1";

export interface PriceItem {
  ticker: string;
  assetClass: string;
}

export interface PriceResult {
  prices: Record<string, number>; // native per-share price, keyed by ticker
  missing: string[];
}

function usesYahoo(ticker: string): boolean {
  const t = ticker.toUpperCase();
  return t.endsWith(".CO") || t.endsWith(".SA");
}

export async function fetchPrices(
  items: PriceItem[],
  apiKey: string,
): Promise<PriceResult> {
  const unique = [...new Map(items.map((i) => [i.ticker, i])).values()];
  const prices: Record<string, number> = {};
  const missing: string[] = [];

  await Promise.all(
    unique.map(async ({ ticker, assetClass }) => {
      try {
        let price: number | null;
        if (assetClass === "Crypto") price = await fetchCryptoPrice(ticker, apiKey);
        else if (usesYahoo(ticker)) price = await fetchYahooNumber(ticker);
        else price = await fetchStockQuote(ticker, apiKey);

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

// Rates to convert each currency into the base currency (BRL -> 1).
export async function fetchFxRates(
  currencies: string[],
): Promise<Record<string, number>> {
  const fx: Record<string, number> = { [BASE_CURRENCY]: 1 };
  const need = [...new Set(currencies)].filter(
    (c) => c && c !== BASE_CURRENCY,
  );
  await Promise.all(
    need.map(async (cur) => {
      const rate = await fetchYahooNumber(`${cur}${BASE_CURRENCY}=X`);
      if (rate != null) fx[cur] = rate;
    }),
  );
  return fx;
}

async function fetchStockQuote(
  ticker: string,
  apiKey: string,
): Promise<number | null> {
  const url = `${FINNHUB}/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { c?: number };
  return typeof data.c === "number" && data.c > 0 ? data.c : null;
}

async function fetchCryptoPrice(
  ticker: string,
  apiKey: string,
): Promise<number | null> {
  const symbol = `BINANCE:${ticker.toUpperCase()}USDT`;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * 7;
  const url = `${FINNHUB}/crypto/candle?symbol=${encodeURIComponent(
    symbol,
  )}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { s?: string; c?: number[] };
  if (data.s !== "ok" || !Array.isArray(data.c) || data.c.length === 0) return null;
  const last = data.c[data.c.length - 1];
  return typeof last === "number" && last > 0 ? last : null;
}

// Yahoo Finance chart endpoint (keyless, unofficial). Returns the latest price
// in the symbol's native currency. Tries query1 then query2.
async function fetchYahooNumber(symbol: string): Promise<number | null> {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const res = await fetch(
        `https://${host}/v8/finance/chart/${symbol}?interval=1d&range=1d`,
        {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
      };
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number" && price > 0) return price;
    } catch {
      // try next host
    }
  }
  return null;
}
