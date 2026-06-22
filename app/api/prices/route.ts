import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPrices, fetchFxRates, type PriceItem } from "@/lib/pricing";
import { ASSET_CLASSES, isCash } from "@/lib/constants";
import { nativeCurrency } from "@/lib/currency";

// POST { items: [{ ticker, assetClass }] } -> { prices: {TICKER: number}, missing: [] }
export async function POST(request: Request) {
  const apiKey = process.env.MARKET_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Pricing is not configured." },
      { status: 500 },
    );
  }

  // Require a signed-in session so the key/quota can't be used anonymously.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const items = parseItems(body);
  if (items.length === 0) {
    return NextResponse.json({ prices: {}, fx: {}, missing: [] });
  }

  const result = await fetchPrices(items, apiKey);
  const fx = await fetchFxRates(
    items.map((i) => nativeCurrency(i.ticker, i.assetClass)),
  );
  return NextResponse.json({ ...result, fx });
}

function parseItems(body: unknown): PriceItem[] {
  const raw =
    body && typeof body === "object"
      ? (body as { items?: unknown }).items
      : undefined;
  if (!Array.isArray(raw)) return [];

  const items: PriceItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const ticker = String((entry as { ticker?: unknown }).ticker ?? "")
      .trim()
      .toUpperCase();
    const assetClass = String((entry as { assetClass?: unknown }).assetClass ?? "");
    if (!ticker) continue;
    if (!(ASSET_CLASSES as readonly string[]).includes(assetClass)) continue;
    if (isCash(assetClass)) continue; // cash never needs a price
    items.push({ ticker, assetClass });
  }
  return items;
}
