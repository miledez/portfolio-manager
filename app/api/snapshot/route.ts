import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPrices, fetchFxRates, type PriceItem } from "@/lib/pricing";
import { isCash, isFixedIncome } from "@/lib/constants";
import { BASE_CURRENCY, nativeCurrency } from "@/lib/currency";
import { valueFixedIncome } from "@/lib/fixedincome";
import type { Holding } from "@/lib/types";

// Allow enough time to price every ticker across all users.
export const maxDuration = 60;

// GET (Vercel Cron). Upserts each user's total value for today.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.MARKET_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Pricing is not configured." },
      { status: 500 },
    );
  }

  const supabase = createAdminClient();

  const { data: holdings, error } = await supabase
    .from("holdings")
    .select(
      "id, user_id, ticker, asset_class, quantity, buy_price, buy_date, fi_index, fi_rate, fi_maturity",
    );
  if (error) {
    return NextResponse.json(
      { error: "Could not read holdings." },
      { status: 500 },
    );
  }
  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ ok: true, users: 0, snapshots: 0 });
  }

  // Price every unique market ticker once (shared across users). Cash and fixed
  // income aren't market-priced, so they're excluded here.
  const seen = new Set<string>();
  const priceItems: PriceItem[] = [];
  for (const h of holdings) {
    if (isCash(h.asset_class) || isFixedIncome(h.asset_class)) continue;
    if (seen.has(h.ticker)) continue;
    seen.add(h.ticker);
    priceItems.push({ ticker: h.ticker, assetClass: h.asset_class });
  }
  const [{ prices }, fx, fiValues] = await Promise.all([
    fetchPrices(priceItems, apiKey),
    fetchFxRates(holdings.map((h) => nativeCurrency(h.ticker, h.asset_class))),
    // Value each fixed-income holding from BCB rate series (keyed by id).
    Promise.all(
      holdings
        .filter((h) => isFixedIncome(h.asset_class))
        .map(async (h) => {
          const v = await valueFixedIncome(h as unknown as Holding);
          return [h.id, v?.currentValue ?? null] as const;
        }),
    ),
  ]);
  const fiValueById = new Map(fiValues);

  // Sum each user's value in the base currency (cash = quantity * 1; fixed
  // income from its accrued BCB value; unpriced/unconvertible contribute 0).
  const totalByUser = new Map<string, number>();
  const addToUser = (userId: string, amount: number) =>
    totalByUser.set(userId, (totalByUser.get(userId) ?? 0) + amount);
  for (const h of holdings) {
    if (isFixedIncome(h.asset_class)) {
      const value = fiValueById.get(h.id);
      if (value != null) addToUser(h.user_id, value);
      continue;
    }
    const currency = nativeCurrency(h.ticker, h.asset_class);
    const rate = fx[currency] ?? (currency === BASE_CURRENCY ? 1 : null);
    const price = isCash(h.asset_class) ? 1 : prices[h.ticker];
    if (price == null || rate == null) continue;
    addToUser(h.user_id, h.quantity * price * rate);
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = [...totalByUser.entries()].map(([user_id, total]) => ({
    user_id,
    snapshot_date: today,
    total_value: Math.round(total * 100) / 100,
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("snapshots")
      .upsert(rows, { onConflict: "user_id,snapshot_date" });
    if (upsertError) {
      return NextResponse.json(
        { error: "Could not write snapshots." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    users: totalByUser.size,
    snapshots: rows.length,
  });
}
