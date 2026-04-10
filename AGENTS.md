<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Portflow Workspace Instructions

## Project Overview

Portflow is a responsive portfolio tracker built with Next.js 16 and Supabase for monitoring multi-asset, multi-region holdings. It provides a unified dashboard for stocks, ETFs, crypto, mutual funds, and other assets across India, US, UAE, and global markets.

**Key Features:**
- Authenticated user dashboards with Supabase persistence
- Live price refresh from multiple market data APIs
- Holdings import/export as JSON
- PWA installability
- Mobile-friendly interface

## Tech Stack & Conventions

- **Framework:** Next.js 16 (App Router) - Always check `node_modules/next/dist/docs/` for breaking changes
- **Frontend:** React 19, TypeScript 5 (strict mode), Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL + Auth), API route handlers
- **Charts:** Recharts
- **Path Aliases:** `@/*` maps to `src/*`
- **Dual Mode:** Authenticated (Supabase) + Demo mode (localStorage fallback)

## Build & Development Commands

```bash
npm run dev        # Start Next.js dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint check
```

## Key Architecture Decisions

### Holdings Data Model
- Single `Holding` type for all asset classes
- Auto-normalization via `holdings-normalize.ts` for price source detection
- Hybrid persistence: Supabase primary, localStorage fallback

### Price Refresh System
- Parallel API calls to 6+ market data sources
- Currency conversions with AED as base currency
- Cached FX rates (Frankfurter API)

### Authentication & Middleware
- Supabase SSR with `getUser()` (not `getSession()`)
- Middleware redirects unauthenticated users to `/login`

## Common Pitfalls & Best Practices

- **Next.js 16 Changes:** Always reference `node_modules/next/dist/docs/` before implementing new features
- **Demo Mode:** Ensure features work without Supabase (check `hasDatabaseClient()`)
- **Currency Handling:** All portfolio metrics in AED; store per-holding currency
- **Mutual Funds:** Require AMFI scheme codes; auto-detect from asset names
- **Event Communication:** Use CustomEvent for cross-component state updates
- **API Keys:** Optional for market data; missing keys disable specific refresh sources

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:
- `TWELVE_DATA_API_KEY` (US ETFs)
- `ALPHA_VANTAGE_API_KEY` (Indian stocks, legacy)

## Key Files & Patterns

- [src/lib/holdings-store.ts](src/lib/holdings-store.ts) - Persistence logic
- [src/lib/holdings-normalize.ts](src/lib/holdings-normalize.ts) - Data normalization
- [src/lib/constants.ts](src/lib/constants.ts) - Enums and asset registry
- [src/app/api/prices/refresh-all/route.ts](src/app/api/prices/refresh-all/route.ts) - Price refresh orchestration
- [src/components/DashboardShell.tsx](src/components/DashboardShell.tsx) - Global UI state

## Documentation Links

- [README.md](README.md) - Setup, features, and deployment
- [supabase/migrations/](supabase/migrations/) - Database schema
- Next.js 16 Docs: `node_modules/next/dist/docs/`

## Validation Checklist

After changes:
- Run `npm run lint` and fix issues
- Test in demo mode (no Supabase configured)
- Verify price refresh works for all asset classes
- Check mobile responsiveness
