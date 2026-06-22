# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A personal investment & asset portfolio dashboard: track holdings across asset classes (incl.
Brazilian fixed income), pull live prices on demand, see allocation, watch total value develop via
daily snapshots, and plan against target allocations. On top of that is a **Research** view
(`/research`): a comparison overview that normalizes every holding and benchmark (CDI, IPCA,
Ibovespa) to **nominal / real / after-tax** annualized returns, a money-weighted (XIRR) portfolio
return, and an optional **AI analysis** that narrates those figures with live market context.
The source-of-truth spec + visual design live in `portfolio-handoff/` — read
`portfolio-handoff/DESIGN.md` and the UI draft `portfolio-handoff/reference/dashboard-draft.jsx`
before touching UI. **Do not redesign**: one navy accent, green/red only for performance figures.

## Stack
- Next.js **16** (App Router) + React **19** + TypeScript
- Tailwind **v4** — design tokens via `@theme` in `app/globals.css` (there is NO `tailwind.config.ts`)
- Supabase (Postgres + magic-link Auth + RLS) via `@supabase/ssr`
- recharts (charts), lucide-react (icons), `@anthropic-ai/sdk` (AI analysis)
- Vercel hosting + Vercel Cron; public repo `github.com/miledez/portfolio-manager`
- Import alias `@/*` → repo root (no `src/`)

## Commands
```bash
npm run dev          # local dev
npm run build        # production build (Turbopack)
npm run lint         # eslint (flat config; portfolio-handoff/ is ignored)
npx tsc --noEmit     # type-check only — the fast local verification loop
```
- **No test suite exists.** Verify with `npx tsc --noEmit` + `npm run lint`. Pure logic (returns,
  tax, fixed-income, comparison) can be spot-checked with a throwaway `npx tsx` script.
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

**Dashboard data flow:** `app/page.tsx` (Server Component) gates on `getUser()`, then loads holdings +
snapshots + targets (RLS-scoped), seeds FX, and **values fixed-income holdings server-side**
(`valueFixedIncome`, BRL keyed by holding id), passing `initialFiValues` to
`components/dashboard/Dashboard.tsx` — the one `"use client"` boundary. `Dashboard` holds ephemeral
client state (live `prices`, `fx`, `allocBy`) and derives all figures through pure functions in
`lib/portfolio.ts` (`computeRows`/`computeTotals`/`computeAllocation`). Sub-components under
`components/dashboard/`, `components/research/`, and `components/ui/` are leaf client components without
their own `"use client"` where they inherit a boundary; the `/research` interactive cards
(`AddFixedIncomeForm`, `ContributionsCard`, `AdvisorCard`) **do** declare `"use client"` since the
research page is a Server Component.

**Mutations are server actions** in `app/actions.ts` (`addHolding`, `addFixedIncome`, `removeHolding`,
`addContribution`, `removeContribution`, `clearSnapshots`, `saveTargets`, `signOut`): each validates
server-side, writes RLS-scoped, and `revalidatePath("/")`.

**Asset classes:** `lib/constants.ts` — `ASSET_CLASSES` is the **four tradeable classes shown in the
add-holding form and target editor** (Stock/ETF/Crypto/Cash). `FixedIncome` is a first-class asset class
at the data/engine level but is **deliberately kept out of `ASSET_CLASSES`** (entered via its own form);
`ALL_ASSET_CLASSES` (= the four + FixedIncome) is the source for the `AssetClass` type and `CLASS_COLOR`.
Helpers `isCash` / `isFixedIncome`.

**Pricing + currency (the subtle part):**
- `app/api/prices/route.ts` (auth-gated POST) → `lib/pricing.ts`, which routes per ticker: Finnhub
  `/quote` (US, USD), Finnhub Binance candle (crypto, USD), Yahoo chart endpoint (`.CO`→DKK, `.SA`→BRL).
  Returns **native** prices keyed by ticker plus an `fx` map (`<CUR>BRL=X` via Yahoo).
- `lib/currency.ts` `nativeCurrency(ticker, assetClass)` is the single source of truth for routing and
  conversion (Cash and FixedIncome → BRL). Base currency is **BRL**. `lib/portfolio.ts` converts native
  price + `buy_price` → BRL via `fx`; fixed-income value is supplied separately (`fiValues`, already BRL).
- Cash/FixedIncome are never market-priced — they're excluded from the price fetch everywhere
  (dashboard `updatePrices`, the prices route, and the snapshot cron).

**Fixed income (CDBs):** a fixed-income holding is stored on `holdings` as `quantity = 1`,
`buy_price = principal` (BRL), `buy_date = application date`, plus `fi_index` ∈ `CDI|IPCA|PRE` and
`fi_rate` (CDI → % of CDI, e.g. 110; IPCA → spread % p.a.; PRE → fixed % p.a.) and optional `fi_maturity`.
`lib/fixedincome.ts` `valueFixedIncome(holding)` accrues it from BCB series: CDI compounds the daily DI
at `fi_rate`%, IPCA = cumulative IPCA × `(1 + spread)^years`, PRE = `(1 + rate)^years`. Used by
`app/page.tsx`, the snapshot cron, and `lib/research.ts`.

