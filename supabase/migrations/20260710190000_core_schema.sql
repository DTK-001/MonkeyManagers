-- Monkey Managers core relational model.
-- Monetary values are integer minor units (pence for GBP); never floating point.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.league_role as enum ('admin', 'manager');
create type public.membership_status as enum ('active', 'inactive', 'removed');
create type public.market_status as enum ('closed', 'initial_open', 'open', 'paused');
create type public.season_status as enum ('draft', 'active', 'completed', 'archived');
create type public.competition_format as enum ('domestic_league', 'domestic_cup', 'continental_league', 'continental_knockout', 'international');
create type public.round_status as enum ('scheduled', 'locked', 'scoring', 'completed');
create type public.fixture_status as enum ('scheduled', 'live', 'finished', 'postponed', 'abandoned', 'cancelled');
create type public.player_position as enum ('GK', 'DEF', 'MID', 'FWD');
create type public.ownership_status as enum ('active', 'released', 'transferred', 'corrected');
create type public.ledger_reason as enum ('initial_budget', 'free_agent_purchase', 'player_release', 'manager_transfer', 'transfer_refund', 'admin_adjustment', 'competition_prize');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired');
create type public.sync_status as enum ('queued', 'running', 'succeeded', 'partial', 'failed', 'skipped_quota');
create type public.notification_status as enum ('unread', 'read', 'archived');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  display_name extensions.citext not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name::text) between 2 and 40)
);

create table public.game_leagues (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null,
  slug extensions.citext not null unique,
  description text,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  demo_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_leagues_name_length check (char_length(name::text) between 3 and 80),
  constraint game_leagues_slug_format check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.league_memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.league_role not null default 'manager',
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (league_id, profile_id),
  constraint membership_removed_timestamp check ((status = 'removed') = (removed_at is not null))
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null,
  role public.league_role not null default 'manager',
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  created_at timestamptz not null default now(),
  constraint invitation_hint_safe check (char_length(code_hint) between 2 and 12)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  name extensions.citext not null,
  starts_on date not null,
  ends_on date not null,
  starting_budget_minor bigint not null default 10000000000 check (starting_budget_minor > 0),
  currency_code char(3) not null default 'GBP' check (currency_code ~ '^[A-Z]{3}$'),
  minimum_player_price_minor bigint not null default 50000000 check (minimum_player_price_minor >= 0),
  maximum_player_price_minor bigint not null default 2500000000 check (maximum_player_price_minor > minimum_player_price_minor),
  daily_maximum_price_movement numeric(6,5) not null default 0.05 check (daily_maximum_price_movement between 0 and 1),
  free_agent_release_percentage numeric(6,5) not null default 0.90 check (free_agent_release_percentage between 0 and 1),
  captain_multiplier numeric(5,2) not null default 1.50 check (captain_multiplier between 1 and 3),
  timezone text not null default 'Europe/London',
  nightly_sync_time time not null default '03:30:00',
  transfer_market_status public.market_status not null default 'closed',
  status public.season_status not null default 'draft',
  valuation_settings jsonb not null default '{"seasonWeight":0.45,"formWeight":0.35,"reliabilityWeight":0.15,"availabilityWeight":0.05,"demandWeight":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name),
  constraint season_date_order check (ends_on >= starts_on)
);

create unique index one_active_season_per_league on public.seasons (league_id) where status = 'active';

create table public.fantasy_clubs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  name extensions.citext not null,
  abbreviation extensions.citext not null,
  manager_display_name extensions.citext not null,
  stadium_name extensions.citext not null,
  primary_colour text not null,
  secondary_colour text not null,
  accent_colour text not null,
  badge_config jsonb not null default '{}'::jsonb,
  motto text,
  available_balance_minor bigint not null default 0 check (available_balance_minor >= 0),
  squad_book_value_minor bigint not null default 0 check (squad_book_value_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, owner_profile_id),
  unique (league_id, name),
  unique (league_id, abbreviation),
  constraint fantasy_club_abbreviation check (abbreviation::text ~ '^[A-Z]{3}$'),
  constraint fantasy_club_colour_primary check (primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  constraint fantasy_club_colour_secondary check (secondary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  constraint fantasy_club_colour_accent check (accent_colour ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.real_competitions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_external_id text not null,
  name text not null,
  country_name text,
  format public.competition_format not null,
  coverage jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_external_id)
);

create table public.real_teams (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_external_id text not null,
  name text not null,
  short_name text,
  country_name text,
  founded_year integer,
  venue_name text,
  raw_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_external_id)
);

