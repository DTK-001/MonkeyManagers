# Architecture

Monkey Managers is split into a static, installable client and a trusted Supabase backend. The browser may render data and request an operation, but it is never the authority for ownership, money, league membership, locked lineups, scoring imports, or provider credentials.

```mermaid
flowchart LR
  subgraph Device["Manager's device"]
    PWA["React PWA\nHashRouter + Query cache"]
    DEMO["Browser-only demo store\nfictional seed data"]
    SW["Workbox service worker\napplication-shell cache"]
  end

  subgraph Pages["GitHub Pages"]
    STATIC["Versioned static assets\nrepository base path"]
  end

  subgraph Supabase["Supabase trust boundary"]
    AUTH["Email/password Auth"]
    API["PostgREST + Realtime\nRLS on exposed tables"]
    DB[("PostgreSQL\nconstraints + atomic RPCs")]
    MANUAL["manual-sync\nadmin JWT required"]
    NIGHTLY["nightly-sync\ncron secret required"]
    CRON["Supabase Cron\nnightly trigger"]
    SECRETS["Edge Function secrets\nAPI_FOOTBALL_KEY"]
  end

  PROVIDER["API-Football v3\nserver-to-server only"]

  STATIC --> PWA
  PWA <--> DEMO
  PWA <--> SW
  PWA --> AUTH
  PWA --> API
  API --> DB
  PWA --> MANUAL
  MANUAL --> DB
  CRON --> NIGHTLY
  NIGHTLY --> DB
  MANUAL --> PROVIDER
  NIGHTLY --> PROVIDER
  SECRETS --> MANUAL
  SECRETS --> NIGHTLY
```

## Runtime modes

### Demo mode

Demo mode is the default no-account path. `src/data/demo.ts` supplies fictional managers, clubs, teams, players, competitions, fixtures, scores, values, and activity. `src/app/demo-store.tsx` keeps changes in local storage. It is intentionally labelled as demo data and makes no API-Football request.

This mode is useful for design review, local smoke tests, GitHub Pages previews, and Playwright. It is not a security model and does not simulate concurrent database transactions.

### Connected mode

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present, the browser can create Supabase Auth sessions. The anonymous key is a public project identifier, not an administrative credential; row-level security remains the real access boundary. All sensitive mutations should go through the database functions or Edge Functions described in [database.md](database.md).

The service-role key and API-Football key must exist only inside Supabase-managed server environments. Neither belongs in a `VITE_*` variable, GitHub Pages artifact, client log, or network request initiated by the browser.

## Frontend structure

The app uses feature-oriented modules:

- `src/app`: composition, product constants, and the demo store.
- `src/components`: shared shell, badge, and accessible UI primitives.
- `src/features`: route-level authentication, onboarding, home, squad, market, competition, league, club, admin, and system screens.
- `src/domain`: provider-independent scoring, valuation, competition allocation, ranking, market, money, lineup, and synchronisation logic.
- `src/lib`: Supabase client construction and formatting helpers.
- `src/data`: fictional browser seed.
- `src/test`: unit tests for domain behaviour.

`HashRouter` keeps all application routes after `#`, so GitHub Pages only needs to serve the deployed `index.html`. Vite's `base` option prefixes JavaScript, CSS, icons, the manifest, and service-worker resources with the repository path.

TanStack Query is available for connected server state. React Hook Form and Zod validate interactive forms. The PWA plugin generates a manifest and Workbox service worker; the shell is cached and the app includes an explicit offline route.

## Backend boundaries

### PostgreSQL

PostgreSQL owns durable game invariants:

- a partial unique index permits at most one active owner for a real player in a private league;
- exact integer minor units are used for money;
- append-only triggers protect ledgers, ownership history, raw payloads, transfers, idempotency records, and audit logs;
- lock guards reject writes to locked lineups;
- league/season/club scope triggers prevent cross-league records;
- security-definer RPCs perform purchases, releases, transfers, league creation, joining, and club creation atomically;
- RLS limits league-specific rows to active members and administrative rows to league admins.

See [database.md](database.md) for the table map and operation details.

### Edge Functions

The provider adapter in `supabase/functions/_shared` exposes a provider-neutral football data interface. The API-Football implementation owns authentication, quota tracking, timeouts, retries, and request logging. Synchronisation functions are the only components permitted to call the external provider.

The scheduled entry point uses a separate cron secret because it has no end-user session. The manual entry point verifies the caller's JWT and administrator membership. Both use the service role only after their own authorization checks; service-role access bypasses RLS and must never be delegated to the client.

### Synchronisation flow

```mermaid
sequenceDiagram
  participant Trigger as Cron or league admin
  participant Fn as Sync Edge Function
  participant DB as PostgreSQL
  participant Provider as API-Football

  Trigger->>Fn: Start with authenticated trigger
  Fn->>DB: Create/reuse idempotent sync run
  Fn->>DB: Load season, competitions, timezone, quota
  loop Enabled competitions and relevant dates
    Fn->>Provider: Fetch fixtures and supported detail
    Provider-->>Fn: Normalized envelope + quota headers
    Fn->>DB: Upsert normalized rows and raw payloads
  end
  Fn->>DB: Complete import report and API request log
  Note over Fn,DB: Current boundary: normalized_data_ready
  Note over DB: Next worker stage persists points, totals, standings, and values
  Fn-->>Trigger: Sanitized status, never secrets
```

Fixtures retain the provider fixture ID as the external join point for lineups, events, and player statistics. Upserts and calculation fingerprints make a repeated run safe. The previous three days are rechecked so provider corrections replace prior normalized data rather than duplicating it.

The first-pass Edge Function currently completes at normalized imported data. Pure scoring, competition, ranking, and valuation engines are implemented and tested, and their target tables exist, but the production worker that runs those engines after an import is still to be connected. Seeded demo data exercises the full downstream experience in the meantime.

## Security model

The main trust assumptions are:

1. Browser input is untrusted, even after authentication.
2. League membership is checked in PostgreSQL for every exposed league-scoped row.
3. Administrative authorization is rechecked at the Edge Function or RPC boundary.
4. Public Supabase credentials may ship to the browser; service credentials and provider secrets may not.
5. Raw provider data is evidence, not automatically valid game data. Normalization must validate types and preserve missing values as null.
6. Operation IDs and calculation fingerprints make retries observable and idempotent.

The browser demo deliberately operates outside this trust model and is never mixed with production ledger or ownership data.

## Deployment topology

GitHub Pages hosts only static frontend files. Supabase owns authentication callbacks, database access, functions, secrets, and scheduled execution. This separation means a Pages deployment cannot leak the provider key unless someone explicitly puts it into frontend source, a `VITE_*` environment variable, or a public workflow log.

The CI workflow tests a non-root base path. The Pages workflow derives `/REPOSITORY_NAME/` for project sites and `/` for `USERNAME.github.io` user sites. Deployment details and authentication redirect settings are in [deployment.md](deployment.md).
