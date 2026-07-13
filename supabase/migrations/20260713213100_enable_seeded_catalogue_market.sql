-- Give every active league a server-side value the first time a permanently bundled player is bought.
-- Ownership is still enforced by purchase_free_agent's unique active-ownership constraint.
create or replace function public.purchase_catalogue_player(
  p_fantasy_club_id uuid,
  p_catalogue_player_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  mapped_player_id uuid;
  catalogue_value bigint;
  catalogue_previous_value bigint;
  club_league_id uuid;
  active_season_id uuid;
begin
  select real_player_id, current_value_minor, previous_value_minor
    into mapped_player_id, catalogue_value, catalogue_previous_value
  from public.player_catalogue_profiles
  where catalogue_player_id = trim(p_catalogue_player_id)
    and match_status = 'matched';

  if mapped_player_id is null or catalogue_value is null then
    raise exception using errcode = 'P0001',
      message = 'MM_CATALOGUE_PENDING: This player is not available in the market catalogue.';
  end if;
  if not public.owns_fantasy_club(p_fantasy_club_id) then
    raise exception using errcode = '42501', message = 'You cannot buy players for this club.';
  end if;

  select league_id into club_league_id from public.fantasy_clubs where id = p_fantasy_club_id;
  select id into active_season_id from public.seasons
    where league_id = club_league_id and status = 'active';
  if active_season_id is null then
    raise exception using errcode = 'P0001', message = 'MM_SEASON_UNAVAILABLE: This league has no active season.';
  end if;

  insert into public.dynamic_player_values (
    season_id, real_player_id, current_value_minor, previous_value_minor, initial_value_minor,
    target_value_minor, explanation, formula_version, valued_at
  ) values (
    active_season_id, mapped_player_id, catalogue_value, coalesce(catalogue_previous_value, catalogue_value),
    catalogue_value, catalogue_value, '[{"source":"bundled_catalogue"}]'::jsonb, 'bundled-catalogue-v1', now()
  ) on conflict (season_id, real_player_id) do nothing;

  return public.purchase_free_agent(p_fantasy_club_id, mapped_player_id, p_idempotency_key);
end;
$$;
