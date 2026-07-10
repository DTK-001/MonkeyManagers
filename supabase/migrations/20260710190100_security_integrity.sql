-- Authentication mapping, integrity triggers, row-level security and safe setup RPCs.

create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create function public.is_service_role()
returns boolean
language sql
stable
set search_path = public, auth, pg_temp
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

create function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.is_service_role() or exists (
    select 1
    from public.league_memberships m
    where m.league_id = p_league_id
      and m.profile_id = public.current_profile_id()
      and m.status = 'active'
  )
$$;

create function public.is_league_admin(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.is_service_role() or exists (
    select 1
    from public.league_memberships m
    where m.league_id = p_league_id
      and m.profile_id = public.current_profile_id()
      and m.status = 'active'
      and m.role = 'admin'
  )
$$;

create function public.owns_fantasy_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.is_service_role() or exists (
    select 1
    from public.fantasy_clubs c
    join public.league_memberships m
      on m.league_id = c.league_id and m.profile_id = c.owner_profile_id
    where c.id = p_club_id
      and c.owner_profile_id = public.current_profile_id()
      and m.status = 'active'
  )
$$;

create function public.shares_league_with_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.is_service_role() or p_profile_id = public.current_profile_id() or exists (
    select 1
    from public.league_memberships mine
    join public.league_memberships theirs on theirs.league_id = mine.league_id
    where mine.profile_id = public.current_profile_id()
      and mine.status = 'active'
      and theirs.profile_id = p_profile_id
      and theirs.status = 'active'
  )
$$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  requested_name := left(coalesce(requested_name, split_part(coalesce(new.email, 'manager'), '@', 1), 'Manager'), 40);
  if char_length(requested_name) < 2 then
    requested_name := requested_name || 'M';
  end if;
  insert into public.profiles (id, auth_user_id, display_name)
  values (
    new.id,
    new.id,
    requested_name
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.prevent_immutable_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%s is append-only', tg_table_name),
    hint = 'Create a correcting entry instead of changing history.';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'financial_ledger_entries', 'ownership_history', 'completed_transfers',
    'released_players', 'audit_logs', 'idempotency_records', 'raw_provider_payloads'
  ]
  loop
    execute format(
      'create trigger %I_immutable before update or delete on public.%I for each row execute function public.prevent_immutable_mutation()',
      table_name, table_name
    );
  end loop;
end;
$$;

create function public.guard_cached_finances()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.available_balance_minor, new.squad_book_value_minor)
       is distinct from
     (old.available_balance_minor, old.squad_book_value_minor)
     and coalesce(current_setting('app.financial_operation', true), '') <> 'allowed'
  then
    raise exception using
      errcode = '42501',
      message = 'Club finances can only be changed by an atomic financial operation.';
  end if;
  return new;
end;
$$;

create trigger fantasy_clubs_guard_cached_finances
before update on public.fantasy_clubs
for each row execute function public.guard_cached_finances();

create function public.guard_club_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.league_id <> old.league_id or new.owner_profile_id <> old.owner_profile_id then
    raise exception using errcode = '42501', message = 'A club cannot be moved to another league or manager.';
  end if;
  return new;
end;
$$;

create trigger fantasy_clubs_guard_identity
before update on public.fantasy_clubs
for each row execute function public.guard_club_identity();

create function public.guard_league_and_membership_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'game_leagues' then
    if new.created_by_profile_id <> old.created_by_profile_id then
      raise exception using errcode = '42501', message = 'The league creator cannot be changed.';
    end if;
    return new;
  end if;

  if tg_op <> 'DELETE' and (new.league_id <> old.league_id or new.profile_id <> old.profile_id) then
    raise exception using errcode = '42501', message = 'A membership cannot be moved to another league or profile.';
  end if;
  if old.role = 'admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.status <> 'active')
     and not exists (
       select 1 from public.league_memberships other
       where other.league_id = old.league_id
         and other.id <> old.id
         and other.role = 'admin' and other.status = 'active'
     ) then
    raise exception using errcode = '55000', message = 'A league must retain at least one active administrator.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger game_leagues_guard_creator
before update on public.game_leagues
for each row execute function public.guard_league_and_membership_identity();
create trigger league_memberships_guard_identity
before update or delete on public.league_memberships
for each row execute function public.guard_league_and_membership_identity();

create function public.validate_ownership_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  season_league uuid;
  club_league uuid;
