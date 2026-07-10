# Database

The Supabase schema is defined as ordered SQL migrations. Internal keys are UUIDs; imported entities keep `provider` and `provider_external_id` separately. Timestamps are stored with time zones, while money is stored as integer minor units (`bigint`).

## Applying the schema

For a disposable local database:

```bash
npx supabase start
npm run db:reset
```

`db:reset` recreates the local database, applies every file in `supabase/migrations` in timestamp order, and runs `supabase/seed.sql`. The seed is fictional and may safely be reset. Docker must be running.

For a linked hosted project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Review the migration diff and back up real data before applying later schema changes to a populated project. Do not run the demo seed against production.

## Migration order

1. `20260710190000_core_schema.sql` creates extensions, enums, tables, keys, unique constraints, and access-path indexes.
2. `20260710190100_security_integrity.sql` adds Auth profile creation, immutable-history guards, cached-finance reconciliation, lineup locks, audit triggers, helper RPCs, RLS, policies, and grants.
3. `20260710190200_atomic_market_operations.sql` adds transfer-scope guards and atomic purchase, release, and accepted-transfer RPCs with idempotency.

New migrations must be additive and timestamped. Never edit a migration that has already been applied to a shared environment; add a new migration instead.

## Schema map

### Identity and private leagues

- `profiles`: application profile linked one-to-one with `auth.users`.
- `game_leagues`: private league identity and default timezone.
- `league_memberships`: profile membership, role (`admin` or `manager`), and status.
- `invitations`: hashed/revocable/expiring invite codes, role, use count, and maximum uses.
- `seasons`: league season dates, budget, currency, valuation limits, release rate, sync time, market status, and lifecycle.
- `fantasy_clubs`: one manager's club identity, generated badge recipe, cached balance, and cached squad book value.

League and club names and abbreviations are constrained within their league. `create_private_league`, `create_league_invitation`, `join_private_league`, and `create_fantasy_club` centralize the multi-row onboarding operations.

### Provider catalog and match data

- `real_competitions`, `real_teams`, `real_players`: normalized provider catalog records with original IDs.
- `enabled_competitions`: a season's selected provider competition and coverage flags.
- `player_team_season_registrations`: player/team/competition/season assignments.
- `competition_rounds`: real round mapping, lock deadline, and round status.
- `fixtures`: provider fixture identity, competition, season, teams, kickoff, status, score, and sync fingerprint.
- `fixture_lineups`, `fixture_events`: provider details keyed by fixture.
- `player_availability_records`: nullable injury/availability information.
- `fixture_player_statistics`: nullable normalized statistics and a record of which metrics were observed.
- `raw_provider_payloads`: immutable original JSON for audit and future remapping.

Provider payloads are not flattened by guessing. A missing metric stays null. A fixture's provider ID is the external reference for its related events, lineups, and player-statistics endpoints.

### Scoring and competition results

- `scoring_rule_sets`: versioned, competition-aware rule documents and coverage requirements.
- `player_match_points`: one calculated performance for player, fixture, competition, and rule version.
- `point_breakdowns`: ordered, structured explanation entries.
- `fantasy_lineups`, `fantasy_lineup_players`: starters, bench order, captaincy, and round locks.
- `competition_totals`: cached per-club cumulative points for an enabled competition.
- `league_standings`: ranked season totals and deterministic tiebreak values.

The competition is inherited from the imported fixture, not selected from the player's domestic club. This prevents cup or European points from leaking into the domestic-league table.

### Values, ownership, and finance

- `dynamic_player_values`, `player_value_history`: current/previous/initial/target value, versioned explanation, provisional state, and time series.
- `player_ownerships`: active and historical ownership rows.
- `ownership_history`: immutable acquisition, release, and transfer events.
- `financial_ledger_entries`: immutable signed balance changes.
- `idempotency_records`: completed operation fingerprints and replayable responses.
- `transfer_offers`, `transfer_offer_players`: cash and player components plus expected ownership references.
- `completed_transfers`, `released_players`: immutable settlement records.

The current balance can be reproduced with:

```sql
select coalesce(sum(amount_minor), 0) as balance_minor
from public.financial_ledger_entries
where fantasy_club_id = 'CLUB_UUID';
```

