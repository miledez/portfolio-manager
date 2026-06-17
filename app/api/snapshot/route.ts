import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPrices, type PriceItem } from "@/lib/pricing";
import { isCash } from "@/lib/constants";

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
    .select("user_id, ticker, asset_class, quantity, buy_price");
  if (error) {
    return NextResponse.json(
      { error: "Could not read holdings." },
      { status: 500 },
    );
  }
  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ ok: true, users: 0, snapshots: 0 });
  }

  // Price every unique non-cash ticker once (shared across users).
  const seen = new Set<string>();
  const priceItems: PriceItem[] = [];
  for (const h of holdings) {
    if (isCash(h.asset_class) || seen.has(h.ticker)) continue;
    seen.add(h.ticker);
    priceItems.push({ ticker: h.ticker, assetClass: h.asset_class });
  }
  const { prices } = await fetchPrices(priceItems, apiKey);

  // Sum priced value per user (cash = quantity * 1; unpriced contributes 0).
  const totalByUser = new Map<string, number>();
  for (const h of holdings) {
    const price = isCash(h.asset_class) ? 1 : prices[h.ticker];
    if (price == null) continue;
    totalByUser.set(
      h.user_id,
      (totalByUser.get(h.user_id) ?? 0) + h.quantity * price,
    );
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