create table public.real_players (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_external_id text not null,
  display_name text not null,
  first_name text,
  last_name text,
  birth_date date,
  nationality text,
  position public.player_position not null,
  availability_status text not null default 'available',
  raw_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_external_id)
);

create table public.enabled_competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  real_competition_id uuid not null references public.real_competitions(id) on delete restrict,
  provider_season_id text not null,
  enabled boolean not null default true,
  coverage_snapshot jsonb not null default '{}'::jsonb,
  private_knockout_enabled boolean not null default false,
  private_knockout_start_round text,
  tie_break_rules jsonb not null default '["captain_points","shots_on_target"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, real_competition_id, provider_season_id)
);

create table public.player_team_season_registrations (
  id uuid primary key default gen_random_uuid(),
  real_player_id uuid not null references public.real_players(id) on delete cascade,
  real_team_id uuid not null references public.real_teams(id) on delete restrict,
  real_competition_id uuid not null references public.real_competitions(id) on delete restrict,
  provider_season_id text not null,
  valid_from date,
  valid_until date,
  shirt_number integer check (shirt_number between 1 and 99),
  provider text not null,
  provider_external_id text,
  raw_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (real_player_id, real_team_id, real_competition_id, provider_season_id, valid_from)
);

create table public.competition_rounds (
  id uuid primary key default gen_random_uuid(),
  enabled_competition_id uuid not null references public.enabled_competitions(id) on delete cascade,
  provider_round_name text not null,
  display_name text not null,
  starts_at timestamptz,
  lock_deadline_at timestamptz not null,
  ends_at timestamptz,
  status public.round_status not null default 'scheduled',
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enabled_competition_id, provider_round_name),
  constraint competition_round_time_order check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.private_knockout_brackets (
  id uuid primary key default gen_random_uuid(),
  enabled_competition_id uuid not null references public.enabled_competitions(id) on delete cascade,
  name text not null,
  starts_at_provider_round text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  seeding_method text not null default 'random' check (seeding_method in ('random', 'league_rank', 'manual')),
  tie_break_rules jsonb not null default '["captain_points","shots_on_target"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enabled_competition_id, name)
);

create table public.private_knockout_ties (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.private_knockout_brackets(id) on delete cascade,
  competition_round_id uuid not null references public.competition_rounds(id) on delete restrict,
  bracket_round_number integer not null check (bracket_round_number > 0),
  slot_number integer not null check (slot_number > 0),
  home_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  away_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  home_points numeric(14,2),
  away_points numeric(14,2),
  winner_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  won_by_tiebreak text,
  is_bye boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'scoring', 'completed')),
  next_tie_id uuid references public.private_knockout_ties(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bracket_id, bracket_round_number, slot_number),
  constraint knockout_tie_distinct_clubs check (home_club_id is null or away_club_id is null or home_club_id <> away_club_id),
  constraint knockout_bye_shape check (not is_bye or ((home_club_id is null) <> (away_club_id is null))),
  constraint knockout_winner_participated check (winner_club_id is null or winner_club_id in (home_club_id, away_club_id)),
  constraint knockout_completed_result check (status <> 'completed' or winner_club_id is not null)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_external_id text not null,
  real_competition_id uuid not null references public.real_competitions(id) on delete restrict,
  provider_season_id text not null,
  provider_round_name text not null,
  home_team_id uuid not null references public.real_teams(id) on delete restrict,
  away_team_id uuid not null references public.real_teams(id) on delete restrict,
  kickoff_at timestamptz not null,
  status public.fixture_status not null,
  elapsed_minutes integer check (elapsed_minutes is null or elapsed_minutes between 0 and 180),
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  venue_name text,
  provider_updated_at timestamptz,
  source_fingerprint text,
  raw_payload jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_external_id),
  constraint fixture_different_teams check (home_team_id <> away_team_id),
  constraint fixture_finished_has_score check (status <> 'finished' or (home_score is not null and away_score is not null))
);

