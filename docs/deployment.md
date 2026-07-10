# Deployment and operations

The frontend is a static Vite PWA deployed to GitHub Pages. Supabase is deployed separately for authentication, PostgreSQL, Edge Functions, secrets, and the nightly job.

## Prerequisites

- Node.js 20.19 or newer and npm.
- Git.
- A modern Chromium, Firefox, or Safari browser.
- Docker Desktop for local Supabase.
- Supabase CLI, used through `npx supabase` in these examples.
- A Supabase project for connected accounts and data.
- An API-Football account only when testing real imports; demo mode needs none.

## Local frontend

```bash
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell equivalent:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Leave the Supabase values blank to use the complete browser demo. The development URL is normally `http://localhost:5173/`.

If Windows PowerShell blocks the `npm.ps1` or `npx.ps1` shims, invoke the command wrappers explicitly (`npm.cmd` and `npx.cmd`) or use a terminal with an execution policy appropriate for local development.

To verify the production bundle locally:

```bash
npm run build
npm run preview
```

To simulate a project-site subdirectory:

```bash
VITE_BASE_PATH=/example-repository/ npm run build
npm run preview
```

PowerShell:

```powershell
$env:VITE_BASE_PATH='/example-repository/'
npm run build
npm run preview
```

Use a leading and trailing slash. `HashRouter` keeps application routes refresh-safe, while `VITE_BASE_PATH` controls asset, manifest, icon, and service-worker URLs.

## Local Supabase

Start Docker, then run:

```bash
npx supabase start
npm run db:reset
npx supabase status
```

Copy the URL and anonymous key reported by `supabase status` into `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=LOCAL_PUBLIC_ANON_KEY
VITE_BASE_PATH=/
VITE_DEMO_MODE=true
```

For local functions:

```bash
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
```

Use a development provider key only if you intend to spend quota. The browser and unit tests do not require it. Reset all local database data with `npm run db:reset`.

## Hosted Supabase

Create a project, then:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set API_FOOTBALL_KEY=YOUR_KEY
npx supabase secrets set SYNC_CRON_SECRET=YOUR_LONG_RANDOM_VALUE
npx supabase secrets set API_DAILY_STOP_AT=90
npx supabase secrets set ALLOWED_ORIGIN=https://USERNAME.github.io
npx supabase functions deploy nightly-sync
npx supabase functions deploy manual-sync
```

For a custom domain, use its origin for `ALLOWED_ORIGIN`. CORS is not an authorization boundary; the manual function still validates the user and admin role.

Do not apply `supabase/seed.sql` to a production project. Create real leagues through authenticated RPCs or maintain a separate staging project for seeded demonstrations.

## Frontend environment variables

| Variable                 | Exposure | Description                                         |
| ------------------------ | -------- | --------------------------------------------------- |
| `VITE_SUPABASE_URL`      | public   | Supabase project URL                                |
| `VITE_SUPABASE_ANON_KEY` | public   | publishable anonymous key protected by RLS          |
| `VITE_BASE_PATH`         | public   | `/REPOSITORY_NAME/` for a project site, `/` locally |
| `VITE_DEMO_MODE`         | public   | keeps the fictional demo path available             |

Only variables prefixed with `VITE_` are compiled into the browser. That is why service-role, provider, and cron secrets must never use this prefix.

## GitHub repository settings

1. Push the repository to GitHub with `main` as its default branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` if connected mode is required.
5. Under **Actions → Secrets**, add `VITE_SUPABASE_ANON_KEY` if connected mode is required. It is designed to be public, but using a secret avoids accidental workflow echo.
6. Do not add `API_FOOTBALL_KEY` or the Supabase service-role key to this repository.
7. Run **Deploy to GitHub Pages** manually or push to `main`.

The Pages workflow installs dependencies, derives `/REPOSITORY_NAME/` for a project site and `/` for a `USERNAME.github.io` user site, builds, uploads only `dist`, and deploys with GitHub's Pages OIDC permission.

The [GitHub custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) explains the deployment actions.

Expected project URL:

```text
https://USERNAME.github.io/REPOSITORY_NAME/
```

## Supabase authentication URLs

In **Supabase Dashboard → Authentication → URL Configuration** set:

- **Site URL**: `https://USERNAME.github.io/REPOSITORY_NAME/`
- **Redirect URLs**:
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`
  - `https://USERNAME.github.io/REPOSITORY_NAME/**`

The password reset code explicitly redirects to `https://…/REPOSITORY_NAME/#/auth/sign-in`; the wildcard must allow that deployed base. Supabase validates the requested redirect, while the browser uses the hash route after returning to the static page.

If using a preview or custom domain, add that exact HTTPS base as an allowed redirect. Avoid a broad wildcard covering domains you do not control.

## CI and tests

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The build job deliberately uses `/ci-project-path/` so root-only asset bugs fail before deployment. Playwright installs Chromium and exercises the browser-only journey at a mobile viewport. External provider calls are not made.

Run locally:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Use `PLAYWRIGHT_BASE_URL` to test an already-running deployment. The configured local web server is reused when available.

## PWA and offline verification

Installability requires HTTPS in production (localhost is exempt). After deployment:

1. open the Pages URL in a supported browser;
2. wait for the service worker to activate;
3. check the Application/Manifest panel for the repository-scoped start URL and icons;
4. install the app;
5. load core screens once, switch the browser offline, and relaunch;
6. verify the shell and explicit offline guidance render;
7. reconnect before attempting server mutations or expecting fresh scores.

The service worker caches the application shell, not an authoritative offline mutation queue. Demo actions remain browser-local; connected purchases and transfers should fail clearly while offline rather than replay unpredictably.

## Nightly schedule and manual operation

Follow [api-football.md](api-football.md) to set the provider and cron secrets, deploy both functions, create the approximately 03:30 schedule, invoke an authenticated manual sync, and understand the current import boundary.

Check Edge Function logs, `data_synchronisation_runs`, `api_request_logs`, administrator notifications, and the `club_financial_reconciliation` view. Never paste access tokens, provider keys, cron secrets, or service-role keys into support tickets or screenshots.

## Rollback

GitHub Pages deployments are immutable artifacts. Revert the breaking commit and push `main`, or build a known-good commit. Database rollback is different: correct an applied migration with a forward migration, not by deleting history or resetting production.

Keep Supabase point-in-time recovery/backups appropriate to the league's importance before destructive maintenance.

## Native packaging

The PWA is the supported first release. Future packaging can use Capacitor for store shells and native notifications/haptics, Trusted Web Activity for a narrow Android wrapper, or a React Native client reusing provider-independent TypeScript domain modules and the same Supabase backend.

Native wrappers do not relax the security boundary: public client credentials remain public, RLS remains mandatory, and provider/service-role keys remain server-only.
