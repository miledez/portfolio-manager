# Portfolio Dashboard — Handoff

A personal investment & asset portfolio dashboard: track holdings by asset class, pull live
prices on demand, view allocation, and watch total value develop via daily snapshots.

## What's in this package
- `CLAUDE.md` — project context + build roadmap for Claude Code (read first).
- `DESIGN.md` — exact visual system to preserve the draft look.
- `supabase/schema.sql` — database tables + Row Level Security.
- `.env.example` — required environment variables.
- `reference/dashboard-draft.jsx` — the working visual draft (source of truth for look & behavior).

## One-time setup

**1. GitHub**
- Create an empty repo. You'll push the scaffold here in Phase 1.

**2. Supabase**
- Create a project. In SQL Editor, run `supabase/schema.sql`.
- Enable Email auth (magic link) under Authentication → Providers.
- Copy Project URL, anon key, and service role key into your env (see `.env.example`).

**3. Pricing provider**
- Create a free key with a market-data provider (Finnhub / Twelve Data / Alpha Vantage)
  and set `MARKET_DATA_API_KEY`. (Or use `ANTHROPIC_API_KEY` server-side as an alternative.)

**4. Vercel**
- Import the GitHub repo. Add all env vars from `.env.example` in Project Settings → Environment Variables.
- Daily snapshots: add a `vercel.json` cron hitting `/api/snapshot` (Claude Code sets this up in Phase 5).

## Build it with Claude Code
From the project root, run `claude`, then drive it phase by phase:

> Read CLAUDE.md and DESIGN.md. Do Phase 1: scaffold Next.js (App Router) + TypeScript +
> Tailwind, wire the design tokens from DESIGN.md, and prepare it for GitHub + Vercel.

Then continue: "Do Phase 2" (Supabase + auth), "Do Phase 3" (port the dashboard UI from
reference/dashboard-draft.jsx), and so on through the roadmap. Deploy after each phase.

## Notes
- The draft fetches prices from the browser — that only works in the artifact sandbox.
  Production moves pricing to a server route so keys stay private (handled in Phase 4).
- The draft stores snapshots in browser storage; production uses the `snapshots` table.
- Not financial advice.