**Research view (the comparison overview):** `app/research/page.tsx` (Server Component, auth-gated) →
`lib/research.ts` `buildResearchData(supabase)`, the **shared** builder that loads holdings +
contributions, fetches prices/FX server-side, values fixed income, pulls benchmarks (BCB CDI/IPCA +
brapi Ibovespa), builds the comparison, and computes the money-weighted (XIRR) portfolio return. The
page renders `ComparisonTable`, `AdvisorCard`, `ContributionsCard`, `AddFixedIncomeForm`. The
deterministic engine is pure and testable:
- `lib/returns.ts` — `xirr` (Newton + bisection), `annualize`, `cagr`, Fisher `realReturn`, `daysBetween`.
- `lib/tax/br.ts` — regressive IR table for fixed income (22.5%→15% by holding days), 15% equity/crypto,
  `afterTaxReturn`. Monthly sale-value exemptions are surfaced as constants, **not** auto-applied.
- `lib/compare.ts` — `analyzeAsset` / `analyzeBenchmark` / `buildComparison` (nominal/real/after-tax),
  `annualizedInflation`.

**Market-data connectors (server-side, degrade gracefully like `lib/pricing.ts`):**
- `lib/marketdata/bcb.ts` — Banco Central SGS (keyless): CDI = series 12, Selic = 11, IPCA = 433, plus
  `compoundCdiFactor` / `cumulativeIpcaFactor`. Date filters are mandatory (BCB caps a request at 10y).
- `lib/marketdata/brapi.ts` — B3 quotes + daily history + Ibovespa (`^BVSP`). Optional `BRAPI_TOKEN`
  lifts the free-tier limit.

**AI analysis (Phase 4):** `app/api/advice/route.ts` (auth-gated POST, `maxDuration = 60`) **recomputes**
via `buildResearchData` (so the AI can't be fed bogus numbers from the client) and calls `lib/advisor.ts`
`generateAdvice`. The advisor formats the deterministic figures into a quote-exactly prompt and calls
`claude-opus-4-8` with the `web_search_20260209` server tool + adaptive thinking, handling the
`pause_turn` loop, returning a narrative + citations. **Claude narrates the numbers — it never
recomputes or invents them.** Gated by `ANTHROPIC_API_KEY`; `AdvisorCard` hides/disables the button when
unset. Informational, not personalized financial advice.

**Snapshots:** `app/api/snapshot/route.ts` (GET, guarded by `CRON_SECRET` Bearer) uses the admin client
to read every user's holdings, prices each unique market ticker once, **accrues fixed income from BCB**,
converts to BRL, and upserts one row per user per day (`onConflict: "user_id,snapshot_date"`).
`vercel.json` runs it daily (`0 22 * * *`).

**Database:** `supabase/schema.sql` is the **fresh-install** schema — `holdings` (one row per purchase
"lot"; carries the nullable `fi_*` columns), `snapshots`, `allocation_targets`, `contributions` — all with
RLS on. For an **existing** database, apply the incremental migration in `supabase/migrations/`
(`0001_fixed_income_and_contributions.sql`, guarded with `if not exists` / `drop … if exists`) — running
the full `schema.sql` against a live DB errors on `holdings already exists`. `lib/database.types.ts` is
**hand-maintained** to mirror the schema; a Supabase MCP may be connected but isn't reliably this
project's database, so keep the types in sync manually and apply migrations yourself.

## Conventions
- Server Components by default; `"use client"` only at interactive boundaries (Dashboard, forms, cards).
- Money/quantities are `numeric` in DB → `number` in TS; format only at the edge via `lib/format.ts`
  (`money(n, currency)` defaults to BRL; `pct(n)` expects **percent units**, so pass `ratio * 100`).
- One purchase = one `holdings` row; aggregate by ticker/class in the UI. Live price is fetched on
  demand and held in client state — never persisted on `holdings`.
- Cash is treated as base currency (BRL), `buy_price = 1`, and counts immediately.
- Buy price is entered in the holding's **native** currency (DKK for `.CO`, USD for US, BRL for `.SA`/cash).
- Fixed income: `quantity = 1`, `buy_price = principal` (BRL), terms in `fi_*` (see Architecture).
- Contributions: `amount` is signed BRL — **positive = deposit (money in), negative = withdrawal** — and
  feeds the money-weighted (XIRR) return so deposits aren't mistaken for gains.
- The deterministic engine (`returns`/`tax`/`compare`/`fixedincome`) is pure; connectors do the I/O at
  the edge. Keep it that way so the math stays testable.

## Deploy & environment
- Push to `main` → Vercel auto-deploys (project linked to the repo). The Vercel dashboard Framework
  Preset is null, so `vercel.json` pins `"framework": "nextjs"` — keep that, or every route 404s.
- Optional env vars: `ANTHROPIC_API_KEY` (enables the AI analysis on `/research` via
  `app/api/advice` → `lib/advisor.ts`, model `claude-opus-4-8` with web search; the feature is
  hidden when unset), `BRAPI_TOKEN` (lifts brapi's free-tier limit for the Ibovespa benchmark).
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
- Fixed-income valuation uses common market conventions with a **calendar-year approximation** for
  prefixed/IPCA+ (no ANBIMA 252-business-day calendar); CDI compounds the published daily DI series.
- The comparison annualizes each asset over **its own** holding period, and benchmarks over the earliest
  holding's horizon — so different periods aren't strictly comparable. Tax figures apply the BR IR rules
  and ignore monthly sale-value exemptions. All of this is surfaced in the on-page methodology note.