begin
  select league_id into season_league from public.seasons where id = new.season_id;
  select league_id into club_league from public.fantasy_clubs where id = new.fantasy_club_id;
  if season_league is null or club_league is null or season_league <> new.league_id or club_league <> new.league_id then
    raise exception using errcode = '23514', message = 'Ownership league, season and club do not match.';
  end if;
  return new;
end;
$$;

create trigger player_ownerships_validate_scope
before insert or update on public.player_ownerships
for each row execute function public.validate_ownership_scope();

create function public.validate_ledger_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  season_record public.seasons;
  club_league uuid;
begin
  select * into season_record from public.seasons where id = new.season_id;
  select league_id into club_league from public.fantasy_clubs where id = new.fantasy_club_id;
  if season_record.id is null or club_league is null
     or season_record.league_id <> new.league_id or club_league <> new.league_id
     or season_record.currency_code <> new.currency_code then
    raise exception using errcode = '23514', message = 'Ledger league, season, club or currency do not match.';
  end if;
  if new.counterparty_club_id is not null and not exists (
    select 1 from public.fantasy_clubs c
    where c.id = new.counterparty_club_id and c.league_id = new.league_id
  ) then
    raise exception using errcode = '23514', message = 'Ledger counterparty does not belong to the same league.';
  end if;
  return new;
end;
$$;

create trigger financial_ledger_entries_validate_scope
before insert on public.financial_ledger_entries
for each row execute function public.validate_ledger_scope();

create function public.validate_knockout_tie_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  bracket_competition_id uuid;
  bracket_league_id uuid;
  round_competition_id uuid;
begin
  select b.enabled_competition_id, s.league_id
    into bracket_competition_id, bracket_league_id
  from public.private_knockout_brackets b
  join public.enabled_competitions ec on ec.id = b.enabled_competition_id
  join public.seasons s on s.id = ec.season_id
  where b.id = new.bracket_id;
  select enabled_competition_id into round_competition_id
    from public.competition_rounds where id = new.competition_round_id;
  if bracket_competition_id is null or round_competition_id <> bracket_competition_id then
    raise exception using errcode = '23514', message = 'Knockout tie and real competition round do not match.';
  end if;
  if exists (
    select 1 from unnest(array[new.home_club_id, new.away_club_id, new.winner_club_id]) club_id
    join public.fantasy_clubs c on c.id = club_id
    where club_id is not null and c.league_id <> bracket_league_id
  ) or exists (
    select 1 from unnest(array[new.home_club_id, new.away_club_id, new.winner_club_id]) club_id
    where club_id is not null and not exists (select 1 from public.fantasy_clubs c where c.id = club_id)
  ) then
    raise exception using errcode = '23514', message = 'A knockout club does not belong to the bracket league.';
  end if;
  return new;
end;
$$;

create trigger private_knockout_ties_validate_scope
before insert or update on public.private_knockout_ties
for each row execute function public.validate_knockout_tie_scope();

create function public.guard_lineup_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lineup_record record;
  round_record record;
  player_id uuid;
begin
  if coalesce(current_setting('app.lineup_system_operation', true), '') = 'allowed' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'fantasy_lineups' then
    if tg_op = 'UPDATE' and (
      new.fantasy_club_id <> old.fantasy_club_id
      or new.competition_round_id <> old.competition_round_id
    ) then
      raise exception using errcode = '42501', message = 'A lineup cannot be moved to another club or round.';
    end if;
    select * into lineup_record from public.fantasy_lineups where id = coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      lineup_record := new;
    end if;
    player_id := null;
  else
    select * into lineup_record
      from public.fantasy_lineups
      where id = coalesce(new.fantasy_lineup_id, old.fantasy_lineup_id);
    player_id := coalesce(new.real_player_id, old.real_player_id);
  end if;

  select * into round_record from public.competition_rounds where id = lineup_record.competition_round_id;
  if lineup_record.locked_at is not null or round_record.status <> 'scheduled' or now() >= round_record.lock_deadline_at then
    raise exception using errcode = '55000', message = 'This lineup is locked for the round.';
  end if;

  if player_id is not null and not exists (
    select 1
    from public.player_ownerships o
    where o.fantasy_club_id = lineup_record.fantasy_club_id
      and o.real_player_id = player_id
      and o.status = 'active'
      and o.ended_at is null
  ) then
    raise exception using errcode = '23514', message = 'Only actively owned players can be selected.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger fantasy_lineups_lock_guard
before insert or update or delete on public.fantasy_lineups
for each row execute function public.guard_lineup_change();