create table public.fixture_lineups (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  real_team_id uuid not null references public.real_teams(id) on delete restrict,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  is_starting boolean not null,
  position public.player_position,
  formation_grid text,
  shirt_number integer check (shirt_number between 1 and 99),
  raw_payload jsonb,
  last_synced_at timestamptz not null default now(),
  unique (fixture_id, real_team_id, real_player_id)
);

create table public.fixture_events (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  provider text not null,
  provider_external_id text not null,
  elapsed_minute integer check (elapsed_minute is null or elapsed_minute between 0 and 180),
  extra_minute integer check (extra_minute is null or extra_minute between 0 and 30),
  real_team_id uuid references public.real_teams(id) on delete restrict,
  real_player_id uuid references public.real_players(id) on delete restrict,
  assist_player_id uuid references public.real_players(id) on delete restrict,
  event_type text not null,
  detail text,
  comments text,
  raw_payload jsonb not null,
  last_synced_at timestamptz not null default now(),
  unique (fixture_id, provider_external_id)
);

create table public.player_availability_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_external_id text not null,
  real_player_id uuid not null references public.real_players(id) on delete cascade,
  real_team_id uuid references public.real_teams(id) on delete set null,
  fixture_id uuid references public.fixtures(id) on delete set null,
  availability_status text not null,
  reason text,
  starts_on date,
  ends_on date,
  raw_payload jsonb not null,
  last_synced_at timestamptz not null default now(),
  unique (provider, provider_external_id),
  constraint player_availability_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.raw_provider_payloads (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  request_fingerprint text not null,
  entity_type text not null,
  provider_external_id text,
  payload_hash text not null,
  http_status integer not null check (http_status between 100 and 599),
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  sync_run_id uuid,
  unique (provider, request_fingerprint, payload_hash)
);

create table public.fixture_player_statistics (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  real_team_id uuid not null references public.real_teams(id) on delete restrict,
  position public.player_position not null,
  started boolean,
  minutes integer check (minutes is null or minutes between 0 and 180),
  rating numeric(4,2),
  goals integer,
  assists integer,
  penalties_won integer,
  penalties_missed integer,
  own_goals integer,
  shots integer,
  shots_on_target integer,
  key_passes integer,
  dribbles_attempted integer,
  dribbles_successful integer,
  dribbles_failed integer,
  fouls_drawn integer,
  passes_attempted integer,
  passes_completed integer,
  pass_completion_percentage numeric(5,2),
  long_passes_completed integer,
  tackles integer,
  interceptions integer,
  blocks integer,
  duels_won integer,
  aerial_duels_won integer,
  clearances integer,
  saves integer,
  penalty_saves integer,
  goals_conceded integer,
  clean_sheet boolean,
  claims integer,
  fouls_committed integer,
  yellow_cards integer,
  second_yellow_cards integer,
  red_cards integer,
  penalties_conceded integer,
  errors_leading_to_goal integer,
  touches integer,
  possession_lost integer,
  availability jsonb not null default '{}'::jsonb,
  observed_metrics text[] not null default '{}',
  source_payload_id uuid references public.raw_provider_payloads(id) on delete set null,
  source_fingerprint text not null,
  source_present boolean not null default true,
  raw_payload jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, real_player_id),
  constraint fixture_stats_nonnegative check (
    (minutes is null or minutes >= 0) and
    (goals is null or goals >= 0) and
    (assists is null or assists >= 0) and
    (shots is null or shots >= 0) and
    (shots_on_target is null or shots_on_target >= 0) and
    (passes_attempted is null or passes_attempted >= 0) and
    (passes_completed is null or passes_completed >= 0)
  )
);

create table public.scoring_rule_sets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  enabled_competition_id uuid references public.enabled_competitions(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  position_rules jsonb not null,
  common_rules jsonb not null,
  metric_caps jsonb not null default '{}'::jsonb,
  coverage_requirements jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, enabled_competition_id, version)
);

