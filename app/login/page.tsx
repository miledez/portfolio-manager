"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function sendLink() {
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
          <p className="text-xs text-muted">Sign in to your dashboard</p>
        </div>

        <div className="rounded-lg border border-hairline bg-surface p-6">
          {status === "sent" ? (
            <div className="text-center">
              <h2 className="text-sm font-semibold">Check your email</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                We sent a magic link to{" "}
                <span className="text-ink">{email}</span>. Open it on this device
                to finish signing in.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendLink();
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">Email</span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-hairline px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>

              {status === "error" && (
                <p className="text-sm text-negative">
                  {error || "Couldn't send the link. Check the address and try again."}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
              >
                {status === "sending" ? "Sending…" : "Send magic link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted">
          We email you a one-time link — no password needed.
        </p>
      </div>
    </div>
  );
}
