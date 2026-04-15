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
- Price refresh across:
  - Yahoo Finance for Indian stocks and ETFs
  - Twelve Data for US ETFs and UAE stocks
  - CoinGecko for crypto
  - Frankfurter for FX
  - MFAPI for Indian mutual funds
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

Optional/market-data specific:

```bash
TWELVE_DATA_API_KEY=...
ALPHA_VANTAGE_API_KEY=...
```

Note: the app now uses Yahoo Finance for Indian equity pricing, so `ALPHA_VANTAGE_API_KEY` is no longer required for the current dashboard flow.

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

Apply the holdings migration to your Supabase project:

```sql
supabase/migrations/20260407_create_holdings_table.sql
```

This creates:

- `public.holdings`
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
```

## Current Notes

- `npm run build` passes
- `npm run lint` is still affected by the archived `investment-portfolio-app` directory, which is outside the active app

## Deployment

Recommended deployment target: Vercel.

Make sure the deployed environment includes the same Supabase and market-data environment variables as local development.

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
