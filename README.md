# Portfolio Dashboard

A personal investment & asset portfolio dashboard: track holdings by asset class, pull live
prices on demand, view allocation, and watch total value develop via daily snapshots.

> Not financial advice.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (design tokens in `app/globals.css`; see `portfolio-handoff/DESIGN.md`)
- **Supabase** — Postgres + Auth (email magic-link) + Row Level Security
- **recharts** (charts), **lucide-react** (icons)
- **Vercel** hosting (+ Vercel Cron for daily snapshots)

## Setup

1. **Install:** `npm install`
2. **Environment:** copy `.env.example` → `.env.local` and fill in real values.
   `.env*` is gitignored — never commit secrets.
3. **Database:** the schema in `supabase/schema.sql` (3 tables + RLS) is applied to the
   Supabase project.
4. **Run:** `npm run dev` → http://localhost:3000

## Environment variables

See `.env.example`. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `MARKET_DATA_API_KEY`,
`CRON_SECRET`) must never be exposed to the client. The same vars must exist in
Vercel → Project Settings → Environment Variables.

## Commands

```bash
npm run dev     # local dev
npm run build   # production build (type-check + build)
npm run lint    # eslint
```

## Project structure

```
app/
  layout.tsx
  page.tsx                  # dashboard (auth-gated)
  login/page.tsx            # magic-link sign-in
  api/prices/route.ts       # POST {tickers:[]} -> {TICKER: price}
  api/snapshot/route.ts     # GET (cron) -> upsert today's total per user
components/{dashboard,ui}/  # ported from portfolio-handoff/reference/dashboard-draft.jsx
lib/                        # supabase clients, format, pricing, constants, types
supabase/schema.sql         # tables + RLS
```

## Build roadmap

Built phase by phase (deploy after each): 1) scaffold, 2) Supabase + auth, 3) port dashboard UI,
4) live prices, 5) snapshots + development chart, 6) strategy analyzer. Full spec and design
system live in `portfolio-handoff/` (`CLAUDE.md`, `DESIGN.md`, `reference/dashboard-draft.jsx`).
