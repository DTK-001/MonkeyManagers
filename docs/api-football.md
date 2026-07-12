# API-Football integration

API-Football is accessed only from Supabase Edge Functions. The browser never sends a request to the provider and never receives `API_FOOTBALL_KEY`.

The implementation follows the provider's v3 documentation: `https://v3.football.api-sports.io` with the key in the `x-apisports-key` request header. Consult the [official API-Football v3 reference](https://www.api-football.com/documentation-v3) before changing endpoint mappings or coverage assumptions.

## Secret handling

The provider key is a Supabase server secret named exactly `API_FOOTBALL_KEY`. Set it interactively or from an ignored local file:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set API_FOOTBALL_KEY=YOUR_KEY
```

For multiple settings:

```bash
cp supabase/functions/.env.example supabase/functions/.env
npx supabase secrets set --env-file supabase/functions/.env
```

On PowerShell, use `Copy-Item supabase/functions/.env.example supabase/functions/.env`. Replace every placeholder only in the ignored `.env` file.

Server settings are:

| Variable                    | Purpose                                      | Default                |
| --------------------------- | -------------------------------------------- | ---------------------- |
| `API_FOOTBALL_KEY`          | API-Football server credential               | required for real sync |
| `SYNC_CRON_SECRET`          | authenticates the no-JWT nightly trigger     | required for schedule  |
| `API_DAILY_STOP_AT`         | soft request stop, maximum accepted value 99 | `90`                   |
| `ALLOWED_ORIGIN`            | Edge Function CORS origin                    | `*` when unset         |
| `SUPABASE_URL`              | project URL injected by Supabase             | automatic              |
| `SUPABASE_SERVICE_ROLE_KEY` | trusted database access injected by Supabase | automatic              |

Never:

- add the provider key to `.env.example` with a real value;
- prefix it with `VITE_`;
- create a GitHub Actions variable or Pages setting containing it;
- include it in frontend source, browser storage, screenshots, logs, or error responses;
- use a client-side proxy that lets a caller choose an arbitrary provider URL;
- commit `supabase/functions/.env` or `supabase/.env`.

If a key is pasted into a public place, build log, issue, or committed file, rotate it in the provider dashboard before using the application.

## Provider abstraction

`FootballDataProvider` defines provider-neutral methods for countries, competitions and coverage, teams, paginated players, date-ranged fixtures, fixture lineups, fixture events, fixture-level player statistics, and injuries/availability.

`ApiFootballProvider` implements that interface. Normalization lives in the sync layer, not React components, so a second provider can be added without changing the domain scoring engine.

| Game need                        | API-Football endpoint |
| -------------------------------- | --------------------- |
| Countries                        | `/countries`          |
| Leagues, cups, seasons, coverage | `/leagues`            |
| Teams                            | `/teams`              |
| Players                          | `/players`            |
| Fixtures                         | `/fixtures`           |
| Lineups                          | `/fixtures/lineups`   |
| Events                           | `/fixtures/events`    |
| Fixture player statistics        | `/fixtures/players`   |
| Injuries                         | `/injuries`           |

All requests are GET requests. Query parameters are built from controlled values, and logs contain endpoint names and SHA-256 request fingerprints rather than credentials.

## Request safety and quota

The provider adapter:

- times out a request after 15 seconds;
- retries temporary transport failures and HTTP 408, 425, 429, 500, 502, 503, and 504 responses;
- makes at most three attempts with bounded exponential backoff and jitter;
- honors a short `Retry-After` value when present;
- counts every attempt against the local budget;
- reads provider remaining-request headers when supplied;
- stops before the configured soft limit or when the provider reports zero remaining;
- writes sanitized request status, attempt, duration, quota, fingerprint, and error code to `api_request_logs`.

The default stop is 90 requests per UTC logging day, leaving a margin below a 100-request allowance. Confirm the actual allowance and reset rules for the subscribed provider plan; do not assume every API-Football account has the same quota.

## Nightly import

`nightly-sync` finds every active season and invokes the shared import pipeline. For each season it:

1. computes today's date in the configured league timezone;
2. includes today and the previous three local dates;
3. creates an idempotent run key such as `scheduled:SEASON_ID:LOCAL_DATE`;
4. loads enabled competitions and their saved provider coverage snapshot;
5. retrieves fixtures for each provider league/season/date range;
6. accepts completed statuses (`FT`, `AET`, and `PEN`) and skips scheduled, live, postponed, abandoned, or cancelled fixtures;
7. upserts normalized competition/team/fixture data using provider IDs;
8. stores immutable raw collection and entity payloads with request and payload hashes;
9. compares fixture source fingerprints and only refetches detail for new or corrected fixtures;
10. retrieves supported player statistics, lineups, and events according to coverage flags;
11. upserts normalized players, registrations, statistics, lineups, and events;
12. records counts, warnings, quota state, and administrator notifications.

Running the same idempotency key again returns the existing run. Provider/entity uniqueness and source fingerprints prevent duplicate fixtures and player-stat rows.

Current first-pass boundary: the deployed sync pipeline ends with normalized data marked `normalised_data_ready`. The scoring, competition-total, standings, lineup-aggregation, and valuation engines exist and are tested, but a production worker that consumes the imported fingerprint and persists those downstream calculations still needs to be wired into `runSeasonSync`. Do not interpret an import-only “success” as proof that production standings, lineup scores, or player values were recalculated.

## Deploying functions

After linking the project and setting secrets:

```bash
npx supabase functions deploy nightly-sync
npx supabase functions deploy manual-sync
npx supabase functions deploy profile-enrichment
```

`supabase/config.toml` disables platform JWT verification for `nightly-sync` because a scheduler has no user session; the function instead compares `SYNC_CRON_SECRET` in constant time. `manual-sync` keeps JWT verification enabled and additionally verifies an active `admin` membership for the requested league.

For local function development:

```bash
npx supabase start
npx supabase functions serve --env-file supabase/functions/.env
```

Do not use a production service-role key in the local environment. `supabase start` supplies local project credentials.

## Scheduling at approximately 03:30

Supabase Cron can invoke an Edge Function from the Dashboard, or via `pg_cron` and `pg_net`. The following pattern keeps the trigger secret in Vault rather than in the scheduled SQL text:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'project_url'
);

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_RANDOM_VALUE_AS_SYNC_CRON_SECRET',
  'sync_cron_secret'
);

select cron.schedule(
  'monkey-managers-nightly-sync',
  '30 3 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/nightly-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The same ready-to-run template is in `supabase/cron.example.sql`; it deliberately contains Vault lookups rather than credential values.

Store the same random value as the Edge Function secret:

```bash
npx supabase secrets set SYNC_CRON_SECRET=YOUR_LONG_RANDOM_VALUE
```

Supabase Cron schedules are evaluated in the database scheduler's timezone, normally UTC. `30 3 * * *` is 03:30 UTC: it is 03:30 in London during GMT and 04:30 during BST. If exact 03:30 Europe/London execution matters, change the schedule at daylight-saving transitions or add an hourly trigger with a timezone-aware due-time guard and idempotency. The current function is idempotent by local date but does not itself enforce a configured clock time.

Inspect or remove the job:

```sql
select * from cron.job where jobname = 'monkey-managers-nightly-sync';
select cron.unschedule('monkey-managers-nightly-sync');
```

The [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart) describes the current Dashboard and SQL options.

## Manual sync

The account-first Administration **Sync now** flow invokes `manual-sync` with the signed-in user's access token and a fresh UUID idempotency key when the client has Supabase configuration and a selected league:

```bash
curl --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/manual-sync' \
  --header 'Authorization: Bearer USER_ACCESS_TOKEN' \
  --header 'apikey: YOUR_PUBLIC_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"leagueId":"LEAGUE_UUID","idempotencyKey":"OPERATION_UUID"}'
```

Only an active league admin is accepted. The function finds that league's active season. A first accepted run returns HTTP 202; replaying the same idempotency key returns the existing report with HTTP 200. If the UI does not have a configured/selected league, it displays a local preview instead and makes no provider request.

The current Administration screen invokes the function but still needs live queries for `data_synchronisation_runs`, `api_request_logs`, warnings, and administrator notifications.

## Mapping and coverage rules

API-Football coverage differs by league, season, and endpoint. Save the `/leagues` coverage snapshot before enabling a competition. Warn when player statistics or lineups are missing, and gate detail calls using that snapshot.

Normalized fields are nullable. The current mapper covers common participation, shooting, goal, passing, tackle, duel, dribble, foul, card, penalty, and goalkeeper fields. It preserves every input as JSON for audit. Metrics not present in a payload remain null; they are not reconstructed from ratings or unrelated fields.

Add mapping changes with fixture samples and unit tests. Never log full authorization headers or use real provider payloads containing licensed imagery as public sample fixtures without confirming reuse rights.