create trigger fantasy_lineup_players_lock_guard
before insert or update or delete on public.fantasy_lineup_players
for each row execute function public.guard_lineup_change();

create function public.audit_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  found_league_id uuid;
  found_id uuid;
begin
  found_id := nullif(row_data ->> 'id', '')::uuid;
  if tg_table_name = 'game_leagues' then
    found_league_id := found_id;
  elsif row_data ? 'league_id' then
    found_league_id := nullif(row_data ->> 'league_id', '')::uuid;
  elsif row_data ? 'season_id' then
    select league_id into found_league_id from public.seasons where id = (row_data ->> 'season_id')::uuid;
  elsif row_data ? 'enabled_competition_id' then
    select s.league_id into found_league_id
    from public.enabled_competitions ec
    join public.seasons s on s.id = ec.season_id
    where ec.id = (row_data ->> 'enabled_competition_id')::uuid;
  end if;

  insert into public.audit_logs (
    league_id, actor_profile_id, action, target_table, target_id, old_data, new_data, request_id
  ) values (
    found_league_id,
    public.current_profile_id(),
    lower(tg_op),
    tg_table_name,
    found_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id'
  );
  return coalesce(new, old);
end;
$$;

create trigger game_leagues_audit after insert or update or delete on public.game_leagues for each row execute function public.audit_configuration_change();
create trigger league_memberships_audit after insert or update or delete on public.league_memberships for each row execute function public.audit_configuration_change();
create trigger invitations_audit after insert or update or delete on public.invitations for each row execute function public.audit_configuration_change();
create trigger fantasy_clubs_audit after insert or update or delete on public.fantasy_clubs for each row execute function public.audit_configuration_change();
create trigger seasons_audit after insert or update or delete on public.seasons for each row execute function public.audit_configuration_change();
create trigger enabled_competitions_audit after insert or update or delete on public.enabled_competitions for each row execute function public.audit_configuration_change();
create trigger scoring_rule_sets_audit after insert or update or delete on public.scoring_rule_sets for each row execute function public.audit_configuration_change();
create trigger administrator_corrections_audit after insert or update or delete on public.administrator_corrections for each row execute function public.audit_configuration_change();

create view public.club_financial_reconciliation
with (security_invoker = true)
as
select
  c.id as fantasy_club_id,
  c.league_id,
  c.available_balance_minor as cached_balance_minor,
  coalesce(sum(l.amount_minor), 0)::bigint as ledger_balance_minor,
  c.available_balance_minor = coalesce(sum(l.amount_minor), 0)::bigint as reconciled
from public.fantasy_clubs c
left join public.financial_ledger_entries l on l.fantasy_club_id = c.id
group by c.id;

create function public.create_private_league(
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

  insert into public.seasons (league_id, name, starts_on, ends_on, starting_budget_minor, status)
  values (league_record.id, trim(p_season_name), p_starts_on, p_ends_on, p_starting_budget_minor, 'active')
  returning * into season_record;

  return jsonb_build_object('leagueId', league_record.id, 'seasonId', season_record.id, 'role', 'admin');
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'That league URL is already in use.';
end;
$$;

create function public.create_league_invitation(
  p_league_id uuid,
  p_role public.league_role default 'manager',
  p_expires_in interval default interval '7 days',
  p_max_uses integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  plain_code text;
  invite_record public.invitations;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception using errcode = '42501', message = 'Only league administrators can create invitations.';
  end if;
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '90 days' or p_max_uses not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invitation expiry or use limit is invalid.';
  end if;
  plain_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));
  insert into public.invitations (
    league_id, code_hash, code_hint, role, created_by_profile_id, expires_at, max_uses
  ) values (
    p_league_id,
    encode(extensions.digest(plain_code, 'sha256'), 'hex'),
    right(plain_code, 4),
    p_role,
    public.current_profile_id(),
    now() + p_expires_in,
    p_max_uses
  ) returning * into invite_record;
  return jsonb_build_object('invitationId', invite_record.id, 'code', plain_code, 'expiresAt', invite_record.expires_at);
end;
$$;

