-- Connect the public FPL catalogue identifiers to real provider players and server-side values.
alter table public.player_catalogue_profiles
  add column real_player_id uuid references public.real_players(id) on delete set null,
  add column current_value_minor bigint check (current_value_minor >= 0),
  add column previous_value_minor bigint check (previous_value_minor >= 0);

create index player_catalogue_profiles_real_player_idx
  on public.player_catalogue_profiles (real_player_id)
  where real_player_id is not null;

create function public.purchase_catalogue_player(
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
begin
  select real_player_id into mapped_player_id
  from public.player_catalogue_profiles
  where catalogue_player_id = trim(p_catalogue_player_id);

  if mapped_player_id is null then
    raise exception using errcode = 'P0001',
      message = 'MM_CATALOGUE_PENDING: This player is not ready for the live market yet.';
  end if;

  return public.purchase_free_agent(p_fantasy_club_id, mapped_player_id, p_idempotency_key);
end;
$$;

create function public.release_catalogue_player(
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
begin
  select real_player_id into mapped_player_id
  from public.player_catalogue_profiles
  where catalogue_player_id = trim(p_catalogue_player_id);

  if mapped_player_id is null then
    raise exception using errcode = 'P0001',
      message = 'MM_CATALOGUE_PENDING: This player is not ready for the live market yet.';
  end if;

  return public.release_player(p_fantasy_club_id, mapped_player_id, p_idempotency_key);
end;
$$;

revoke all on function public.purchase_catalogue_player(uuid, text, uuid) from public, anon;
revoke all on function public.release_catalogue_player(uuid, text, uuid) from public, anon;
grant execute on function public.purchase_catalogue_player(uuid, text, uuid) to authenticated;
grant execute on function public.release_catalogue_player(uuid, text, uuid) to authenticated;
