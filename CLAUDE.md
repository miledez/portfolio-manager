# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A personal investment & asset portfolio dashboard: track holdings across asset classes, pull live
prices on demand, see allocation, watch total value develop via daily snapshots, and plan against
target allocations. The source-of-truth spec + visual design live in `portfolio-handoff/` — read
`portfolio-handoff/DESIGN.md` and the UI draft `portfolio-handoff/reference/dashboard-draft.jsx`
before touching UI. **Do not redesign**: one navy accent, green/red only for gain/loss.

## Stack
- Next.js **16** (App Router) + React **19** + TypeScript
- Tailwind **v4** — design tokens via `@theme` in `app/globals.css` (there is NO `tailwind.config.ts`)
- Supabase (Postgres + magic-link Auth + RLS) via `@supabase/ssr`
- recharts (charts), lucide-react (icons)
- Vercel hosting + Vercel Cron; public repo `github.com/miledez/portfolio-manager`
- Import alias `@/*` → repo root (no `src/`)

## Commands
```bash
npm run dev          # local dev
npm run build        # production build (Turbopack)
npm run lint         # eslint (flat config; portfolio-handoff/ is ignored)
npx tsc --noEmit     # type-check only — the fast local verification loop
```
- **No test suite exists.** Verify with `npx tsc --noEmit` + `npm run lint`.
- A full local `npm run build` can be OOM-killed on low-memory machines (Turbopack is memory-hungry).
  Locally, prefer `tsc --noEmit` + lint; treat the **Vercel build as the authoritative gate**.

## Architecture (the cross-file picture)

**Three Supabase clients, by context:**
- `lib/supabase/client.ts` — browser (anon key), for client components.
- `lib/supabase/server.ts` — RSC / Server Actions / Route Handlers. `cookies()` is async (Next 16);
  uses the `getAll`/`setAll` cookie pattern.
- `lib/supabase/admin.ts` — service-role, **bypasses RLS**, used ONLY by the snapshot cron.

**Auth gating:** `middleware.ts` → `lib/supabase/middleware.ts` (`updateSession`) refreshes the session
on every request and redirects signed-out users to `/login`. It **excludes `/api/*`** (matcher) so API
routes self-authenticate instead of being bounced to the login page (critical for the cron).
Magic-link sign-in: `app/login/page.tsx` (`signInWithOtp`) → `app/auth/callback/route.ts` (handles
both the PKCE `code` and `token_hash` flows).

**Data flow:** `app/page.tsx` (Server Component) gates on `getUser()`, then loads holdings + snapshots
+ targets (RLS-scoped) + initial FX, and passes them to `components/dashboard/Dashboard.tsx` — the one
`"use client"` boundary. `Dashboard` holds ephemeral client state (live `prices`, `fx`, `allocBy`) and
derives all figures through pure functions in `lib/portfolio.ts` (`computeRows`/`computeTotals`/
`computeAllocation`). Sub-components under `components/dashboard/` and `components/ui/` are leaf client
components without their own `"use client"` (they inherit the Dashboard boundary — adding the directive
to one that takes function props triggers a Next "serializable props" error).

**Mutations are server actions** in `app/actions.ts` (`addHolding`, `removeHolding`, `clearSnapshots`,
`saveTargets`, `signOut`): each validates server-side, writes RLS-scoped, and `revalidatePath("/")`,
so the server re-renders with fresh DB data while the client's price/FX state persists.

**Pricing + currency (the subtle part):**
- `app/api/prices/route.ts` (auth-gated POST) → `lib/pricing.ts`, which routes per ticker: Finnhub
  `/quote` (US, USD), Finnhub Binance candle (crypto, USD), Yahoo chart endpoint (`.CO`→DKK, `.SA`→BRL).
  Returns **native** prices keyed by ticker plus an `fx` map (`<CUR>BRL=X` via Yahoo).
- `lib/currency.ts` `nativeCurrency(ticker, assetClass)` is the single source of truth for both routing
  and conversion. Base currency is **BRL**. `lib/portfolio.ts` converts native price + `buy_price` → BRL
  via `fx` (at current FX). Per-row Buy/Now display native currency; all aggregates are BRL.
- FX is seeded server-side in `app/page.tsx` (so cost basis shows in BRL on load) and refreshed on
  "Update prices". Yahoo is keyless/unofficial (query1→query2 fallback) and may rate-limit from servers.

**Snapshots:** `app/api/snapshot/route.ts` (GET, guarded by `CRON_SECRET` Bearer) uses the admin client
to read every user's holdings, prices each unique ticker once, converts to BRL, and upserts one row per
user per day (`onConflict: "user_id,snapshot_date"`). `vercel.json` runs it daily (`0 22 * * *`).

**Database:** `supabase/schema.sql` defines `holdings` (one row per purchase "lot"), `snapshots`, and
`allocation_targets` — all with RLS on. `lib/database.types.ts` is **hand-maintained** to mirror the
schema; the Supabase CLI/MCP is NOT linked to this project's account, so keep it in sync manually
(don't expect `supabase gen types` to work here).

## Conventions
- Server Components by default; `"use client"` only at interactive boundaries (the Dashboard, forms).
- Money/quantities are `numeric` in DB → `number` in TS; format only at the edge via `lib/format.ts`
  (`money(n, currency)` defaults to BRL).
- One purchase = one `holdings` row; aggregate by ticker/class in the UI. Live price is fetched on
  demand and held in client state — never persisted on `holdings`.
- Cash is treated as base currency (BRL), `buy_price = 1`, and counts immediately.
- Buy price is entered in the holding's **native** currency (DKK for `.CO`, USD for US, BRL for `.SA`/cash).

## Deploy & environment
- Push to `main` → Vercel auto-deploys (project linked to the repo). The Vercel dashboard Framework
  Preset is null, so `vercel.json` pins `"framework": "nextjs"` — keep that, or every route 404s.
- Required env vars in Vercel **and** `.env.local` (env changes require a redeploy to take effect):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `MARKET_DATA_API_KEY` (Finnhub), `CRON_SECRET`.
- `.env*` is gitignored and the repo is public — never commit real keys (the real Finnhub key lives in
  `portfolio-handoff/.env.example`, which stays ignored).

## Known limitations
- Finnhub free tier is US-focused; non-US equities are priced via Yahoo by suffix (`.CO`, `.SA`).
  A ticker with no resolvable price stays `—` and contributes 0 to totals/snapshots.
- Cost basis converts at current FX (not purchase-date FX), so gain reflects local-price movement in
  BRL terms, not historical FX P&L.
