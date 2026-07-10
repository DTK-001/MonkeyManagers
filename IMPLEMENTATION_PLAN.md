# Monkey Managers — implementation plan

## Goal

Deliver a runnable, mobile-first GitHub Pages PWA with a complete demo journey, a secure Supabase foundation, tested football domain logic, and production setup documentation. The product name will be read from one central configuration module.

## Milestones

1. **Runnable shell** — scaffold React, strict TypeScript, Vite, Tailwind, HashRouter, PWA assets, responsive design system, demo state, and every primary screen.
2. **Supabase foundation** — authentication adapter, schema migrations, row-level security, league/club setup, seeds, and environment templates.
3. **Ownership and finances** — atomic purchase/release/transfer functions, immutable ledger, market UI, ownership constraints, and conflict handling.
4. **Squads and scoring** — formation validation, lineup locking and substitutions, position-aware scoring explanations, competition allocation, and standings.
5. **Data integration** — provider abstraction, API-Football Edge Functions, nightly idempotent sync, quota reporting, and admin controls.
6. **Valuations** — capped gradual pricing, structured explanations, history charts, and documentation.

## Verification

Install dependencies; run format, lint, strict type checking, unit tests, production build, and Playwright smoke tests where supported. Inspect the application at a phone viewport, check offline/PWA behavior, and scan source/build output for secrets.

## Secret handling

API-Football credentials are accepted only as the Supabase server secret `API_FOOTBALL_KEY`. They must never be stored in tracked files, Vite variables, frontend code, fixtures, logs, or build output.
