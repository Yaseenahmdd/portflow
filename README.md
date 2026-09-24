# Portflow

Portflow is a responsive portfolio tracker for monitoring stock and asset performance across multiple markets, regions, and asset classes. The goal of the project is to give a single view of holdings, allocation, and performance across equities, ETFs, crypto, mutual funds, and other assets without splitting the workflow across multiple tools.

It is built with Next.js and Supabase and supports authenticated users, live market price refresh, holdings import/export, Supabase-backed persistence, and installability as a PWA.

## Features

- Track holdings across multiple markets, brokers, and asset classes in one dashboard
- Support portfolios spanning regions such as the US, India, and the UAE
- Monitor portfolio value, invested capital, and unrealised gain/loss
- View allocation by platform, asset class, and geography
- Portfolio dashboard with holdings, allocation views, and portfolio metrics
- Auth with Supabase
- Holdings stored per user in Supabase, with local fallback for demo mode
- Import/export holdings as JSON
- Record buys, sells, dividends, cash movements, fees, splits, and currency exchanges in a transaction ledger
- Price refresh across:
  - Yahoo Finance for Indian stocks and ETFs
  - Yahoo Finance for US stocks and ETFs, including available pre-market trades
  - DFM delayed quotes for UAE stocks
  - CoinGecko for crypto
  - Frankfurter for FX
  - AMFI with MFAPI fallback for Indian mutual funds
- Near-live dashboard updates every minute for supported stocks, ETFs, gold funds, crypto, and delayed DFM quotes while the app is open
- US pre-market quotes update holding values and daily changes when Yahoo provides an intraday trade. Holdings show a pre-market label and the quote time; otherwise they retain the regular-market price.
- Mobile-friendly holdings view
- Installable PWA with manifest, icons, and a lightweight service worker

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase Auth + Postgres
- Tailwind CSS v4
- Recharts

## Project Structure

```text
src/
  app/
    dashboard/            Authenticated app screens
    api/prices/           Market data route handlers
    auth/callback/        Supabase auth callback
    manifest.ts           Web app manifest
    icon.tsx              Generated app icon
    apple-icon.tsx        Generated Apple touch icon
  components/             UI components
  lib/
    api/                  Market data helpers
    supabase/             Supabase browser/server setup
    holdings-store.ts     Supabase holdings persistence helpers
    transactions-store.ts Supabase transaction persistence helpers
supabase/
  migrations/             SQL migrations
public/
  sw.js                   Service worker
```

## Environment Variables

Create `.env.local` from `.env.example`.

Required for auth and persistence:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Required for the scheduled server-side price refresh:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Keep both values server-only. The service-role key must never use the
`NEXT_PUBLIC_` prefix.

The current market-data integrations do not require additional API keys.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Setup

Apply the migrations in `supabase/migrations/` to your Supabase project. The transaction ledger requires:

```sql
supabase/migrations/20260918_create_transactions_table.sql
```

Pre-market quote labels and times require `supabase/migrations/20260924_add_price_session_to_holdings.sql` before deploying this version against Supabase.

The migrations create:

- `public.holdings`
- `public.portfolio_snapshots`
- `public.market_rates`
- `public.transactions`
- updated-at trigger
- row-level security policies for per-user access

## Import and Sync Behavior

- On dashboard load, the app reads holdings from Supabase first
- If Supabase is empty and local holdings exist, it migrates local holdings into Supabase
- Dashboard edits sync back to Supabase automatically
- `Import holdings` replaces the current user’s holdings in Supabase and updates local cache
- `Reset` clears both Supabase and local cache

## PWA

Portflow includes:

- `manifest.webmanifest`
- generated app icons
- Apple touch icon
- service worker registration

To test installability:

1. Run the app in production mode or deploy it
2. Open it in Chrome or Safari on a supported device
3. Use “Add to Home Screen” / install

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## Deployment

Recommended deployment target: Vercel.

Make sure the deployed environment includes the same Supabase and market-data environment variables as local development.

`vercel.json` schedules `/api/cron/refresh-prices` for 21:00 UTC each day,
which is 1:00 AM in Dubai. The protected route refreshes prices in Supabase
without requiring the dashboard to be open.

## Project Goal

The core goal of Portflow is to track performance across a mixed portfolio that spans:

- multiple markets
- multiple regions such as the US, India, and UAE
- multiple brokers/platforms
- multiple currencies
- multiple asset classes

Instead of treating only one market or one security type as the primary workflow, the app is designed to consolidate:

- stocks
- ETFs
- crypto
- mutual funds
- gold and other asset categories

into a single portfolio view with import, sync, and refresh workflows that can scale with a personal investment dashboard.
