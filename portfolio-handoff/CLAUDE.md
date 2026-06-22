# CLAUDE.md — Portfolio Dashboard

Project context for Claude Code. Read this and `DESIGN.md` before writing any code.

> **Status (shipped):** the build roadmap below (steps 1–6) is complete, plus a **Research** view
> (`/research`) — a nominal/real/after-tax comparison across holdings and benchmarks (CDI/IPCA/Ibovespa),
> Brazilian fixed income (CDBs), a contributions log with money-weighted (XIRR) return, and an optional
> AI analysis. **The operative, up-to-date engineering reference is the repo-root `/CLAUDE.md`** — this
> file remains the original handoff spec; `DESIGN.md` is still binding for visuals.

## What we're building
A personal investment & asset portfolio dashboard. Track holdings across asset classes,
pull live prices on demand, see allocation, and watch total value develop over time via
daily snapshots. Grows toward a strategy analyzer (target allocation + rebalancing).

A working visual draft exists at `reference/dashboard-draft.jsx` (single React component).
**It is the source of truth for the look and behavior.** This project ports it into a real
app with a server and a database. Do not redesign — see `DESIGN.md`.

## Stack
- **Next.js (App Router) + TypeScript**
- **Tailwind CSS** (design tokens in `DESIGN.md`)
- **Supabase** — Postgres + Auth + Row Level Security
- **recharts** (charts), **lucide-react** (icons)
- **Vercel** hosting (+ Vercel Cron for daily snapshots)
- Repo on **GitHub**

> Before installing, confirm current package names/versions. Use `@supabase/ssr` for auth
> (not the deprecated `auth-helpers`). If unsure, check Supabase + Next.js docs.

## Architecture
- **Auth-gated dashboard** at `/` (redirect to `/login` if signed out). Supabase email magic-link.
- **Data in Supabase**, scoped per user with RLS. Replaces the draft's `window.storage`.
- **Prices via a server route** `app/api/prices/route.ts` — the API key stays server-side.
  The draft calls a model API from the browser; that only works in the artifact sandbox.
  In production use a real market-data provider (Finnhub / Twelve Data / Alpha Vantage).
  Optional fallback: Anthropic API with the web-search tool, called server-side only.
- **Daily snapshots** written by `app/api/snapshot/route.ts`, triggered by Vercel Cron
  (one row per user per day; upsert on `(user_id, snapshot_date)`).

## Proposed structure
```
app/
  layout.tsx
  page.tsx                  # dashboard (auth-gated)
  login/page.tsx
  api/
    prices/route.ts         # POST {tickers:[]} -> {TICKER: price}
    snapshot/route.ts       # GET (cron) -> upsert today's total per user
components/
  dashboard/                # SummaryStats, AddHoldingForm, HoldingsTable,
                            # AllocationCard, DevelopmentChart
  ui/                       # Stat, Field, Select, Badge, Toggle, Button
lib/
  supabase/{client,server}.ts
  format.ts                 # usd, pct, compact, fmtDay
  pricing.ts                # provider fetch + normalize
  constants.ts              # ASSET_CLASSES, CLASS_COLOR, DONUT
  types.ts
supabase/schema.sql
```

## Conventions
- TypeScript everywhere; generate DB types with `supabase gen types typescript`.
- Server Components by default; `"use client"` only for interactive pieces (forms, charts, toggles).
- Money/quantities as `numeric` in DB, `number` in TS; format only at the edge via `lib/format.ts`.
- One purchase = one `holdings` row (a "lot"); aggregate by ticker/class in the UI.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or `MARKET_DATA_API_KEY` to the client.

## Commands
```bash
npm run dev            # local dev
npm run build          # production build
npm run lint
npx supabase start     # local stack (optional)
npx supabase db push   # apply migrations
```

## Build roadmap (do in order; deploy after each) — ✅ all shipped
> Steps 1–6 are implemented and deployed. A Research/comparison feature + AI analysis were added on top
> (see repo-root `/CLAUDE.md`). Kept here as the original plan of record.
1. **Scaffold** Next.js + TS + Tailwind, wire design tokens from `DESIGN.md`, push to GitHub, deploy to Vercel.
2. **Supabase**: run `supabase/schema.sql`, add `@supabase/ssr` clients, email magic-link auth, `/login`.
3. **Port UI** from `reference/dashboard-draft.jsx`: summary stats, add-holding form, holdings table, allocation card (ticker/class toggle). Read/write `holdings` in Supabase. Match `DESIGN.md` exactly.
4. **Prices**: `api/prices` route hitting the chosen provider; "Update prices" calls it and refreshes values.
5. **Snapshots + Development chart**: `api/snapshot` cron route (daily upsert) + recharts line chart from `snapshots`.
6. **Strategy analyzer**: `allocation_targets` table, target sliders per class, drift vs. target + simple rebalance hints.

## Guardrails
- RLS must be ON for every user table before shipping (policy in schema).
- Validate/normalize tickers server-side; handle provider failures with the draft's error copy.
- Keep the design quiet and data-forward; green/red only for performance figures. See `DESIGN.md`.
