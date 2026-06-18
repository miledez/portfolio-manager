import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard/Dashboard";
import { ASSET_CLASSES } from "@/lib/constants";
import { nativeCurrency } from "@/lib/currency";
import { fetchFxRates } from "@/lib/pricing";
import type { Holding } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this, but guard here too for safety.
  if (!user) redirect("/login");

  const [holdingsRes, snapshotsRes, targetsRes] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .order("buy_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("snapshots")
      .select("snapshot_date, total_value")
      .order("snapshot_date", { ascending: true }),
    supabase.from("allocation_targets").select("asset_class, target_pct"),
  ]);

  // asset_class is constrained to the four classes by the DB check.
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const snapshots = snapshotsRes.data ?? [];

  const initialTargets: Record<string, number> = {};
  for (const cls of ASSET_CLASSES) initialTargets[cls] = 0;
  for (const t of targetsRes.data ?? []) initialTargets[t.asset_class] = t.target_pct;

  // FX rates so cost basis shows in the base currency before prices are fetched.
  const initialFx = await fetchFxRates(
    holdings.map((h) => nativeCurrency(h.ticker, h.asset_class)),
  );

  return (
    <Dashboard
      holdings={holdings}
      snapshots={snapshots}
      initialTargets={initialTargets}
      initialFx={initialFx}
      userEmail={user.email ?? ""}
    />
  );
}
