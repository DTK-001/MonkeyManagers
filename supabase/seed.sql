-- Deterministic fictional development data. No real people, clubs, badges or provider records.
-- Reset and load with: supabase db reset

begin;

truncate table
  public.audit_logs,
  public.administrator_corrections,
  public.api_request_logs,
  public.data_synchronisation_runs,
  public.notifications,
  public.activity_feed_entries,
  public.league_standings,
  public.competition_totals,
  public.private_knockout_ties,
  public.private_knockout_brackets,
  public.fantasy_lineup_players,
  public.fantasy_lineups,
  public.released_players,
  public.completed_transfers,
  public.transfer_offer_players,
  public.transfer_offers,
  public.idempotency_records,
  public.financial_ledger_entries,
  public.ownership_history,
  public.player_ownerships,
  public.player_value_history,
  public.dynamic_player_values,
  public.point_breakdowns,
  public.player_match_points,
  public.scoring_rule_sets,
  public.fixture_player_statistics,
  public.raw_provider_payloads,
  public.player_availability_records,
  public.fixture_events,
  public.fixture_lineups,
  public.fixtures,
  public.competition_rounds,
  public.player_team_season_registrations,
  public.enabled_competitions,
  public.real_players,
  public.real_teams,
  public.real_competitions,
  public.fantasy_clubs,
  public.seasons,
  public.invitations,
  public.league_memberships,
  public.game_leagues,
  public.profiles
restart identity cascade;

insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-000000000101', 'Maya Sterling'),
  ('00000000-0000-0000-0000-000000000102', 'Theo Vale'),
  ('00000000-0000-0000-0000-000000000103', 'Nina Hart'),
  ('00000000-0000-0000-0000-000000000104', 'Owen Frost');

insert into public.game_leagues (id, name, slug, description, created_by_profile_id, demo_data) values (
  '10000000-0000-0000-0000-000000000001',
  'The Lantern League',
  'lantern-league-demo',
  'A fully fictional Monkey Managers development league.',
  '00000000-0000-0000-0000-000000000101',
  true
);