create function public.join_private_league(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  invite_record public.invitations;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Sign in before joining a league.';
  end if;
  select * into invite_record
  from public.invitations
  where code_hash = encode(extensions.digest(upper(trim(p_invite_code)), 'sha256'), 'hex')
  for update;
  if not found or invite_record.revoked_at is not null or invite_record.expires_at <= now() or invite_record.use_count >= invite_record.max_uses then
    raise exception using errcode = '22023', message = 'This invitation is invalid, expired, revoked or already used.';
  end if;

  insert into public.league_memberships (league_id, profile_id, role, status)
  values (invite_record.league_id, actor_id, invite_record.role, 'active')
  on conflict (league_id, profile_id) do update
    set role = excluded.role, status = 'active', removed_at = null;
  update public.invitations set use_count = use_count + 1 where id = invite_record.id;
  return jsonb_build_object('leagueId', invite_record.league_id, 'role', invite_record.role);
end;
$$;

create function public.create_fantasy_club(
  p_league_id uuid,
  p_name text,
  p_abbreviation text,
  p_manager_display_name text,
  p_stadium_name text,
  p_primary_colour text,
  p_secondary_colour text,
  p_accent_colour text,
  p_badge_config jsonb default '{}'::jsonb,
  p_motto text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  season_record public.seasons;
  club_record public.fantasy_clubs;
  operation_id uuid := gen_random_uuid();
begin
  if actor_id is null or not public.is_league_member(p_league_id) then
    raise exception using errcode = '42501', message = 'Join the league before creating a club.';
  end if;
  select * into season_record from public.seasons
  where league_id = p_league_id and status = 'active'
  for share;
  if not found then
    raise exception using errcode = '55000', message = 'This league has no active season.';
  end if;

  insert into public.fantasy_clubs (
    league_id, owner_profile_id, name, abbreviation, manager_display_name, stadium_name,
    primary_colour, secondary_colour, accent_colour, badge_config, motto, available_balance_minor
  ) values (
    p_league_id, actor_id, trim(p_name), upper(trim(p_abbreviation)), trim(p_manager_display_name),
    trim(p_stadium_name), p_primary_colour, p_secondary_colour, p_accent_colour,
    coalesce(p_badge_config, '{}'::jsonb), nullif(trim(p_motto), ''), season_record.starting_budget_minor
  ) returning * into club_record;

  insert into public.financial_ledger_entries (
    league_id, season_id, fantasy_club_id, amount_minor, currency_code, reason,
    operation_id, description, created_by_profile_id
  ) values (
    p_league_id, season_record.id, club_record.id, season_record.starting_budget_minor,
    season_record.currency_code, 'initial_budget', operation_id, 'Initial transfer budget', actor_id
  );
  return jsonb_build_object('clubId', club_record.id, 'balanceMinor', club_record.available_balance_minor);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'That club name, abbreviation or manager club is already in use in this league.';
  when check_violation then
    raise exception using errcode = '22023', message = 'One or more club details are invalid.';
end;
$$;

-- RLS is enabled on every public table. Tables without a matching policy are service-role only.
do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end;
$$;

create policy profiles_read_shared on public.profiles for select to authenticated
  using (public.shares_league_with_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy leagues_read_member on public.game_leagues for select to authenticated
  using (public.is_league_member(id));
create policy leagues_update_admin on public.game_leagues for update to authenticated
  using (public.is_league_admin(id)) with check (public.is_league_admin(id));
create policy memberships_read_member on public.league_memberships for select to authenticated
  using (public.is_league_member(league_id));
create policy memberships_update_admin on public.league_memberships for update to authenticated
  using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy invitations_read_admin on public.invitations for select to authenticated
  using (public.is_league_admin(league_id));
create policy invitations_update_admin on public.invitations for update to authenticated
  using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));

create policy seasons_read_member on public.seasons for select to authenticated
  using (public.is_league_member(league_id));
create policy seasons_admin_write on public.seasons for all to authenticated
  using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy clubs_read_member on public.fantasy_clubs for select to authenticated
  using (public.is_league_member(league_id));
create policy clubs_update_owner_or_admin on public.fantasy_clubs for update to authenticated
  using (public.owns_fantasy_club(id) or public.is_league_admin(league_id))
  with check (public.owns_fantasy_club(id) or public.is_league_admin(league_id));

create policy real_competitions_authenticated_read on public.real_competitions for select to authenticated using (true);
create policy real_teams_authenticated_read on public.real_teams for select to authenticated using (true);
create policy real_players_authenticated_read on public.real_players for select to authenticated using (true);
create policy player_registrations_authenticated_read on public.player_team_season_registrations for select to authenticated using (true);
create policy fixtures_authenticated_read on public.fixtures for select to authenticated using (true);
create policy fixture_lineups_authenticated_read on public.fixture_lineups for select to authenticated using (true);
create policy fixture_events_authenticated_read on public.fixture_events for select to authenticated using (true);
create policy availability_authenticated_read on public.player_availability_records for select to authenticated using (true);
create policy fixture_stats_authenticated_read on public.fixture_player_statistics for select to authenticated using (true);

create policy enabled_competitions_member_read on public.enabled_competitions for select to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_member(s.league_id)));
create policy enabled_competitions_admin_write on public.enabled_competitions for all to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_admin(s.league_id)))
  with check (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_admin(s.league_id)));
