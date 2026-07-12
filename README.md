# Monkey Managers

Monkey Managers is a mobile-first private fantasy football ownership game for friends. Every manager creates a fictional club, receives an exact transfer budget, and buys players. Inside one private league, a real player can have only one active owner; the same player may be owned independently in another private league.

Real performances stay attached to the competition in which they occurred. League, cup, European, and international scores therefore build separate private leaderboards as well as an overall season table.

“Monkey Managers” is a temporary name. Rename it centrally in `src/app/product.ts`; gameplay defaults are kept beside it.

## What is included

- Premium responsive React PWA with five one-handed mobile destinations: Home, Squad, Market, Competitions, and League.
- Account-first Supabase access with email/password registration, sign-in, password recovery, sign-out, and league/club onboarding.
- A clean private-league start with a real Premier League player catalogue, six real competition options, original fantasy-club badges, and no inherited scores or ownership.
- Strict TypeScript domain engines for money, market operations, lineup validation/locking, automatic substitutions, competition allocation, scoring, standings, sync identity, provider normalization, and gradual player values.
- PostgreSQL migrations with RLS, audit guards, append-only finance/history, locked-lineup protection, and database-enforced unique active ownership.
- Atomic SQL RPCs for free-agent purchases, releases, and accepted transfer offers with idempotency.
- API-Football provider abstraction and server-only Supabase Edge Functions for scheduled and admin-triggered imports.
- Vite repository-base support, `HashRouter`, manifest, generated service worker, original generic SVG icons, and offline guidance.
- Unit tests, an account-entry Playwright check, CI, and GitHub Pages deployment workflows.

The browser client is account-first: configure Supabase before accessing a private league. The local SQL seed remains available for backend development and testing, but it is not an anonymous browser demo.

## Architecture

```text
GitHub Pages                         Supabase
┌─────────────────────┐             ┌────────────────────────────┐
│ React + HashRouter  │──Auth/RLS──▶│ Auth + Postgres + RPCs     │
│ Authenticated client │             │ Edge Functions + Cron      │
│ PWA service worker  │             │ server-only provider key   │──▶ API-Football
└─────────────────────┘             └────────────────────────────┘
```

GitHub Pages hosts static public assets only. Supabase is the authority for identity, league privacy, ownership, finance, lineup locks, imported match data, and administration. API-Football requests originate only in Edge Functions.

See [Architecture](docs/architecture.md) and [Database](docs/database.md) for the detailed diagrams, trust boundaries, schema map, and transaction behavior.

## Technology choices

| Layer         | Choice                       | Reason                                                           |
| ------------- | ---------------------------- | ---------------------------------------------------------------- |
| UI            | React 19 + strict TypeScript | component composition and type-safe domain boundaries            |
| Build/routing | Vite 6 + `HashRouter`        | fast local build and refresh-safe GitHub Pages routes            |
| Styling       | Tailwind CSS                 | mobile-first design tokens and responsive layout                 |
| Forms         | React Hook Form + Zod        | accessible form state with shared input validation               |
| Server state  | TanStack Query               | caching/retry boundary for connected Supabase data               |
| Charts        | Recharts                     | lightweight player value history                                 |
| PWA           | `vite-plugin-pwa` + Workbox  | manifest, installability, and application-shell cache            |
| Backend       | Supabase                     | PostgreSQL, Auth, RLS, Realtime-ready data, Edge Functions, Cron |
| Unit tests    | Vitest + Testing Library     | fast domain and component regression tests                       |
| End-to-end    | Playwright                   | account-entry regression check                                   |
| Hosting       | GitHub Pages + Actions       | static project-site deployment with reproducible CI              |

## Quick start

Prerequisite: Node.js 20.19 or newer.

```bash
npm ci
cp .env.example .env.local
npx supabase start
npm run db:reset
npx supabase status
```

On Windows PowerShell, if script execution blocks the npm shim, use `npm.cmd ci`, `npm.cmd run db:reset`, and `npm.cmd run dev`.

Copy the local URL and anonymous key from `npx supabase status` into `.env.local`, then run `npm run dev` and open `http://localhost:5173/`. Create an account, create or join a private league, and create a club. In the **League** tab, an admin can create a private invite code; friends sign in, choose **Join a league**, enter that code, and create their own club. The market begins with the real Premier League catalogue and a clean private-league state.

The app deliberately has no anonymous browser demo. If the public Supabase settings are missing, protected routes explain that account setup is required rather than exposing a local league.

## Local configuration

Copy the public example:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

| Variable                 | Example                  | Notes                                            |
| ------------------------ | ------------------------ | ------------------------------------------------ |
| `VITE_SUPABASE_URL`      | `http://127.0.0.1:54321` | required public project URL for account access   |
| `VITE_SUPABASE_ANON_KEY` | local public anon key    | safe for a browser only with RLS                 |
| `VITE_BASE_PATH`         | `/`                      | use `/REPOSITORY_NAME/` for a Pages project site |