`club_financial_reconciliation` compares that result with the cached club balance. The cache exists for fast reads; the ledger remains the source of truth.

### Operations and audit

- `activity_feed_entries`: league-visible game events without private offer contents.
- `notifications`: per-profile in-app notices.
- `data_synchronisation_runs`: idempotency key, status, relevant dates, counts, quota, and report.
- `api_request_logs`: endpoint fingerprints, status, attempts, timing, and quota observations.
- `administrator_corrections`: reasoned before/after corrections and approval details.
- `audit_logs`: append-only configuration-change evidence.

## Critical integrity guarantees

### One active owner

The central rule is enforced by a partial unique index, conceptually:

```sql
create unique index player_one_active_owner_per_league
on public.player_ownerships (league_id, real_player_id)
where status = 'active' and ended_at is null;
```

This is stronger than an availability query in the UI. Two concurrent purchases can both observe an available player, but only one transaction can insert the active ownership. The RPC maps the losing conflict to a friendly domain error.

### Exact and immutable finance

GBP values use pence, so £0.5m is `50000000`, not a floating-point `0.5`. A positive ledger amount credits a club; a negative amount debits it. Database checks prevent negative cached balances and invalid amounts.

Triggers reject update or delete operations on financial ledger entries, ownership history, completed transfers, released players, audit logs, idempotency records, and raw provider payloads. Corrections are new compensating records, never history rewrites.

### Scope and lineup locks

Ownership and transfer triggers verify that league, season, club, player, and expected ownership references agree. Lineup guards reject changes when the round deadline has passed, the round is no longer scheduled, or the lineup is already locked. A lineup player must also be actively owned by that fantasy club.

Partial unique indexes enforce one captain, one vice-captain, and one player per bench position. Domain validation additionally enforces 11 starters and a valid formation.

## Atomic RPCs

### `purchase_free_agent(club_id, player_id, idempotency_key)`

The function locks relevant club/season rows, checks membership and ownership, checks the market and exact current value, rejects insufficient funds, inserts the active ownership, adjusts cached finances, appends ledger and ownership history, adds activity, and stores an idempotent response in one transaction.

### `release_player(club_id, player_id, idempotency_key)`

The function locks and verifies active ownership, applies the season's release percentage to current book value, closes ownership, credits the exact refund, appends immutable release/history/ledger records, and stores a replayable result. The connected client must reconcile future unlocked lineups after release; historical locked selections remain evidence of the completed round.

### `accept_transfer_offer(offer_id, idempotency_key)`

The function locks the offer, participating clubs, and expected ownerships; verifies status, expiry, market state, funds, and owners; moves all player components; settles both ledger sides; writes history and the completed transfer; and marks the offer accepted atomically.

Every client-generated idempotency key must be a new UUID for a new intent and reused for retries of that same intent. Reusing a key with different inputs is rejected.

## Row-level security

All application tables exposed through Supabase have RLS enabled. Helper functions such as `current_profile_id`, `is_league_member`, `is_league_admin`, and `owns_fantasy_club` keep policies consistent.

- League members can read league-scoped gameplay rows for leagues they actively belong to.
- Club owners can edit only their unlocked lineups and allowed club/profile fields.
- League admins can edit league configuration, enabled competitions, rules, invitations, and corrections.
- Transfer offer details are limited to involved clubs and administrators.
- Global provider catalog and normalized fixture data require an authenticated user.
- Synchronisation logs and corrections are admin-only.
- Anonymous users cannot execute sensitive RPCs.
- The service role has broad access for trusted Edge Functions and therefore must never reach the browser.

RLS is defense in depth around RPC validation; it does not replace explicit authorization inside security-definer functions.

## Seed data

`supabase/seed.sql` creates a local fictional league with managers, clubs, generic real-world-style teams, more than 60 fictional players, registrations, competitions, completed/upcoming fixtures, normalized statistics, point breakdowns, player values/history, transfers, a ledger, lineups, standings, activity, notifications, and a sync report.

Reset it with:

```bash
npm run db:reset
```

`supabase/seed/reset_demo.sql` is a `psql` convenience entry point for the same canonical seed. The browser demo under `src/data` is separate from this database seed.
