"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSET_CLASSES, isCash } from "@/lib/constants";

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

  const assetClass = input.assetClass;
  if (!(ASSET_CLASSES as readonly string[]).includes(assetClass)) {
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

const FI_INDEXES = ["CDI", "IPCA", "PRE"] as const;

export async function addFixedIncome(input: {
  label: string;
  principal: number;
  buyDate: string;
  fiIndex: string;
  fiRate: number;
  fiMaturity?: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const label = input.label.trim().toUpperCase();
  const principal = Number(input.principal);
  const fiRate = Number(input.fiRate);
  const fiIndex = input.fiIndex as (typeof FI_INDEXES)[number];

  if (!label) return { error: "A label is required." };
  if (!FI_INDEXES.includes(fiIndex)) return { error: "Pick CDI, IPCA or PRE." };
  if (!Number.isFinite(principal) || principal <= 0) {
    return { error: "Principal must be greater than zero." };
  }
  if (!Number.isFinite(fiRate) || fiRate <= 0) {
    return { error: "Enter a valid rate." };
  }

  const { error } = await supabase.from("holdings").insert({
    user_id: user.id,
    ticker: label,
    asset_class: "FixedIncome",
    quantity: 1,
    buy_price: principal, // principal in BRL
    buy_date: input.buyDate || new Date().toISOString().slice(0, 10),
    fi_index: fiIndex,
    fi_rate: fiRate,
    fi_maturity: input.fiMaturity || null,
  });
  if (error) return { error: "Couldn't save the holding. Try again." };

  revalidatePath("/");
  return {};
}

export async function addContribution(input: {
  amount: number;
  flowDate: string;
  note?: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return { error: "Amount must be non-zero (+ deposit, − withdrawal)." };
  }

  const { error } = await supabase.from("contributions").insert({
    user_id: user.id,
    amount,
    flow_date: input.flowDate || new Date().toISOString().slice(0, 10),
    note: input.note?.trim() || null,
  });
  if (error) return { error: "Couldn't save the contribution. Try again." };

  revalidatePath("/");
  return {};
}

export async function removeContribution(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS scopes the delete to the signed-in user's own rows.
  await supabase.from("contributions").delete().eq("id", id);
  revalidatePath("/");
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

export async function saveTargets(
  targets: Record<string, number>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const rows = ASSET_CLASSES.map((cls) => ({
    user_id: user.id,
    asset_class: cls,
    target_pct: Math.max(0, Math.min(100, Math.round(Number(targets[cls] ?? 0)))),
  }));

  const { error } = await supabase
    .from("allocation_targets")
    .upsert(rows, { onConflict: "user_id,asset_class" });
  if (error) return { error: "Couldn't save targets. Try again." };

  revalidatePath("/");
  return {};
}
