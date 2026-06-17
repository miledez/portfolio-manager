"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSET_CLASSES, isCash, type AssetClass } from "@/lib/constants";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addHolding(input: {
  assetClass: string;
  ticker: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const assetClass = input.assetClass as AssetClass;
  if (!ASSET_CLASSES.includes(assetClass)) {
    return { error: "Pick a valid asset type." };
  }

  const ticker = input.ticker.trim().toUpperCase();
  const quantity = Number(input.quantity);
  const cash = isCash(assetClass);
  const buyPrice = cash ? 1 : Number(input.buyPrice);

  if (!ticker) return { error: "Ticker or label is required." };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Quantity must be greater than zero." };
  }
  if (!cash && (!Number.isFinite(buyPrice) || buyPrice < 0)) {
    return { error: "Enter a valid buy price." };
  }

  const { error } = await supabase.from("holdings").insert({
    user_id: user.id,
    ticker,
    asset_class: assetClass,
    quantity,
    buy_price: buyPrice,
    buy_date: input.buyDate || new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: "Couldn't save the holding. Try again." };

  revalidatePath("/");
  return {};
}

export async function removeHolding(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS scopes the delete to the signed-in user's own rows.
  await supabase.from("holdings").delete().eq("id", id);
  revalidatePath("/");
}

export async function clearSnapshots(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("snapshots").delete().eq("user_id", user.id);
  revalidatePath("/");
}
