# CLAUDE.md — Portfolio Dashboard

Project memory for Claude Code. The full spec + design system live in `portfolio-handoff/`:
read `portfolio-handoff/CLAUDE.md`, `portfolio-handoff/DESIGN.md`, and the source-of-truth UI
draft `portfolio-handoff/reference/dashboard-draft.jsx` before changing UI.

## What this is
A personal investment & asset portfolio dashboard. Track holdings across asset classes, pull
live prices on demand, see allocation, watch total value develop via daily snapshots. Grows
toward a strategy analyzer (target allocation + rebalancing).

## Stack (actual, as scaffolded)
- Next.js **16** (App Router) + React **19** + TypeScript
- Tailwind **v4** — tokens via `@theme` in `app/globals.css` (NOT `tailwind.config.ts`)
- Supabase (Postgres + Auth magic-link + RLS) via `@supabase/ssr`
- recharts (charts), lucide-react (icons)
- Vercel hosting + Vercel Cron; repo `github.com/miledez/portfolio-manager` (public)
- Import alias `@/*` → repo root (no `src/` dir)

## Conventions
- Server Components by default; `"use client"` only for interactive pieces (forms, charts, toggles).
- Money/quantities `numeric` in DB → `number` in TS; format only at the edge via `lib/format.ts`.
- One purchase = one `holdings` row (a "lot"); aggregate by ticker/class in the UI.
- DB↔draft field map: `asset_class`↔`cls`, `quantity`↔`qty`, `buy_price`↔`cost`, `buy_date`↔`date`.
  Live `price` is fetched on demand and held in client state — not persisted on `holdings`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `MARKET_DATA_API_KEY`, or `ANTHROPIC_API_KEY` to the client.
- Do NOT redesign — match `DESIGN.md` exactly. One navy accent; green/red only for gain/loss.

## Security
- `.env*` is gitignored; the repo is **public**. Never commit real keys (the real Finnhub key
  lives in `portfolio-handoff/.env.example`, which stays ignored).
- RLS is ON for every user table (policies in `supabase/schema.sql`). Client access is RLS-scoped;
  the service-role key is used only server-side in the snapshot cron.

## Build roadmap (deploy after each phase)
1. ✅ Scaffold (Next + TS + Tailwind v4 tokens), `lib/` utils, push to GitHub + Vercel.
2. ✅ Supabase + email magic-link auth (`@supabase/ssr` clients, middleware, `/login`, `/auth/callback`).
3. ✅ Port dashboard UI from the draft; read/write `holdings` in Supabase (server actions + revalidate).
4. ✅ Live prices via `app/api/prices/route.ts` (Finnhub `/quote`; crypto via Binance candles).
5. ✅ Daily snapshots (`app/api/snapshot/route.ts` + Vercel Cron, service-role) + recharts development chart.
6. ⏳ Strategy analyzer (`allocation_targets`: target sliders, drift, rebalance hints).

## Commands
```bash
npm run dev      # local dev
npm run build    # production build
npm run lint     # eslint
npx supabase gen types typescript   # regenerate lib/database.types.ts (Phase 2)
```