create table public.player_match_points (
  id uuid primary key default gen_random_uuid(),
  enabled_competition_id uuid not null references public.enabled_competitions(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  fixture_player_statistics_id uuid not null references public.fixture_player_statistics(id) on delete restrict,
  scoring_rule_set_id uuid not null references public.scoring_rule_sets(id) on delete restrict,
  points numeric(12,2) not null,
  data_complete boolean not null default true,
  calculation_fingerprint text not null,
  calculated_at timestamptz not null default now(),
  unique (enabled_competition_id, fixture_id, real_player_id, scoring_rule_set_id)
);

create table public.point_breakdowns (
  id uuid primary key default gen_random_uuid(),
  player_match_points_id uuid not null references public.player_match_points(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  metric text not null,
  label text not null,
  quantity numeric,
  unit_points numeric,
  points numeric(12,2) not null,
  rule_snapshot jsonb not null default '{}'::jsonb,
  source_available boolean not null default true,
  unique (player_match_points_id, sequence)
);

create table public.dynamic_player_values (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete cascade,
  current_value_minor bigint not null check (current_value_minor >= 0),
  previous_value_minor bigint not null check (previous_value_minor >= 0),
  initial_value_minor bigint not null check (initial_value_minor >= 0),
  target_value_minor bigint not null check (target_value_minor >= 0),
  change_amount_minor bigint generated always as (current_value_minor - previous_value_minor) stored,
  provisional boolean not null default true,
  administrator_override_minor bigint check (administrator_override_minor is null or administrator_override_minor >= 0),
  explanation jsonb not null default '[]'::jsonb,
  formula_version text not null,
  valued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, real_player_id)
);

create table public.player_value_history (
  id uuid primary key default gen_random_uuid(),
  dynamic_player_value_id uuid not null references public.dynamic_player_values(id) on delete cascade,
  value_minor bigint not null check (value_minor >= 0),
  target_value_minor bigint not null check (target_value_minor >= 0),
  explanation jsonb not null default '[]'::jsonb,
  formula_version text not null,
  valued_on date not null,
  created_at timestamptz not null default now(),
  unique (dynamic_player_value_id, valued_on)
);

create table public.player_ownerships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  fantasy_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  status public.ownership_status not null default 'active',
  acquisition_type text not null,
  acquisition_value_minor bigint not null check (acquisition_value_minor >= 0),
  book_value_minor bigint not null check (book_value_minor >= 0),
  acquired_at timestamptz not null default now(),
  ended_at timestamptz,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint ownership_active_timestamp check ((status = 'active' and ended_at is null) or (status <> 'active' and ended_at is not null))
);

-- This is the central invariant: at most one active owner per player in a private league.
create unique index player_one_active_owner_per_league
  on public.player_ownerships (league_id, real_player_id)
  where status = 'active' and ended_at is null;

create table public.ownership_history (
  id uuid primary key default gen_random_uuid(),
  ownership_id uuid not null references public.player_ownerships(id) on delete restrict,
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  from_fantasy_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  to_fantasy_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  event_type text not null,
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  operation_id uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  fantasy_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  amount_minor bigint not null check (amount_minor <> 0),
  currency_code char(3) not null default 'GBP' check (currency_code ~ '^[A-Z]{3}$'),
  reason public.ledger_reason not null,
  operation_id uuid not null,
  counterparty_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  real_player_id uuid references public.real_players(id) on delete restrict,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (fantasy_club_id, operation_id)
);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  operation_type text not null,
  idempotency_key uuid not null,
  requester_profile_id uuid references public.profiles(id) on delete set null,
  request_fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  unique (operation_type, idempotency_key)
);

create table public.transfer_offers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  from_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  to_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  cash_payer_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  cash_recipient_club_id uuid references public.fantasy_clubs(id) on delete restrict,
  cash_amount_minor bigint not null default 0 check (cash_amount_minor >= 0),
  status public.offer_status not null default 'pending',
  message text,
  parent_offer_id uuid references public.transfer_offers(id) on delete set null,
  idempotency_key uuid not null unique,
  expires_at timestamptz not null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint transfer_offer_distinct_clubs check (from_club_id <> to_club_id),
  constraint transfer_offer_cash_direction check (
    (cash_amount_minor = 0 and cash_payer_club_id is null and cash_recipient_club_id is null)
    or
    (cash_amount_minor > 0 and cash_payer_club_id is not null and cash_recipient_club_id is not null and cash_payer_club_id <> cash_recipient_club_id)
  )
);