create policy rounds_member_read on public.competition_rounds for select to authenticated
  using (exists (
    select 1 from public.enabled_competitions ec join public.seasons s on s.id = ec.season_id
    where ec.id = enabled_competition_id and public.is_league_member(s.league_id)
  ));
create policy knockout_brackets_member_read on public.private_knockout_brackets for select to authenticated
  using (exists (
    select 1 from public.enabled_competitions ec join public.seasons s on s.id = ec.season_id
    where ec.id = enabled_competition_id and public.is_league_member(s.league_id)
  ));
create policy knockout_ties_member_read on public.private_knockout_ties for select to authenticated
  using (exists (
    select 1 from public.private_knockout_brackets b
    join public.enabled_competitions ec on ec.id = b.enabled_competition_id
    join public.seasons s on s.id = ec.season_id
    where b.id = bracket_id and public.is_league_member(s.league_id)
  ));

create policy scoring_rules_member_read on public.scoring_rule_sets for select to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_member(s.league_id)));
create policy scoring_rules_admin_write on public.scoring_rule_sets for all to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_admin(s.league_id)))
  with check (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_admin(s.league_id)));
create policy player_points_member_read on public.player_match_points for select to authenticated
  using (exists (
    select 1 from public.enabled_competitions ec join public.seasons s on s.id = ec.season_id
    where ec.id = enabled_competition_id and public.is_league_member(s.league_id)
  ));
create policy point_breakdowns_member_read on public.point_breakdowns for select to authenticated
  using (exists (
    select 1 from public.player_match_points p
    join public.enabled_competitions ec on ec.id = p.enabled_competition_id
    join public.seasons s on s.id = ec.season_id
    where p.id = player_match_points_id and public.is_league_member(s.league_id)
  ));
create policy dynamic_values_member_read on public.dynamic_player_values for select to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_member(s.league_id)));
create policy value_history_member_read on public.player_value_history for select to authenticated
  using (exists (
    select 1 from public.dynamic_player_values v join public.seasons s on s.id = v.season_id
    where v.id = dynamic_player_value_id and public.is_league_member(s.league_id)
  ));

create policy ownerships_member_read on public.player_ownerships for select to authenticated
  using (public.is_league_member(league_id));
create policy ownership_history_member_read on public.ownership_history for select to authenticated
  using (public.is_league_member(league_id));
create policy ledger_member_read on public.financial_ledger_entries for select to authenticated
  using (public.is_league_member(league_id));
create policy released_players_member_read on public.released_players for select to authenticated
  using (public.is_league_member(league_id));

create policy offers_participant_read on public.transfer_offers for select to authenticated
  using (
    public.is_league_admin(league_id)
    or public.owns_fantasy_club(from_club_id)
    or public.owns_fantasy_club(to_club_id)
  );
create policy offer_players_participant_read on public.transfer_offer_players for select to authenticated
  using (exists (
    select 1 from public.transfer_offers o where o.id = transfer_offer_id
    and (public.is_league_admin(o.league_id) or public.owns_fantasy_club(o.from_club_id) or public.owns_fantasy_club(o.to_club_id))
  ));
create policy completed_transfers_member_read on public.completed_transfers for select to authenticated
  using (public.is_league_member(league_id));

create policy fantasy_lineups_member_read on public.fantasy_lineups for select to authenticated
  using (exists (select 1 from public.fantasy_clubs c where c.id = fantasy_club_id and public.is_league_member(c.league_id)));
create policy fantasy_lineups_owner_insert on public.fantasy_lineups for insert to authenticated
  with check (public.owns_fantasy_club(fantasy_club_id));
create policy fantasy_lineups_owner_update on public.fantasy_lineups for update to authenticated
  using (public.owns_fantasy_club(fantasy_club_id)) with check (public.owns_fantasy_club(fantasy_club_id));
create policy fantasy_lineups_owner_delete on public.fantasy_lineups for delete to authenticated
  using (public.owns_fantasy_club(fantasy_club_id));
