-- New private leagues should allow managers to build their initial squads.
-- Existing active leagues created before this fix are opened once as well.
update public.seasons
set transfer_market_status = 'initial_open'
where status = 'active' and transfer_market_status = 'closed';

create or replace function public.create_private_league(
  p_name text,
  p_slug text,
  p_season_name text default '2026/27',
  p_starts_on date default current_date,
  p_ends_on date default current_date + 365,
  p_starting_budget_minor bigint default 10000000000
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  league_record public.game_leagues;
  season_record public.seasons;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Sign in before creating a league.';
  end if;
  if char_length(trim(p_name)) not between 3 and 80 or lower(trim(p_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'League name or URL slug is invalid.';
  end if;
  if p_ends_on < p_starts_on or p_starting_budget_minor <= 0 then
    raise exception using errcode = '22023', message = 'Season dates or starting budget are invalid.';
  end if;

  insert into public.game_leagues (name, slug, created_by_profile_id)
  values (trim(p_name), lower(trim(p_slug)), actor_id)
  returning * into league_record;

  insert into public.league_memberships (league_id, profile_id, role)
  values (league_record.id, actor_id, 'admin');

  insert into public.seasons (
    league_id, name, starts_on, ends_on, starting_budget_minor, status, transfer_market_status
  ) values (
    league_record.id, trim(p_season_name), p_starts_on, p_ends_on, p_starting_budget_minor,
    'active', 'initial_open'
  )
  returning * into season_record;

  return jsonb_build_object('leagueId', league_record.id, 'seasonId', season_record.id, 'role', 'admin');
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'That league URL is already in use.';
end;
$$;