create table public.transfer_offer_players (
  id uuid primary key default gen_random_uuid(),
  transfer_offer_id uuid not null references public.transfer_offers(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  from_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  to_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  expected_ownership_id uuid not null references public.player_ownerships(id) on delete restrict,
  unique (transfer_offer_id, real_player_id),
  constraint transfer_offer_player_distinct_clubs check (from_club_id <> to_club_id)
);

create table public.completed_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_offer_id uuid not null unique references public.transfer_offers(id) on delete restrict,
  league_id uuid not null references public.game_leagues(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  operation_id uuid not null unique,
  summary jsonb not null,
  completed_at timestamptz not null default now()
);

create table public.released_players (
  id uuid primary key default gen_random_uuid(),
  ownership_id uuid not null unique references public.player_ownerships(id) on delete restrict,
  league_id uuid not null references public.game_leagues(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  fantasy_club_id uuid not null references public.fantasy_clubs(id) on delete restrict,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  book_value_minor bigint not null check (book_value_minor >= 0),
  release_value_minor bigint not null check (release_value_minor >= 0),
  release_percentage numeric(6,5) not null check (release_percentage between 0 and 1),
  operation_id uuid not null unique,
  released_at timestamptz not null default now()
);

create table public.fantasy_lineups (
  id uuid primary key default gen_random_uuid(),
  fantasy_club_id uuid not null references public.fantasy_clubs(id) on delete cascade,
  competition_round_id uuid not null references public.competition_rounds(id) on delete cascade,
  formation text not null,
  submitted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fantasy_club_id, competition_round_id),
  constraint formation_format check (formation ~ '^[1-5]-[1-5]-[1-5](?:-[1-5])?$')
);

create table public.fantasy_lineup_players (
  id uuid primary key default gen_random_uuid(),
  fantasy_lineup_id uuid not null references public.fantasy_lineups(id) on delete cascade,
  real_player_id uuid not null references public.real_players(id) on delete restrict,
  is_starter boolean not null,
  bench_order integer check (bench_order is null or bench_order between 1 and 7),
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (fantasy_lineup_id, real_player_id),
  constraint lineup_player_bench check ((is_starter and bench_order is null) or (not is_starter and bench_order is not null)),
  constraint lineup_player_roles check (not (is_captain and is_vice_captain))
);

create unique index one_captain_per_lineup on public.fantasy_lineup_players (fantasy_lineup_id) where is_captain;
create unique index one_vice_captain_per_lineup on public.fantasy_lineup_players (fantasy_lineup_id) where is_vice_captain;
create unique index one_player_per_bench_slot on public.fantasy_lineup_players (fantasy_lineup_id, bench_order) where bench_order is not null;

create table public.competition_totals (
  id uuid primary key default gen_random_uuid(),
  enabled_competition_id uuid not null references public.enabled_competitions(id) on delete cascade,
  fantasy_club_id uuid not null references public.fantasy_clubs(id) on delete cascade,
  points numeric(14,2) not null default 0,
  rounds_won integer not null default 0 check (rounds_won >= 0),
  highest_round_score numeric(14,2) not null default 0,
  calculation_fingerprint text not null,
  updated_at timestamptz not null default now(),
  unique (enabled_competition_id, fantasy_club_id)
);

create table public.league_standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  fantasy_club_id uuid not null references public.fantasy_clubs(id) on delete cascade,
  rank integer not null check (rank > 0),
  total_points numeric(14,2) not null default 0,
  competition_wins integer not null default 0 check (competition_wins >= 0),
  highest_round_score numeric(14,2) not null default 0,
  recent_form numeric(14,2)[] not null default '{}',
  calculation_fingerprint text not null,
  updated_at timestamptz not null default now(),
  unique (season_id, fantasy_club_id),
  unique (season_id, rank)
);

create table public.activity_feed_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  fantasy_club_id uuid references public.fantasy_clubs(id) on delete set null,
  visibility_club_ids uuid[] not null default '{}',
  headline text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_read_timestamp check ((status = 'read' and read_at is not null) or status <> 'read')
);