create policy lineup_players_member_read on public.fantasy_lineup_players for select to authenticated
  using (exists (
    select 1 from public.fantasy_lineups l join public.fantasy_clubs c on c.id = l.fantasy_club_id
    where l.id = fantasy_lineup_id and public.is_league_member(c.league_id)
  ));
create policy lineup_players_owner_write on public.fantasy_lineup_players for all to authenticated
  using (exists (select 1 from public.fantasy_lineups l where l.id = fantasy_lineup_id and public.owns_fantasy_club(l.fantasy_club_id)))
  with check (exists (select 1 from public.fantasy_lineups l where l.id = fantasy_lineup_id and public.owns_fantasy_club(l.fantasy_club_id)));

create policy competition_totals_member_read on public.competition_totals for select to authenticated
  using (exists (
    select 1 from public.enabled_competitions ec join public.seasons s on s.id = ec.season_id
    where ec.id = enabled_competition_id and public.is_league_member(s.league_id)
  ));
create policy standings_member_read on public.league_standings for select to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id and public.is_league_member(s.league_id)));
create policy activity_member_read on public.activity_feed_entries for select to authenticated
  using (
    public.is_league_member(league_id)
    and (
      cardinality(visibility_club_ids) = 0
      or exists (select 1 from public.fantasy_clubs c where c.id = any(visibility_club_ids) and public.owns_fantasy_club(c.id))
      or public.is_league_admin(league_id)
    )
  );
create policy notifications_recipient_read on public.notifications for select to authenticated
  using (recipient_profile_id = public.current_profile_id());
create policy notifications_recipient_update on public.notifications for update to authenticated
  using (recipient_profile_id = public.current_profile_id())
  with check (recipient_profile_id = public.current_profile_id());

create policy sync_runs_admin_read on public.data_synchronisation_runs for select to authenticated
  using (league_id is not null and public.is_league_admin(league_id));
create policy api_logs_admin_read on public.api_request_logs for select to authenticated
  using (exists (
    select 1 from public.data_synchronisation_runs r
    where r.id = sync_run_id and r.league_id is not null and public.is_league_admin(r.league_id)
  ));
create policy corrections_admin_read on public.administrator_corrections for select to authenticated
  using (public.is_league_admin(league_id));
create policy corrections_admin_insert on public.administrator_corrections for insert to authenticated
  with check (public.is_league_admin(league_id) and requested_by_profile_id = public.current_profile_id());
create policy audit_admin_read on public.audit_logs for select to authenticated
  using (league_id is not null and public.is_league_admin(league_id));
create policy reconciliation_member_read on public.fantasy_clubs for select to authenticated
  using (public.is_league_member(league_id));

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant update on public.profiles, public.game_leagues, public.league_memberships,
  public.fantasy_clubs, public.invitations, public.seasons,
  public.enabled_competitions, public.scoring_rule_sets, public.fantasy_lineups,
  public.fantasy_lineup_players, public.notifications to authenticated;
grant insert, delete on public.fantasy_lineups, public.fantasy_lineup_players to authenticated;
grant insert, delete on public.seasons, public.enabled_competitions, public.scoring_rule_sets to authenticated;
grant insert on public.administrator_corrections to authenticated;
grant all on all tables in schema public to service_role;
revoke execute on function public.create_private_league(text, text, text, date, date, bigint) from public;
revoke execute on function public.create_league_invitation(uuid, public.league_role, interval, integer) from public;
revoke execute on function public.join_private_league(text) from public;
revoke execute on function public.create_fantasy_club(uuid, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.create_private_league(text, text, text, date, date, bigint) to authenticated;
grant execute on function public.create_league_invitation(uuid, public.league_role, interval, integer) to authenticated;
grant execute on function public.join_private_league(text) to authenticated;
grant execute on function public.create_fantasy_club(uuid, text, text, text, text, text, text, text, jsonb, text) to authenticated;

revoke execute on function public.current_profile_id() from anon;
revoke execute on function public.is_league_member(uuid) from anon;
revoke execute on function public.is_league_admin(uuid) from anon;
revoke execute on function public.owns_fantasy_club(uuid) from anon;
revoke execute on function public.create_private_league(text, text, text, date, date, bigint) from anon;
revoke execute on function public.create_league_invitation(uuid, public.league_role, interval, integer) from anon;
revoke execute on function public.join_private_league(text) from anon;
revoke execute on function public.create_fantasy_club(uuid, text, text, text, text, text, text, text, jsonb, text) from anon;
