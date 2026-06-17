import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this, but guard here too for safety.
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
            <p className="text-xs text-muted">{user.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-negative"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <section className="rounded-lg border border-hairline bg-surface p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">You are signed in</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Holdings, live prices, and daily value snapshots arrive in the next
            phases.
          </p>
        </section>
      </main>
    </div>
  );
}