create table public.data_synchronisation_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.game_leagues(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  idempotency_key text not null unique,
  trigger_type text not null check (trigger_type in ('scheduled', 'manual', 'retry')),
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  status public.sync_status not null default 'queued',
  relevant_dates date[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  fixtures_checked integer not null default 0,
  fixtures_imported integer not null default 0,
  player_statistics_imported integer not null default 0,
  points_calculated integer not null default 0,
  values_recalculated integer not null default 0,
  api_requests_used integer not null default 0,
  api_requests_remaining integer,
  report jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.raw_provider_payloads
  add constraint raw_provider_payload_sync_run_fk
  foreign key (sync_run_id) references public.data_synchronisation_runs(id) on delete set null;

create table public.api_request_logs (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid references public.data_synchronisation_runs(id) on delete cascade,
  provider text not null,
  endpoint text not null,
  request_fingerprint text not null,
  http_status integer check (http_status is null or http_status between 100 and 599),
  attempt integer not null default 1 check (attempt > 0),
  quota_used integer,
  quota_remaining integer,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  created_at timestamptz not null default now()
);

create table public.administrator_corrections (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.game_leagues(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  correction_type text not null,
  target_table text not null,
  target_id uuid not null,
  before_value jsonb,
  after_value jsonb not null,
  reason text not null,
  requested_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  approved_by_profile_id uuid references public.profiles(id) on delete restrict,
  applied_at timestamptz,
  operation_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.game_leagues(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index memberships_profile_active_idx on public.league_memberships (profile_id, league_id) where status = 'active';
create index clubs_league_idx on public.fantasy_clubs (league_id, name);
create index enabled_competitions_season_idx on public.enabled_competitions (season_id) where enabled;
create index player_registrations_team_season_idx on public.player_team_season_registrations (real_team_id, provider_season_id);
create index player_registrations_player_idx on public.player_team_season_registrations (real_player_id, provider_season_id);
create index fixtures_competition_kickoff_idx on public.fixtures (real_competition_id, provider_season_id, kickoff_at desc);
create index knockout_ties_round_idx on public.private_knockout_ties (competition_round_id, status);
create index fixtures_status_kickoff_idx on public.fixtures (status, kickoff_at);
create index fixture_events_fixture_minute_idx on public.fixture_events (fixture_id, elapsed_minute);
create index availability_player_date_idx on public.player_availability_records (real_player_id, starts_on desc);
create index fixture_stats_fixture_idx on public.fixture_player_statistics (fixture_id);
create index player_points_player_competition_idx on public.player_match_points (real_player_id, enabled_competition_id, calculated_at desc);
create index values_season_price_idx on public.dynamic_player_values (season_id, current_value_minor);
create index value_history_value_date_idx on public.player_value_history (dynamic_player_value_id, valued_on desc);
create index ownerships_club_active_idx on public.player_ownerships (fantasy_club_id, acquired_at) where status = 'active' and ended_at is null;
create index ownership_history_player_idx on public.ownership_history (league_id, real_player_id, occurred_at desc);
create index ledger_club_date_idx on public.financial_ledger_entries (fantasy_club_id, created_at desc);
create index offers_participants_status_idx on public.transfer_offers (from_club_id, to_club_id, status, created_at desc);
create index lineups_round_idx on public.fantasy_lineups (competition_round_id, fantasy_club_id);
create index activity_league_date_idx on public.activity_feed_entries (league_id, created_at desc);
create index notifications_recipient_status_idx on public.notifications (recipient_profile_id, status, created_at desc);
create index sync_runs_league_date_idx on public.data_synchronisation_runs (league_id, created_at desc);
create index api_logs_sync_idx on public.api_request_logs (sync_run_id, created_at);
create index audit_league_date_idx on public.audit_logs (league_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'game_leagues', 'seasons', 'fantasy_clubs', 'real_competitions',
    'real_teams', 'real_players', 'enabled_competitions', 'competition_rounds',
    'fixtures', 'private_knockout_brackets', 'private_knockout_ties',
    'fixture_player_statistics', 'dynamic_player_values', 'transfer_offers',
    'fantasy_lineups'
  ]
  loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;
