-- Real-life competition catalogue for every private season.
-- Each enabled competition has its own rounds, lineups, player points and totals.

insert into public.real_competitions (
  provider, provider_external_id, name, country_name, format, coverage, raw_payload
) values
  ('api-football', '39', 'Premier League', 'England', 'domestic_league',
   '{"fixtures":true,"lineups":true,"playerStatistics":true,"events":true,"injuries":true}'::jsonb,
   '{"canonical":true}'::jsonb),
  ('api-football', '45', 'The FA Cup', 'England', 'domestic_cup',
   '{"fixtures":true,"lineups":true,"playerStatistics":true,"events":true,"injuries":true}'::jsonb,
   '{"canonical":true}'::jsonb),
  ('api-football', '48', 'EFL Cup', 'England', 'domestic_cup',
   '{"fixtures":true,"lineups":true,"playerStatistics":true,"events":true,"injuries":true}'::jsonb,
   '{"canonical":true}'::jsonb),
  ('api-football', '2', 'UEFA Champions League', null, 'continental_league',
   '{"fixtures":true,"lineups":true,"playerStatistics":true,"events":true,"injuries":true}'::jsonb,
   '{"canonical":true}'::jsonb),
  ('api-football', '3', 'UEFA Europa League', null, 'continental_league',
   '{"fixtures":true,"lineups":true,"playerStatistics":true,"events":true,"injuries":true}'::jsonb,
   '{"canonical":true}'::jsonb),
  ('api-football', '848', 'UEFA Conference League', null, 'continental_league',
   '{"fixtures":true,"lineups":true,"playerStatistics":true,"events":true,"injuries":true}'::jsonb,
   '{"canonical":true}'::jsonb)
on conflict (provider, provider_external_id) do update
  set name = excluded.name,
      country_name = excluded.country_name,
      format = excluded.format,
      coverage = excluded.coverage,
      raw_payload = excluded.raw_payload,
      updated_at = now();

create or replace function public.enable_real_competitions_for_season(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  provider_year text;
begin
  select extract(year from starts_on)::integer::text into provider_year
  from public.seasons where id = p_season_id;
  if provider_year is null then
    raise exception using errcode = '22023', message = 'Season does not exist.';
  end if;

  insert into public.enabled_competitions (
    season_id, real_competition_id, provider_season_id, coverage_snapshot, private_knockout_enabled
  )
  select
    p_season_id, competition.id, provider_year, competition.coverage,
    competition.format = 'domestic_cup'::public.competition_format
  from public.real_competitions competition
  where competition.provider = 'api-football'
    and competition.provider_external_id in ('39', '45', '48', '2', '3', '848')
  on conflict (season_id, real_competition_id, provider_season_id) do nothing;
end;
$$;

create or replace function public.enable_real_competitions_after_season_create()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.enable_real_competitions_for_season(new.id);
  return new;
end;
$$;

drop trigger if exists seasons_enable_real_competitions on public.seasons;
create trigger seasons_enable_real_competitions
after insert on public.seasons
for each row execute function public.enable_real_competitions_after_season_create();

-- Add the real competitions to active seasons that already existed before this migration.
select public.enable_real_competitions_for_season(id)
from public.seasons
where status = 'active';

-- A league table can only aggregate domestic-league points. Cup and European totals remain
-- isolated in competition_totals and can never be written into league_standings.
create or replace function public.enforce_domestic_league_standing_points()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  expected_points numeric(14,2);
begin
  select coalesce(sum(total.points), 0)::numeric(14,2)
    into expected_points
  from public.competition_totals total
  join public.enabled_competitions enabled on enabled.id = total.enabled_competition_id
  join public.real_competitions competition on competition.id = enabled.real_competition_id
  where enabled.season_id = new.season_id
    and total.fantasy_club_id = new.fantasy_club_id
    and competition.format = 'domestic_league'::public.competition_format;

  if new.total_points <> expected_points then
    raise exception using errcode = '23514',
      message = 'League standings may only include Premier League points; cup and European points are kept separate.';
  end if;
  return new;
end;
$$;

drop trigger if exists league_standings_domestic_points_guard on public.league_standings;
create trigger league_standings_domestic_points_guard
before insert or update of season_id, fantasy_club_id, total_points on public.league_standings
for each row execute function public.enforce_domestic_league_standing_points();

-- A player can be placed in a competition lineup only when the provider has registered that player
-- for the same real competition and season. This prevents a player from earning FA Cup or UEFA
-- points when their real club is not participating.
create or replace function public.require_player_competition_registration()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  registered boolean;
begin
  select exists (
    select 1
    from public.fantasy_lineups lineup
    join public.competition_rounds round on round.id = lineup.competition_round_id
    join public.enabled_competitions enabled on enabled.id = round.enabled_competition_id
    join public.player_team_season_registrations registration
      on registration.real_player_id = new.real_player_id
     and registration.real_competition_id = enabled.real_competition_id
     and registration.provider_season_id = enabled.provider_season_id
     and (registration.valid_from is null or registration.valid_from <= current_date)
     and (registration.valid_until is null or registration.valid_until >= current_date)
    where lineup.id = new.fantasy_lineup_id
  ) into registered;

  if not registered then
    raise exception using errcode = '23514',
      message = 'This player is not registered for the real competition in this season.';
  end if;
  return new;
end;
$$;

drop trigger if exists fantasy_lineup_players_competition_registration_guard on public.fantasy_lineup_players;
create trigger fantasy_lineup_players_competition_registration_guard
before insert or update of fantasy_lineup_id, real_player_id on public.fantasy_lineup_players
for each row execute function public.require_player_competition_registration();
