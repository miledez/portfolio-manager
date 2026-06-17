import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard/Dashboard";
import type { Holding } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this, but guard here too for safety.
  if (!user) redirect("/login");

  const [holdingsRes, snapshotsRes] = await Promise.all([
    supabase
      .from("holdings")
      .select("*")
      .order("buy_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("snapshots")
      .select("snapshot_date, total_value")
      .order("snapshot_date", { ascending: true }),
  ]);

  // asset_class is constrained to the four classes by the DB check.
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const snapshots = snapshotsRes.data ?? [];

  return (
    <Dashboard
      holdings={holdings}
      snapshots={snapshots}
      userEmail={user.email ?? ""}
    />
  );
}