Never put `API_FOOTBALL_KEY`, `SYNC_CRON_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in this file or any `VITE_*` variable. Vite compiles those variables into public browser assets.

## Local Supabase setup

Install Docker Desktop and use the Supabase CLI through `npx`:

```bash
npx supabase start
npm run db:reset
npx supabase status
```

`npm run db:reset` recreates the local database, applies `supabase/migrations` in order, and runs the canonical fictional `supabase/seed.sql`. It is the one-command local reset and seed flow.

Copy the local URL and anonymous key printed by `supabase status` into `.env.local`, then restart `npm run dev`. Without these public settings, the account-first client blocks private-league routes and explains the required setup.

To serve Edge Functions locally:

```bash
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
```

The copied file is ignored by Git. Use local Supabase credentials and add a provider key only when deliberately testing real imports.

Full migration, seed, RLS, ledger, ownership, and RPC details are in [Database](docs/database.md).

## Hosted Supabase setup

Create an empty Supabase project, then:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy nightly-sync
npx supabase functions deploy manual-sync
npx supabase functions deploy profile-enrichment
```

Do not run the fictional local SQL seed against production. Use a separate development or staging project for seeded data.

In **Authentication → URL Configuration**, set the production site and redirects:

```text
Site URL:      https://USERNAME.github.io/REPOSITORY_NAME/
Redirect URL: http://localhost:5173/**
Redirect URL: http://127.0.0.1:5173/**
Redirect URL: https://USERNAME.github.io/REPOSITORY_NAME/**
```

Add custom or preview domains explicitly. The password-reset link returns through `#/auth/update-password`, which works with the static `HashRouter` deployment.

## API-Football setup

The provider key must be stored only as the Supabase Edge Function secret `API_FOOTBALL_KEY`:

```bash
npx supabase secrets set API_FOOTBALL_KEY=YOUR_KEY
```

Also configure a different long random scheduler secret and the soft quota:

```bash
npx supabase secrets set SYNC_CRON_SECRET=YOUR_LONG_RANDOM_VALUE
npx supabase secrets set API_DAILY_STOP_AT=90
```

The adapter uses the official v3 base URL and `x-apisports-key` header, enforces a 15-second timeout, retries temporary failures, logs sanitized request fingerprints and quota, and stops before the default 90-request soft limit.

Never commit, log, screenshot, or send the real key to the browser. Rotate any credential that has been publicly exposed.

See [API-Football integration](docs/api-football.md) for endpoints, normalized fields, raw payload auditing, retries, coverage flags, quota behavior, function deployment, and secret-safe examples.

## Nightly schedule

Deploy `nightly-sync`, store the same random `SYNC_CRON_SECRET` in the Edge Function environment and Supabase Vault, then configure Supabase Cron to POST to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/nightly-sync
```

Send the secret through `x-cron-secret`. The suggested schedule is `30 3 * * *`. Supabase Cron normally evaluates this in UTC, so it tracks 03:30 London during GMT and 04:30 during BST; adjust for daylight saving or add a timezone-aware hourly due-time guard if exact local time matters.

The import rechecks today and the previous three local dates, ignores unfinished/postponed/abandoned fixtures, archives raw payloads, compares fingerprints, imports supported detail, tracks quota, and notifies admins of warnings. It is idempotent by season and local date.

Current limitation: the live import stops after normalized data is ready. The tested scoring, standings, lineup-aggregation, and valuation engines are present, but production post-import workers still need to persist those calculations before imported fixtures automatically update real standings, lineups, and prices.

## Manual sync

The Administration **Sync now** control sends a fresh idempotency key to the deployed `manual-sync` Edge Function whenever the client has Supabase configuration and a selected league. The Edge Function expects:

```json
{
  "leagueId": "LEAGUE_UUID",
  "idempotencyKey": "OPERATION_UUID"
}
```

The function independently verifies the signed-in user's session and active league-admin membership, finds the active season, and returns HTTP 202 for a new run or 200 for an idempotent replay. If the client has no configured/selected league, the UI only shows a local preview and does not call the provider. The dashboard does not yet render persisted synchronisation runs, API logs, warnings, or administrator notifications from Supabase.

## Scoring and values

The scoring engine is versioned, position-aware, decimal, capped, and missing-data conscious. It stores available/missing metrics and structured point explanations rather than relying on a provider rating. Competition allocation follows the fixture's provider competition.

The valuation engine uses 45% season performance, 35% weighted recent form, 15% playing-time reliability, and 5% availability. It blends small samples toward neutral, moves 25% toward target per run, and caps normal daily movement at ±5%. Demand is disabled.

- [Scoring rules and explanation format](docs/scoring.md)
- [Valuation formula and sample protection](docs/valuation.md)

## Quality checks

Run the full local gate:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Useful individual commands:

| Command              | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | local Vite development server                         |
| `npm run format`     | format supported files                                |
| `npm run lint`       | ESLint with zero warnings allowed                     |
| `npm run typecheck`  | strict TypeScript project build without pretty output |
| `npm test`           | one-shot Vitest domain suite                          |
| `npm run test:watch` | interactive unit-test mode                            |
| `npm run build`      | TypeScript check and production Vite/PWA build        |
| `npm run preview`    | serve the production bundle locally                   |
| `npm run test:e2e`   | Chromium account-entry journey                        |
| `npm run db:reset`   | recreate, migrate, and seed local Supabase            |

CI runs lint, typecheck, unit tests, a non-root-path production build, and Playwright. Provider requests are not made in automated tests.

## GitHub Pages deployment

1. Push the repository to GitHub with `main` as the default branch.
2. Select **Settings → Pages → Source: GitHub Actions**.
3. Configure the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` used by the Pages build. For a fork, replace the public project values in `.github/workflows/pages.yml` or refactor that workflow to read your Actions configuration.
4. Push `main` or run **Deploy to GitHub Pages** from Actions.
5. Open `https://USERNAME.github.io/REPOSITORY_NAME/`.