insert into public.league_memberships (league_id, profile_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'manager'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 'manager'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000104', 'manager');

insert into public.seasons (
  id, league_id, name, starts_on, ends_on, transfer_market_status, status
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '2026/27 Demo Season',
  current_date - 60,
  current_date + 300,
  'open',
  'active'
);

insert into public.fantasy_clubs (
  id, league_id, owner_profile_id, name, abbreviation, manager_display_name, stadium_name,
  primary_colour, secondary_colour, accent_colour, badge_config, motto
) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Northstar Athletic', 'NSA', 'Maya Sterling', 'Aurora Ground', '#13233B', '#F3E8CC', '#C5A45D', '{"shield":"pointed","symbol":"star","division":"diagonal"}', 'Find the light'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Copperfield Rovers', 'CFR', 'Theo Vale', 'Foundry Park', '#3A2022', '#F5E9D0', '#BD7B42', '{"shield":"round","symbol":"stripes","division":"vertical"}', 'Forged together'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 'Verdant City', 'VCT', 'Nina Hart', 'The Glasshouse', '#12392F', '#F2EDDC', '#D3B85B', '{"shield":"classic","symbol":"leaf","division":"chevron"}', 'Always growing'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000104', 'Kingsmere Albion', 'KMA', 'Owen Frost', 'Mere End', '#25213D', '#EEE5D0', '#9E8BC2', '{"shield":"square","symbol":"crown","division":"quarters"}', 'Hold the line');

insert into public.real_competitions (
  id, provider, provider_external_id, name, country_name, format, coverage, raw_payload, last_synced_at
) values
  ('40000000-0000-0000-0000-000000000001', 'demo', 'demo-league-1', 'Crown Premier Division', 'Beleron', 'domestic_league', '{"fixtures":true,"lineups":true,"playerStatistics":true,"injuries":false}', '{"fictional":true}', now()),
  ('40000000-0000-0000-0000-000000000002', 'demo', 'demo-cup-1', 'Founders Cup', 'Beleron', 'domestic_cup', '{"fixtures":true,"lineups":true,"playerStatistics":true,"injuries":false}', '{"fictional":true}', now()),
  ('40000000-0000-0000-0000-000000000003', 'demo', 'demo-europe-1', 'Continental Lantern Trophy', null, 'continental_league', '{"fixtures":true,"lineups":true,"playerStatistics":true,"injuries":true}', '{"fictional":true}', now());

insert into public.real_teams (
  id, provider, provider_external_id, name, short_name, country_name, venue_name, raw_payload, last_synced_at
) values
  ('50000000-0000-0000-0000-000000000001', 'demo', 'demo-team-1', 'Ashbourne Falcons', 'Falcons', 'Beleron', 'Ember Stadium', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000002', 'demo', 'demo-team-2', 'Brackenford United', 'Bracken', 'Beleron', 'Moss Bank', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000003', 'demo', 'demo-team-3', 'Calder Quay', 'Calder', 'Beleron', 'Docklight Arena', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000004', 'demo', 'demo-team-4', 'Dunmere Wanderers', 'Dunmere', 'Beleron', 'Mere Lane', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000005', 'demo', 'demo-team-5', 'Eversholt Vale', 'Eversholt', 'Beleron', 'Vale Park', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000006', 'demo', 'demo-team-6', 'Foxglove Borough', 'Foxes', 'Beleron', 'The Burrow', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000007', 'demo', 'demo-team-7', 'Greyhaven Mariners', 'Mariners', 'Beleron', 'Harbour Field', '{"fictional":true}', now()),
  ('50000000-0000-0000-0000-000000000008', 'demo', 'demo-team-8', 'High Tor Rangers', 'High Tor', 'Beleron', 'Summit Road', '{"fictional":true}', now());

with name_parts as (
  select
    array['Ari','Bram','Cleo','Dara','Eli','Faye','Gio','Hana','Ivo','Juno','Kian','Lena','Milo','Nora','Oren','Pia']::text[] as first_names,
    array['Alder','Blythe','Corren','Dale','Ember','Fenwick','Gale','Hollis','Irons','Jasper','Keene','Lark','Morrow','North','Orwell','Pryce']::text[] as last_names
)
insert into public.real_players (
  id, provider, provider_external_id, display_name, first_name, last_name, birth_date,
  nationality, position, raw_payload, last_synced_at
)
select
  ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'demo',
  'demo-player-' || lpad(n::text, 3, '0'),
  first_names[1 + ((n - 1) % 16)] || ' ' || last_names[1 + (((n - 1) / 4) % 16)],
  first_names[1 + ((n - 1) % 16)],
  last_names[1 + (((n - 1) / 4) % 16)],
  date '1992-01-01' + ((n * 137) % 4200),
  (array['Beleron','Norwyn','Asterra','Valedon','Corinthia'])[1 + ((n - 1) % 5)],
  case when n <= 8 then 'GK'::public.player_position
       when n <= 28 then 'DEF'::public.player_position
       when n <= 48 then 'MID'::public.player_position
       else 'FWD'::public.player_position end,
  jsonb_build_object('fictional', true, 'seedNumber', n),
  now()
from generate_series(1, 64) n
cross join name_parts;

insert into public.enabled_competitions (
  id, season_id, real_competition_id, provider_season_id, coverage_snapshot, private_knockout_enabled, private_knockout_start_round
) values
  ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2026', '{"fixtures":true,"lineups":true,"playerStatistics":true}', false, null),
  ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '2026', '{"fixtures":true,"lineups":true,"playerStatistics":true}', true, 'Round of 32'),
  ('a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '2026', '{"fixtures":true,"lineups":true,"playerStatistics":true,"injuries":true}', false, null);

insert into public.player_team_season_registrations (
  real_player_id, real_team_id, real_competition_id, provider_season_id, valid_from,
  provider, provider_external_id, raw_payload, last_synced_at
)
select
  p.id,
  ('50000000-0000-0000-0000-' || lpad((1 + ((n - 1) % 8))::text, 12, '0'))::uuid,
  c.id,
  '2026',
  current_date - 120,
  'demo',
  'demo-registration-' || n || '-' || right(c.provider_external_id, 1),
  '{"fictional":true}',
  now()
from public.real_players p
cross join lateral (select substring(p.provider_external_id from '[0-9]+$')::integer as n) parsed
cross join public.real_competitions c;

insert into public.competition_rounds (
  id, enabled_competition_id, provider_round_name, display_name, starts_at, lock_deadline_at, ends_at, status, locked_at, completed_at
) values
  ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Round 12', 'Matchweek 12', now() - interval '7 days', now() - interval '7 days', now() - interval '5 days', 'completed', now() - interval '7 days', now() - interval '5 days'),
  ('90000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Round 13', 'Matchweek 13', now() + interval '2 days', now() + interval '2 days', now() + interval '4 days', 'scheduled', null, null),
  ('90000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Round of 32', 'Round of 32', now() - interval '6 days', now() - interval '6 days', now() - interval '4 days', 'completed', now() - interval '6 days', now() - interval '4 days'),
  ('90000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Round of 16', 'Round of 16', now() + interval '5 days', now() + interval '5 days', now() + interval '6 days', 'scheduled', null, null),
  ('90000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'League Phase 1', 'League Phase 1', now() - interval '5 days', now() - interval '5 days', now() - interval '3 days', 'completed', now() - interval '5 days', now() - interval '3 days'),
  ('90000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'League Phase 2', 'League Phase 2', now() + interval '8 days', now() + interval '8 days', now() + interval '9 days', 'scheduled', null, null);

insert into public.fixtures (
  id, provider, provider_external_id, real_competition_id, provider_season_id,
  provider_round_name, home_team_id, away_team_id, kickoff_at, status,
  home_score, away_score, source_fingerprint, raw_payload
) values
  ('80000000-0000-0000-0000-000000000001', 'demo', 'demo-fixture-1', '40000000-0000-0000-0000-000000000001', '2026', 'Round 12', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', now() - interval '7 days', 'finished', 2, 1, 'fixture-demo-1-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000002', 'demo', 'demo-fixture-2', '40000000-0000-0000-0000-000000000001', '2026', 'Round 12', '50000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004', now() - interval '6 days', 'finished', 0, 0, 'fixture-demo-2-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000003', 'demo', 'demo-fixture-3', '40000000-0000-0000-0000-000000000002', '2026', 'Round of 32', '50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000006', now() - interval '6 days', 'finished', 3, 2, 'fixture-demo-3-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000004', 'demo', 'demo-fixture-4', '40000000-0000-0000-0000-000000000002', '2026', 'Round of 32', '50000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000008', now() - interval '5 days', 'finished', 1, 2, 'fixture-demo-4-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000005', 'demo', 'demo-fixture-5', '40000000-0000-0000-0000-000000000003', '2026', 'League Phase 1', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', now() - interval '5 days', 'finished', 1, 1, 'fixture-demo-5-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000006', 'demo', 'demo-fixture-6', '40000000-0000-0000-0000-000000000003', '2026', 'League Phase 1', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000006', now() - interval '4 days', 'finished', 2, 0, 'fixture-demo-6-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000007', 'demo', 'demo-fixture-7', '40000000-0000-0000-0000-000000000001', '2026', 'Round 13', '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', now() + interval '2 days', 'scheduled', null, null, 'fixture-demo-7-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000008', 'demo', 'demo-fixture-8', '40000000-0000-0000-0000-000000000001', '2026', 'Round 13', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004', now() + interval '3 days', 'scheduled', null, null, 'fixture-demo-8-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000009', 'demo', 'demo-fixture-9', '40000000-0000-0000-0000-000000000002', '2026', 'Round of 16', '50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000007', now() + interval '5 days', 'scheduled', null, null, 'fixture-demo-9-v1', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000010', 'demo', 'demo-fixture-10', '40000000-0000-0000-0000-000000000003', '2026', 'League Phase 2', '50000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000008', now() + interval '8 days', 'scheduled', null, null, 'fixture-demo-10-v1', '{"fictional":true}');

insert into public.fixture_lineups (
  fixture_id, real_team_id, real_player_id, is_starting, position, shirt_number, raw_payload
)
select
  f.id, r.real_team_id, r.real_player_id, true, p.position,
  1 + (substring(p.provider_external_id from '[0-9]+$')::integer % 90), '{"fictional":true}'
from public.fixtures f
join public.player_team_season_registrations r
  on r.real_competition_id = f.real_competition_id and r.provider_season_id = f.provider_season_id
  and r.real_team_id in (f.home_team_id, f.away_team_id)
join public.real_players p on p.id = r.real_player_id;

insert into public.fixture_events (
  fixture_id, provider, provider_external_id, elapsed_minute, real_team_id,
  real_player_id, event_type, detail, raw_payload
) values
  ('80000000-0000-0000-0000-000000000001', 'demo', 'demo-event-1', 18, '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Goal', 'Open play', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000001', 'demo', 'demo-event-2', 52, '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'Card', 'Yellow card', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000003', 'demo', 'demo-event-3', 37, '50000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000005', 'Goal', 'Header', '{"fictional":true}'),
  ('80000000-0000-0000-0000-000000000004', 'demo', 'demo-event-4', 71, '50000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000008', 'Goal', 'Open play', '{"fictional":true}');

insert into public.player_availability_records (
  provider, provider_external_id, real_player_id, real_team_id,
  availability_status, reason, starts_on, ends_on, raw_payload
) values
  ('demo', 'demo-availability-62', '60000000-0000-0000-0000-000000000062', '50000000-0000-0000-0000-000000000006', 'doubtful', 'Minor fictional ankle issue', current_date - 1, current_date + 4, '{"fictional":true}'),
  ('demo', 'demo-availability-63', '60000000-0000-0000-0000-000000000063', '50000000-0000-0000-0000-000000000007', 'unavailable', 'Fictional illness', current_date, current_date + 2, '{"fictional":true}');

insert into public.raw_provider_payloads (
  provider, endpoint, request_fingerprint, entity_type, payload_hash, http_status, payload
) values (
  'demo', '/fixtures', 'demo-fixtures-2026', 'fixture_collection', 'demo-fixtures-payload-v1', 200,
  '{"fictional":true,"notice":"Generated development payload; not from API-Football"}'
);

insert into public.fixture_player_statistics (
  fixture_id, real_player_id, real_team_id, position, started, minutes, rating,
  goals, assists, shots, shots_on_target, key_passes, dribbles_attempted,
  dribbles_successful, fouls_drawn, passes_attempted, passes_completed,
  pass_completion_percentage, tackles, interceptions, blocks, duels_won,
  aerial_duels_won, clearances, saves, goals_conceded, clean_sheet,
  fouls_committed, yellow_cards, red_cards, observed_metrics,
  source_fingerprint, raw_payload
)
select
  f.id,
  p.id,
  r.real_team_id,
  p.position,
  true,
  90,
  6.20 + ((player_number + fixture_number) % 17) * 0.10,
  case when (player_number + fixture_number) % 13 = 0 then 1 else 0 end,
  case when (player_number + fixture_number) % 11 = 0 then 1 else 0 end,
  1 + ((player_number + fixture_number) % 4),
  ((player_number + fixture_number) % 3),
  ((player_number + fixture_number) % 4),
  2 + ((player_number + fixture_number) % 5),
  1 + ((player_number + fixture_number) % 4),
  ((player_number + fixture_number) % 3),
  22 + ((player_number * 3 + fixture_number) % 39),
  18 + ((player_number * 3 + fixture_number) % 31),
  74 + ((player_number + fixture_number) % 22),
  case when p.position in ('DEF','MID') then 1 + ((player_number + fixture_number) % 5) else ((player_number + fixture_number) % 2) end,
  case when p.position in ('DEF','MID') then ((player_number + fixture_number) % 4) else 0 end,
  case when p.position in ('GK','DEF') then ((player_number + fixture_number) % 3) else 0 end,
  2 + ((player_number + fixture_number) % 7),
  case when p.position in ('DEF','FWD') then ((player_number + fixture_number) % 4) else 0 end,
  case when p.position = 'DEF' then 2 + ((player_number + fixture_number) % 6) else 0 end,
  case when p.position = 'GK' then 2 + ((player_number + fixture_number) % 5) else 0 end,
  case when p.position = 'GK' then ((player_number + fixture_number) % 3) else null end,
  case when p.position = 'GK' then ((player_number + fixture_number) % 3) = 0 else null end,
  ((player_number + fixture_number) % 3),
  case when (player_number + fixture_number) % 19 = 0 then 1 else 0 end,
  0,
  array['minutes','goals','assists','shots','shots_on_target','key_passes','passes_attempted','passes_completed','tackles','interceptions','cards'],
  md5(f.id::text || p.id::text || '-v1'),
  jsonb_build_object('fictional', true)
from public.fixtures f
cross join lateral (select substring(f.provider_external_id from '[0-9]+$')::integer fixture_number) fn
join public.player_team_season_registrations r
  on r.real_competition_id = f.real_competition_id and r.provider_season_id = f.provider_season_id
  and r.real_team_id in (f.home_team_id, f.away_team_id)
join public.real_players p on p.id = r.real_player_id
cross join lateral (select substring(p.provider_external_id from '[0-9]+$')::integer player_number) pn
where f.status = 'finished';

insert into public.scoring_rule_sets (
  id, season_id, enabled_competition_id, version, name, position_rules,
  common_rules, metric_caps, coverage_requirements, active
)
select
  ('b0000000-0000-0000-0000-' || lpad(row_number() over (order by ec.id)::text, 12, '0'))::uuid,
  ec.season_id,
  ec.id,
  1,
  'Demo transparent rules v1',
  '{"GK":{"goal":8,"cleanSheet":4,"save":0.5},"DEF":{"goal":6,"cleanSheet":4,"tackle":0.3},"MID":{"goal":5,"assist":3,"keyPass":0.5},"FWD":{"goal":4,"assist":3,"shotOnTarget":0.5}}',
  '{"appearance":1,"sixtyMinutes":1,"yellowCard":-1,"redCard":-3}',
  '{"tackles":6,"keyPasses":5,"saves":10}',
  '{"minutes":true,"goals":true,"assists":true}',
  true
from public.enabled_competitions ec;

insert into public.player_match_points (
  enabled_competition_id, fixture_id, real_player_id, fixture_player_statistics_id,
  scoring_rule_set_id, points, data_complete, calculation_fingerprint
)
select
  ec.id,
  s.fixture_id,
  s.real_player_id,
  s.id,
  rules.id,
  round((2 + coalesce(s.goals, 0) * case s.position when 'GK' then 8 when 'DEF' then 6 when 'MID' then 5 else 4 end
    + coalesce(s.assists, 0) * 3 + least(coalesce(s.tackles, 0), 6) * 0.30 - coalesce(s.yellow_cards, 0))::numeric, 2),
  true,
  md5(s.source_fingerprint || rules.id::text)
from public.fixture_player_statistics s
join public.fixtures f on f.id = s.fixture_id
join public.enabled_competitions ec
  on ec.real_competition_id = f.real_competition_id and ec.provider_season_id = f.provider_season_id
join public.scoring_rule_sets rules on rules.enabled_competition_id = ec.id and rules.active;

insert into public.point_breakdowns (
  player_match_points_id, sequence, metric, label, quantity, unit_points, points, rule_snapshot
)
select p.id, detail.sequence, detail.metric, detail.label, detail.quantity, detail.unit_points, detail.points, detail.rule_snapshot
from public.player_match_points p
cross join lateral (
  values
    (0, 'participation'::text, '90 minutes'::text, 90::numeric, 0.022222::numeric, 2.00::numeric, '{"threshold":60}'::jsonb),
    (1, 'other_actions'::text, 'Decisive and position actions'::text, null::numeric, null::numeric, (p.points - 2.00)::numeric, '{}'::jsonb)
) detail(sequence, metric, label, quantity, unit_points, points, rule_snapshot);

insert into public.dynamic_player_values (
  id, season_id, real_player_id, current_value_minor, previous_value_minor,
  initial_value_minor, target_value_minor, provisional, explanation, formula_version
)
select
  ('70000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '20000000-0000-0000-0000-000000000001',
  p.id,
  50000000 + n * 10000000,
  50000000 + n * 9800000,
  50000000 + n * 9000000,
  50000000 + n * 10500000,
  n > 56,
  jsonb_build_array(
    jsonb_build_object('factor', 'recentForm', 'amountMinor', n * 120000),
    jsonb_build_object('factor', 'reliability', 'amountMinor', n * 30000)
  ),
  'demo-v1'
from public.real_players p
cross join lateral (select substring(p.provider_external_id from '[0-9]+$')::integer n) parsed;

insert into public.player_value_history (
  dynamic_player_value_id, value_minor, target_value_minor, explanation, formula_version, valued_on
)
select
  v.id,
  greatest(50000000, v.current_value_minor - day_offset * 1800000),
  v.target_value_minor,
  jsonb_build_array(jsonb_build_object('factor', 'demoTrend', 'dayOffset', day_offset)),
  'demo-v1',
  current_date - day_offset
from public.dynamic_player_values v
cross join generate_series(0, 6) day_offset;

-- Sixty active players: fifteen per fantasy club, leaving four free agents.
insert into public.player_ownerships (
  id, league_id, season_id, real_player_id, fantasy_club_id, status,
  acquisition_type, acquisition_value_minor, book_value_minor, acquired_at, operation_id
)
select
  ('71000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  p.id,
  ('30000000-0000-0000-0000-' || lpad((1 + ((n - 1) % 4))::text, 12, '0'))::uuid,
  'active',
  'free_agent_purchase',
  v.current_value_minor,
  v.current_value_minor,
  now() - interval '40 days' + n * interval '2 hours',
  ('72000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from public.real_players p
join public.dynamic_player_values v on v.real_player_id = p.id
cross join lateral (select substring(p.provider_external_id from '[0-9]+$')::integer n) parsed
where n <= 60;

insert into public.ownership_history (
  ownership_id, league_id, season_id, real_player_id, to_fantasy_club_id,
  event_type, fee_minor, operation_id, occurred_at
)
select id, league_id, season_id, real_player_id, fantasy_club_id,
  'purchased_free_agent', acquisition_value_minor, operation_id, acquired_at
from public.player_ownerships where status = 'active';

insert into public.financial_ledger_entries (
  league_id, season_id, fantasy_club_id, amount_minor, reason, operation_id,
  description, created_by_profile_id, created_at
)
select
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  c.id,
  10000000000,
  'initial_budget',
  ('73000000-0000-0000-0000-' || lpad(row_number() over (order by c.id)::text, 12, '0'))::uuid,
  'Initial demo transfer budget',
  c.owner_profile_id,
  now() - interval '45 days'
from public.fantasy_clubs c;

insert into public.financial_ledger_entries (
  league_id, season_id, fantasy_club_id, amount_minor, reason, operation_id,
  real_player_id, description, created_at
)
select
  o.league_id, o.season_id, o.fantasy_club_id, -o.acquisition_value_minor,
  'free_agent_purchase', o.operation_id, o.real_player_id, 'Seeded free-agent purchase', o.acquired_at
from public.player_ownerships o where o.status = 'active';

-- A historical release keeps player 61 free while populating purchase/release history.
insert into public.player_ownerships (
  id, league_id, season_id, real_player_id, fantasy_club_id, status, acquisition_type,
  acquisition_value_minor, book_value_minor, acquired_at, ended_at, operation_id
)
select
  '71000000-0000-0000-0000-000000000061',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  p.id,
  '30000000-0000-0000-0000-000000000001',
  'released', 'free_agent_purchase', v.current_value_minor, v.current_value_minor,
  now() - interval '20 days', now() - interval '8 days',
  '72000000-0000-0000-0000-000000000061'
from public.real_players p join public.dynamic_player_values v on v.real_player_id = p.id
where p.provider_external_id = 'demo-player-061';

insert into public.ownership_history (
  ownership_id, league_id, season_id, real_player_id, to_fantasy_club_id,
  event_type, fee_minor, operation_id, occurred_at
)
select id, league_id, season_id, real_player_id, fantasy_club_id,
  'purchased_free_agent', acquisition_value_minor, operation_id, acquired_at
from public.player_ownerships where id = '71000000-0000-0000-0000-000000000061';

insert into public.ownership_history (
  ownership_id, league_id, season_id, real_player_id, from_fantasy_club_id,
  event_type, fee_minor, operation_id, occurred_at, metadata
)
select id, league_id, season_id, real_player_id, fantasy_club_id,
  'released', round(book_value_minor * 0.9)::bigint,
  '74000000-0000-0000-0000-000000000061', ended_at,
  '{"releasePercentage":0.9}'
from public.player_ownerships where id = '71000000-0000-0000-0000-000000000061';

insert into public.released_players (
  ownership_id, league_id, season_id, fantasy_club_id, real_player_id,
  book_value_minor, release_value_minor, release_percentage, operation_id, released_at
)
select id, league_id, season_id, fantasy_club_id, real_player_id, book_value_minor,
  round(book_value_minor * 0.9)::bigint, 0.9,
  '74000000-0000-0000-0000-000000000061', ended_at
from public.player_ownerships where id = '71000000-0000-0000-0000-000000000061';

insert into public.financial_ledger_entries (
  league_id, season_id, fantasy_club_id, amount_minor, reason, operation_id,
  real_player_id, description, created_at
)
select league_id, season_id, fantasy_club_id, -acquisition_value_minor,
  'free_agent_purchase', operation_id, real_player_id, 'Historical demo purchase', acquired_at
from public.player_ownerships where id = '71000000-0000-0000-0000-000000000061'
union all
select league_id, season_id, fantasy_club_id, round(book_value_minor * 0.9)::bigint,
  'player_release', '74000000-0000-0000-0000-000000000061', real_player_id,
  'Historical demo release', ended_at
from public.player_ownerships where id = '71000000-0000-0000-0000-000000000061';

insert into public.transfer_offers (
  id, league_id, season_id, from_club_id, to_club_id, cash_payer_club_id,
  cash_recipient_club_id, cash_amount_minor, status, message, idempotency_key,
  expires_at, created_by_profile_id
) values (
  'c0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  200000000,
  'pending',
  'A fictional player-plus-cash demo offer.',
  'c1000000-0000-0000-0000-000000000001',
  now() + interval '3 days',
  '00000000-0000-0000-0000-000000000102'
);

insert into public.transfer_offer_players (
  transfer_offer_id, real_player_id, from_club_id, to_club_id, expected_ownership_id
) values (
  'c0000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001'
);

insert into public.transfer_offers (
  id, league_id, season_id, from_club_id, to_club_id, cash_payer_club_id,
  cash_recipient_club_id, cash_amount_minor, status, message, idempotency_key,
  expires_at, created_by_profile_id, responded_at
) values (
  'c0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000004',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000004',
  100000000,
  'accepted',
  'A completed fictional cash-only transfer.',
  'c1000000-0000-0000-0000-000000000002',
  now() + interval '1 day',
  '00000000-0000-0000-0000-000000000103',
  now() - interval '2 days'
);

insert into public.completed_transfers (
  id, transfer_offer_id, league_id, season_id, operation_id, summary, completed_at
) values (
  'e0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  '{"status":"accepted","cashAmountMinor":100000000,"playersMoved":0}',
  now() - interval '2 days'
);

insert into public.financial_ledger_entries (
  league_id, season_id, fantasy_club_id, amount_minor, reason, operation_id,
  counterparty_club_id, description, created_at
) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', -100000000, 'manager_transfer', 'e1000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Completed demo cash transfer', now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 100000000, 'manager_transfer', 'e1000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Completed demo cash transfer', now() - interval '2 days');

-- Rebuild cached finances strictly from immutable history and active ownership.
select set_config('app.financial_operation', 'allowed', true);
update public.fantasy_clubs c
set
  available_balance_minor = (select coalesce(sum(l.amount_minor), 0)::bigint from public.financial_ledger_entries l where l.fantasy_club_id = c.id),
  squad_book_value_minor = (select coalesce(sum(o.book_value_minor), 0)::bigint from public.player_ownerships o where o.fantasy_club_id = c.id and o.status = 'active' and o.ended_at is null);

-- A locked 4-4-2 and four-player bench for each demo club.
select set_config('app.lineup_system_operation', 'allowed', true);
insert into public.fantasy_lineups (
  id, fantasy_club_id, competition_round_id, formation, submitted_at, locked_at
)
select
  ('d0000000-0000-0000-0000-' || lpad(row_number() over (order by c.id)::text, 12, '0'))::uuid,
  c.id,
  '90000000-0000-0000-0000-000000000001',
  '4-4-2',
  now() - interval '8 days',
  now() - interval '7 days'
from public.fantasy_clubs c;

with ranked as (
  select
    l.id lineup_id,
    o.real_player_id,
    p.position,
    row_number() over (partition by l.id, p.position order by p.provider_external_id) position_rank
  from public.fantasy_lineups l
  join public.player_ownerships o on o.fantasy_club_id = l.fantasy_club_id and o.status = 'active' and o.ended_at is null
  join public.real_players p on p.id = o.real_player_id
), marked as (
  select *,
    case position when 'GK' then position_rank <= 1
      when 'DEF' then position_rank <= 4
      when 'MID' then position_rank <= 4
      when 'FWD' then position_rank <= 2 end as starter
  from ranked
), ordered_bench as (
  select *, case when not starter then row_number() over (partition by lineup_id, starter order by position, position_rank) end as bench_rank
  from marked
)
insert into public.fantasy_lineup_players (
  fantasy_lineup_id, real_player_id, is_starter, bench_order, is_captain, is_vice_captain, locked_at
)
select
  lineup_id,
  real_player_id,
  starter,
  case when starter then null else bench_rank::integer end,
  starter and position = 'FWD' and position_rank = 1,
  starter and position = 'FWD' and position_rank = 2,
  now() - interval '7 days'
from ordered_bench
where starter or bench_rank <= 4;

insert into public.private_knockout_brackets (
  id, enabled_competition_id, name, starts_at_provider_round, status, seeding_method
) values (
  'ab000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'Founders Cup Private Bracket',
  'Round of 32',
  'active',
  'league_rank'
);

insert into public.private_knockout_ties (
  id, bracket_id, competition_round_id, bracket_round_number, slot_number,
  home_club_id, away_club_id, home_points, away_points, winner_club_id, status
) values
  ('ac000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 1, 1, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 51.25, 46.80, '30000000-0000-0000-0000-000000000001', 'completed'),
  ('ac000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 1, 2, '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 48.40, 49.10, '30000000-0000-0000-0000-000000000003', 'completed');

insert into public.competition_totals (
  enabled_competition_id, fantasy_club_id, points, rounds_won, highest_round_score, calculation_fingerprint
)
select
  ec.id,
  c.id,
  round((68 + ec_number * 7 + club_number * 3.75)::numeric, 2),
  case when club_number = ec_number then 1 else 0 end,
  round((42 + club_number * 2.2)::numeric, 2),
  md5(ec.id::text || c.id::text || '-demo-v1')
from public.enabled_competitions ec
cross join lateral (select right(ec.id::text, 12)::integer ec_number) er
cross join public.fantasy_clubs c
cross join lateral (select right(c.id::text, 12)::integer club_number) cr;

insert into public.league_standings (
  season_id, fantasy_club_id, rank, total_points, competition_wins,
  highest_round_score, recent_form, calculation_fingerprint
)
select
  '20000000-0000-0000-0000-000000000001',
  c.id,
  club_number,
  (array[312.40, 298.75, 286.10, 271.95])[club_number],
  (array[2, 1, 1, 0])[club_number],
  (array[55.80, 53.45, 49.90, 47.25])[club_number],
  array[36.2 + club_number, 40.1 + club_number, 44.4 + club_number]::numeric[],
  md5(c.id::text || '-standings-demo-v1')
from public.fantasy_clubs c
cross join lateral (select right(c.id::text, 12)::integer club_number) ranked;

insert into public.activity_feed_entries (
  league_id, season_id, event_type, fantasy_club_id, headline, payload, created_at
) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'transfer_accepted', '30000000-0000-0000-0000-000000000004', 'Kingsmere Albion completed a cash transfer', '{"fictional":true}', now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'round_completed', null, 'Crown Premier Division Matchweek 12 completed', '{"round":"Round 12"}', now() - interval '5 days'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'player_value_changed', '30000000-0000-0000-0000-000000000001', 'A squad value changed after the nightly update', '{"fictional":true}', now() - interval '1 day');

insert into public.notifications (
  league_id, recipient_profile_id, type, title, body, payload
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'sync_completed', 'Demo data updated', 'The fictional nightly synchronisation completed successfully.', '{"fictional":true}'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'transfer_offer', 'New transfer offer', 'Northstar Athletic has received your fictional offer.', '{"offerId":"c0000000-0000-0000-0000-000000000001"}');

insert into public.data_synchronisation_runs (
  id, league_id, season_id, idempotency_key, trigger_type, status, relevant_dates,
  started_at, completed_at, fixtures_checked, fixtures_imported,
  player_statistics_imported, points_calculated, values_recalculated,
  api_requests_used, api_requests_remaining, report
) values (
  'f0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'demo-sync-' || current_date,
  'scheduled',
  'succeeded',
  array[current_date - 3, current_date - 2, current_date - 1, current_date],
  now() - interval '1 day 2 minutes',
  now() - interval '1 day',
  10, 6, 96, 96, 64, 8, 92,
  '{"fictional":true,"message":"Generated locally without an external request"}'
);

insert into public.api_request_logs (
  sync_run_id, provider, endpoint, request_fingerprint, http_status,
  attempt, quota_used, quota_remaining, duration_ms
) values
  ('f0000000-0000-0000-0000-000000000001', 'demo', '/fixtures', 'demo-fixtures-2026', 200, 1, 4, 96, 14),
  ('f0000000-0000-0000-0000-000000000001', 'demo', '/fixtures/players', 'demo-stats-2026', 200, 1, 8, 92, 22);

insert into public.administrator_corrections (
  league_id, season_id, correction_type, target_table, target_id, before_value,
  after_value, reason, requested_by_profile_id, approved_by_profile_id,
  applied_at, operation_id
) values (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'demo_scoring_note',
  'player_match_points',
  (select id from public.player_match_points order by id limit 1),
  '{"points":7.00}',
  '{"points":7.25}',
  'Fictional example showing the audited correction workflow.',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000101',
  now() - interval '10 days',
  'f1000000-0000-0000-0000-000000000001'
);

commit;
