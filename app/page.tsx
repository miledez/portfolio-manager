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

  const { data } = await supabase
    .from("holdings")
    .select("*")
    .order("buy_date", { ascending: false })
    .order("created_at", { ascending: false });

  // asset_class is constrained to the four classes by the DB check.
  const holdings = (data ?? []) as Holding[];

  return <Dashboard holdings={holdings} userEmail={user.email ?? ""} />;
}