`.github/workflows/pages.yml` derives the correct Vite base path, builds `dist`, and deploys only that public artifact. A repository named `USERNAME.github.io` uses `/`; normal project repositories use `/REPOSITORY_NAME/`.

See [Deployment and operations](docs/deployment.md) for Pages settings, redirects, PWA/offline checks, hosted Supabase commands, scheduling, rollback, and troubleshooting.

## Security notes

- Treat every browser request and identifier as untrusted.
- RLS is enabled on exposed application tables and league-scoped rows require active membership.
- Sensitive operations are database transactions, not sequences of client mutations.
- `(league_id, real_player_id)` has a partial unique index for active ownership.
- Financial amounts use integer minor units; ledger/history/audit records are append-only.
- Idempotency keys make market and sync retries safe.
- Locked-lineup guards execute in PostgreSQL.
- Scheduled sync uses a dedicated secret; manual sync also requires an authenticated admin.
- Edge Functions sanitize public errors and never log credential values.
- Service-role and provider credentials are forbidden from frontend and Pages environments.

## Known limitations of this first pass

- There is no anonymous browser demo. Account and club onboarding are connected to Supabase, while the main dashboard, market, squad, competition, and league screens still use temporary local UI state rather than authoritative PostgREST/Realtime queries.
- The production import persists normalized match data but does not yet run the scoring, standings, lineup aggregation, and valuation engines as post-import workers.
- **Sync now** invokes the protected Edge Function when the UI has a selected league, but the wider Administration settings, coverage, audit, and report views are not yet live Supabase data views.
- Manager-to-manager transfer storage and atomic acceptance support cash and player components, but the complete offer/counter user interface is not finished.
- The private knockout bracket is a labelled beta view.
- Offline support caches the shell; there is no offline queue for authoritative purchases, transfers, or lineup writes.
- Continuous live scoring and web push are intentionally absent. Data is designed for nightly updates.
- SVG PWA artwork is generic and original; some mobile-store packaging paths will require additional raster icon sizes and screenshots.

These boundaries are intentionally explicit so account access and imported data are not confused with fully connected gameplay.

## Data, images, and licensing

The browser catalogue contains real Premier League player and club names, but it bundles no real player photographs or copyrighted club badges. Fantasy-club badges and PWA artwork are generic and original. The local `supabase/seed.sql` dataset remains fictional and is for development/testing only.

Before a public or commercial release:

- review API-Football subscription terms, caching, attribution, redistribution, and retention rules;
- verify the licence and permitted reuse of the bundled Premier League catalogue before a public or commercial launch;
- confirm rights for competition, team, flag, or player imagery before displaying it;
- prefer text and original silhouettes when rights are uncertain;
- document lawful handling and deletion of user account data;
- retain provider payloads only as permitted by the data agreement;
- add an explicit project source-code license. None is declared by this repository yet, so do not assume permission for redistribution.

Third-party packages remain under their own licenses; inspect the lockfile dependency tree as part of release compliance.

## Future native packaging

The installable PWA is the initial mobile release. Later options include Capacitor for App Store/Play Store shells and native notifications/haptics, Android Trusted Web Activity, or a separate React Native client that reuses the domain contracts and Supabase backend.

No native wrapper may embed the provider or service-role secret. The backend security model remains unchanged.

## Documentation index

- [Architecture](docs/architecture.md)
- [Database and RLS](docs/database.md)
- [Scoring](docs/scoring.md)
- [Valuation](docs/valuation.md)
- [API-Football and nightly sync](docs/api-football.md)
- [Deployment and operations](docs/deployment.md)
