-- Atomic, replay-safe market operations. All state changes happen in one transaction.

create function public.market_request_fingerprint(variadic p_parts text[])
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(extensions.digest(array_to_string(p_parts, '|', '<null>'), 'sha256'), 'hex')
$$;

create function public.validate_transfer_offer_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  from_league uuid;
  to_league uuid;
  season_league uuid;
begin
  select league_id into from_league from public.fantasy_clubs where id = new.from_club_id;
  select league_id into to_league from public.fantasy_clubs where id = new.to_club_id;
  select league_id into season_league from public.seasons where id = new.season_id;
  if from_league is null or to_league is null or season_league is null
     or from_league <> new.league_id or to_league <> new.league_id or season_league <> new.league_id then
    raise exception using errcode = '23514', message = 'Offer clubs, season and league do not match.';
  end if;
  if new.cash_amount_minor > 0 and (
    new.cash_payer_club_id not in (new.from_club_id, new.to_club_id)
    or new.cash_recipient_club_id not in (new.from_club_id, new.to_club_id)
  ) then
    raise exception using errcode = '23514', message = 'Offer cash must move between the two participating clubs.';
  end if;
  return new;
end;
$$;

create trigger transfer_offers_validate_scope
before insert or update on public.transfer_offers
for each row execute function public.validate_transfer_offer_scope();

create function public.validate_transfer_offer_player_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  offer_record public.transfer_offers;
begin
  select * into offer_record from public.transfer_offers where id = new.transfer_offer_id for update;
  if not found or offer_record.status <> 'pending' then
    raise exception using errcode = '23514', message = 'Players can only be added to a pending offer.';
  end if;
  if new.from_club_id not in (offer_record.from_club_id, offer_record.to_club_id)
     or new.to_club_id not in (offer_record.from_club_id, offer_record.to_club_id)
     or new.from_club_id = new.to_club_id then
    raise exception using errcode = '23514', message = 'Offer player movement must be between participating clubs.';
  end if;
  if not exists (
    select 1 from public.player_ownerships o
    where o.id = new.expected_ownership_id
      and o.real_player_id = new.real_player_id
      and o.fantasy_club_id = new.from_club_id
      and o.league_id = offer_record.league_id
      and o.status = 'active' and o.ended_at is null
  ) then
    raise exception using errcode = '23514', message = 'The offered player is not actively owned by the expected club.';
  end if;
  return new;
end;
$$;

create trigger transfer_offer_players_validate_scope
before insert or update on public.transfer_offer_players
for each row execute function public.validate_transfer_offer_player_scope();

create function public.create_transfer_offer(
  p_from_club_id uuid,
  p_to_club_id uuid,
  p_idempotency_key uuid,
  p_cash_amount_minor bigint default 0,
  p_cash_paid_by_from_club boolean default true,
  p_player_moves jsonb default '[]'::jsonb,
  p_expires_in interval default interval '3 days',
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  from_club public.fantasy_clubs;
  to_club public.fantasy_clubs;
  season_record public.seasons;
  ownership_record public.player_ownerships;
  offer_record public.transfer_offers;
  existing_record public.idempotency_records;
  move jsonb;
  move_player_id uuid;
  move_from_club_id uuid;
  move_to_club_id uuid;
  seen_players uuid[] := '{}';
  player_count integer;
  request_hash text;
  response_body jsonb;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;
  if p_from_club_id = p_to_club_id then
    raise exception using errcode = '22023', message = 'A transfer offer requires two different clubs.';
  end if;
  if p_cash_amount_minor < 0 or p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days' then
    raise exception using errcode = '22023', message = 'The cash amount or offer expiry is invalid.';
  end if;
  if p_message is not null and char_length(p_message) > 500 then
    raise exception using errcode = '22023', message = 'The offer message is too long.';
  end if;
  if jsonb_typeof(coalesce(p_player_moves, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Player moves must be supplied as a JSON array.';
  end if;
  player_count := jsonb_array_length(coalesce(p_player_moves, '[]'::jsonb));
  if player_count > 10 then
    raise exception using errcode = '22023', message = 'An offer can contain at most ten players.';
  end if;
  if p_cash_amount_minor = 0 and player_count = 0 then
    raise exception using errcode = '22023', message = 'A transfer offer must include cash or at least one player.';
  end if;

  request_hash := public.market_request_fingerprint(
    p_from_club_id::text, p_to_club_id::text, p_cash_amount_minor::text,
    p_cash_paid_by_from_club::text, coalesce(p_player_moves, '[]'::jsonb)::text,
    p_expires_in::text, coalesce(p_message, '')
  );
  perform pg_advisory_xact_lock(hashtextextended('create_transfer_offer:' || p_idempotency_key::text, 0));
  select * into existing_record from public.idempotency_records
    where operation_type = 'create_transfer_offer' and idempotency_key = p_idempotency_key;
  if found then
    if existing_record.request_fingerprint <> request_hash then
      raise exception using errcode = '22023', message = 'This idempotency key was already used for another offer.';
    end if;
    return existing_record.response;
  end if;

  perform id from public.fantasy_clubs where id in (p_from_club_id, p_to_club_id) order by id for update;
  select * into from_club from public.fantasy_clubs where id = p_from_club_id;
  select * into to_club from public.fantasy_clubs where id = p_to_club_id;
  if from_club.id is null or to_club.id is null or from_club.league_id <> to_club.league_id then
    raise exception using errcode = 'P0001', message = 'MM_OFFER_INVALID: Both clubs must belong to the same league.';
  end if;
  if not public.owns_fantasy_club(from_club.id) then
    raise exception using errcode = '42501', message = 'You cannot make an offer from this club.';
  end if;
  select * into season_record from public.seasons
    where league_id = from_club.league_id and status = 'active' for share;
  if not found or season_record.transfer_market_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'MM_MARKET_CLOSED: In-season transfers are not currently open.';
  end if;

  -- Lock and validate every expected owner before publishing the offer.
  for move in select value from jsonb_array_elements(coalesce(p_player_moves, '[]'::jsonb))
  loop
    begin
      move_player_id := (move ->> 'realPlayerId')::uuid;
      move_from_club_id := (move ->> 'fromClubId')::uuid;
      move_to_club_id := (move ->> 'toClubId')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'A player move contains an invalid identifier.';
    end;
    if move_player_id is null or move_from_club_id is null or move_to_club_id is null
       or move_from_club_id = move_to_club_id
       or move_from_club_id not in (from_club.id, to_club.id)
       or move_to_club_id not in (from_club.id, to_club.id) then
      raise exception using errcode = '22023', message = 'A player move is not between the two participating clubs.';
    end if;
    if move_player_id = any(seen_players) then
      raise exception using errcode = '22023', message = 'The same player cannot appear twice in an offer.';
    end if;
    select * into ownership_record from public.player_ownerships
      where league_id = from_club.league_id and real_player_id = move_player_id
        and fantasy_club_id = move_from_club_id and status = 'active' and ended_at is null
      for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'MM_OWNERSHIP_CHANGED: An offered player is no longer owned by the expected club.';
    end if;
    seen_players := array_append(seen_players, move_player_id);
  end loop;

  insert into public.transfer_offers (
    league_id, season_id, from_club_id, to_club_id, cash_payer_club_id,
    cash_recipient_club_id, cash_amount_minor, status, message, idempotency_key,
    expires_at, created_by_profile_id
  ) values (
    from_club.league_id, season_record.id, from_club.id, to_club.id,
    case when p_cash_amount_minor = 0 then null when p_cash_paid_by_from_club then from_club.id else to_club.id end,
    case when p_cash_amount_minor = 0 then null when p_cash_paid_by_from_club then to_club.id else from_club.id end,
    p_cash_amount_minor, 'pending', nullif(trim(p_message), ''), p_idempotency_key,
    now() + p_expires_in, actor_id
  ) returning * into offer_record;

  for move in select value from jsonb_array_elements(coalesce(p_player_moves, '[]'::jsonb))
  loop
    move_player_id := (move ->> 'realPlayerId')::uuid;
    move_from_club_id := (move ->> 'fromClubId')::uuid;
    move_to_club_id := (move ->> 'toClubId')::uuid;
    select * into ownership_record from public.player_ownerships
      where league_id = from_club.league_id and real_player_id = move_player_id
        and fantasy_club_id = move_from_club_id and status = 'active' and ended_at is null;
    insert into public.transfer_offer_players (
      transfer_offer_id, real_player_id, from_club_id, to_club_id, expected_ownership_id
    ) values (
      offer_record.id, move_player_id, move_from_club_id, move_to_club_id, ownership_record.id
    );
  end loop;

  insert into public.activity_feed_entries (
    league_id, season_id, event_type, actor_profile_id, fantasy_club_id,
    visibility_club_ids, headline, payload
  ) values (
    from_club.league_id, season_record.id, 'transfer_offer_made', actor_id, from_club.id,
    array[from_club.id, to_club.id], 'A private transfer offer was made',
    jsonb_build_object('offerId', offer_record.id)
  );
  insert into public.notifications (
    league_id, recipient_profile_id, type, title, body, payload
  ) values (
    from_club.league_id, to_club.owner_profile_id, 'transfer_offer', 'New transfer offer',
    from_club.name::text || ' sent your club a transfer offer.',
    jsonb_build_object('offerId', offer_record.id)
  );

  response_body := jsonb_build_object(
    'status', 'pending', 'offerId', offer_record.id, 'expiresAt', offer_record.expires_at,
    'cashAmountMinor', p_cash_amount_minor, 'playerCount', player_count
  );
  insert into public.idempotency_records (
    league_id, operation_type, idempotency_key, requester_profile_id, request_fingerprint, response
  ) values (
    from_club.league_id, 'create_transfer_offer', p_idempotency_key, actor_id, request_hash, response_body
  );
  return response_body;
end;
$$;

create function public.purchase_free_agent(
  p_fantasy_club_id uuid,
  p_real_player_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  club_record public.fantasy_clubs;
  season_record public.seasons;
  value_record public.dynamic_player_values;
  ownership_record public.player_ownerships;
  existing_record public.idempotency_records;
  request_hash text;
  response_body jsonb;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;
  request_hash := public.market_request_fingerprint(p_fantasy_club_id::text, p_real_player_id::text);
  perform pg_advisory_xact_lock(hashtextextended('purchase_free_agent:' || p_idempotency_key::text, 0));
  select * into existing_record from public.idempotency_records
    where operation_type = 'purchase_free_agent' and idempotency_key = p_idempotency_key;
  if found then
    if existing_record.request_fingerprint <> request_hash then
      raise exception using errcode = '22023', message = 'This idempotency key was already used for another purchase.';
    end if;
    return existing_record.response;
  end if;

  select * into club_record from public.fantasy_clubs where id = p_fantasy_club_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MM_CLUB_NOT_FOUND: The fantasy club was not found.';
  end if;
  if not public.owns_fantasy_club(club_record.id) then
    raise exception using errcode = '42501', message = 'You cannot buy players for this club.';
  end if;
  select * into season_record from public.seasons
    where league_id = club_record.league_id and status = 'active'
    for update;
  if not found or season_record.transfer_market_status not in ('initial_open', 'open') then
    raise exception using errcode = 'P0001', message = 'MM_MARKET_CLOSED: Transfers are not currently open.';
  end if;
  select * into value_record from public.dynamic_player_values
    where season_id = season_record.id and real_player_id = p_real_player_id
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MM_VALUE_UNAVAILABLE: This player does not yet have a market value.';
  end if;
  if value_record.current_value_minor < season_record.minimum_player_price_minor
     or value_record.current_value_minor > season_record.maximum_player_price_minor then
    raise exception using errcode = 'P0001', message = 'MM_VALUE_INVALID: This player value is outside league limits.';
  end if;
  if club_record.available_balance_minor < value_record.current_value_minor then
    raise exception using errcode = 'P0001', message = 'MM_INSUFFICIENT_FUNDS: Your club does not have enough available budget.';
  end if;

  begin
    insert into public.player_ownerships (
      league_id, season_id, real_player_id, fantasy_club_id, status, acquisition_type,
      acquisition_value_minor, book_value_minor, operation_id
    ) values (
      club_record.league_id, season_record.id, p_real_player_id, club_record.id, 'active',
      'free_agent_purchase', value_record.current_value_minor, value_record.current_value_minor,
      p_idempotency_key
    ) returning * into ownership_record;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'MM_PLAYER_UNAVAILABLE: Another manager has just purchased this player.',
        hint = 'Refresh the market and choose another player.';
  end;

  perform set_config('app.financial_operation', 'allowed', true);
  update public.fantasy_clubs
    set available_balance_minor = available_balance_minor - value_record.current_value_minor,
        squad_book_value_minor = squad_book_value_minor + value_record.current_value_minor
    where id = club_record.id
    returning * into club_record;

  insert into public.financial_ledger_entries (
    league_id, season_id, fantasy_club_id, amount_minor, currency_code, reason,
    operation_id, real_player_id, description, created_by_profile_id
  ) values (
    club_record.league_id, season_record.id, club_record.id, -value_record.current_value_minor,
    season_record.currency_code, 'free_agent_purchase', p_idempotency_key, p_real_player_id,
    'Free-agent player purchase', actor_id
  );
  insert into public.ownership_history (
    ownership_id, league_id, season_id, real_player_id, to_fantasy_club_id,
    event_type, fee_minor, operation_id
  ) values (
    ownership_record.id, club_record.league_id, season_record.id, p_real_player_id, club_record.id,
    'purchased_free_agent', value_record.current_value_minor, p_idempotency_key
  );
  insert into public.activity_feed_entries (
    league_id, season_id, event_type, actor_profile_id, fantasy_club_id, headline, payload
  ) values (
    club_record.league_id, season_record.id, 'player_purchased', actor_id, club_record.id,
    club_record.name::text || ' signed a player',
    jsonb_build_object('playerId', p_real_player_id, 'feeMinor', value_record.current_value_minor)
  );

  response_body := jsonb_build_object(
    'status', 'purchased',
    'ownershipId', ownership_record.id,
    'clubId', club_record.id,
    'playerId', p_real_player_id,
    'feeMinor', value_record.current_value_minor,
    'balanceMinor', club_record.available_balance_minor,
    'squadBookValueMinor', club_record.squad_book_value_minor
  );
  insert into public.idempotency_records (
    league_id, operation_type, idempotency_key, requester_profile_id, request_fingerprint, response
  ) values (
    club_record.league_id, 'purchase_free_agent', p_idempotency_key, actor_id, request_hash, response_body
  );
  return response_body;
end;
$$;

create function public.release_player(
  p_fantasy_club_id uuid,
  p_real_player_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  club_record public.fantasy_clubs;
  season_record public.seasons;
  value_record public.dynamic_player_values;
  ownership_record public.player_ownerships;
  existing_record public.idempotency_records;
  request_hash text;
  release_amount bigint;
  response_body jsonb;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;
  request_hash := public.market_request_fingerprint(p_fantasy_club_id::text, p_real_player_id::text);
  perform pg_advisory_xact_lock(hashtextextended('release_player:' || p_idempotency_key::text, 0));
  select * into existing_record from public.idempotency_records
    where operation_type = 'release_player' and idempotency_key = p_idempotency_key;
  if found then
    if existing_record.request_fingerprint <> request_hash then
      raise exception using errcode = '22023', message = 'This idempotency key was already used for another release.';
    end if;
    return existing_record.response;
  end if;

  select * into club_record from public.fantasy_clubs where id = p_fantasy_club_id for update;
  if not found or not public.owns_fantasy_club(p_fantasy_club_id) then
    raise exception using errcode = '42501', message = 'You cannot release players from this club.';
  end if;
  select * into season_record from public.seasons
    where league_id = club_record.league_id and status = 'active'
    for update;
  if not found or season_record.transfer_market_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'MM_MARKET_CLOSED: In-season transfers are not currently open.';
  end if;
  select * into ownership_record from public.player_ownerships
    where league_id = club_record.league_id and fantasy_club_id = club_record.id
      and real_player_id = p_real_player_id and status = 'active' and ended_at is null
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MM_NOT_OWNED: This player is not in your active squad.';
  end if;
  select * into value_record from public.dynamic_player_values
    where season_id = season_record.id and real_player_id = p_real_player_id
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MM_VALUE_UNAVAILABLE: This player does not have a current release value.';
  end if;
  release_amount := round(value_record.current_value_minor::numeric * season_record.free_agent_release_percentage)::bigint;
  if release_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'MM_RELEASE_VALUE_INVALID: The calculated release value is invalid.';
  end if;
  if club_record.squad_book_value_minor < ownership_record.book_value_minor then
    raise exception using errcode = 'P0001', message = 'MM_FINANCE_RECONCILIATION: Club book value needs administrator review.';
  end if;

  update public.player_ownerships
    set status = 'released', ended_at = now()
    where id = ownership_record.id;
  perform set_config('app.financial_operation', 'allowed', true);
  update public.fantasy_clubs
    set available_balance_minor = available_balance_minor + release_amount,
        squad_book_value_minor = squad_book_value_minor - ownership_record.book_value_minor
    where id = club_record.id
    returning * into club_record;

  insert into public.financial_ledger_entries (
    league_id, season_id, fantasy_club_id, amount_minor, currency_code, reason,
    operation_id, real_player_id, description, created_by_profile_id
  ) values (
    club_record.league_id, season_record.id, club_record.id, release_amount,
    season_record.currency_code, 'player_release', p_idempotency_key, p_real_player_id,
    'Player released to free agency', actor_id
  );
  insert into public.ownership_history (
    ownership_id, league_id, season_id, real_player_id, from_fantasy_club_id,
    event_type, fee_minor, operation_id,
    metadata
  ) values (
    ownership_record.id, club_record.league_id, season_record.id, p_real_player_id, club_record.id,
    'released', release_amount, p_idempotency_key,
    jsonb_build_object('releasePercentage', season_record.free_agent_release_percentage)
  );
  insert into public.released_players (
    ownership_id, league_id, season_id, fantasy_club_id, real_player_id,
    book_value_minor, release_value_minor, release_percentage, operation_id
  ) values (
    ownership_record.id, club_record.league_id, season_record.id, club_record.id, p_real_player_id,
    ownership_record.book_value_minor, release_amount, season_record.free_agent_release_percentage,
    p_idempotency_key
  );
  insert into public.activity_feed_entries (
    league_id, season_id, event_type, actor_profile_id, fantasy_club_id, headline, payload
  ) values (
    club_record.league_id, season_record.id, 'player_released', actor_id, club_record.id,
    club_record.name::text || ' released a player',
    jsonb_build_object('playerId', p_real_player_id, 'releaseValueMinor', release_amount)
  );

  response_body := jsonb_build_object(
    'status', 'released',
    'clubId', club_record.id,
    'playerId', p_real_player_id,
    'releaseValueMinor', release_amount,
    'balanceMinor', club_record.available_balance_minor,
    'squadBookValueMinor', club_record.squad_book_value_minor
  );
  insert into public.idempotency_records (
    league_id, operation_type, idempotency_key, requester_profile_id, request_fingerprint, response
  ) values (
    club_record.league_id, 'release_player', p_idempotency_key, actor_id, request_hash, response_body
  );
  return response_body;
end;
$$;

create function public.accept_transfer_offer(
  p_transfer_offer_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  actor_id uuid := public.current_profile_id();
  offer_record public.transfer_offers;
  season_record public.seasons;
  payer_record public.fantasy_clubs;
  recipient_record public.fantasy_clubs;
  old_ownership public.player_ownerships;
  new_ownership public.player_ownerships;
  player_move record;
  existing_record public.idempotency_records;
  completed_record public.completed_transfers;
  request_hash text;
  response_body jsonb;
  moved_count integer := 0;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;
  request_hash := public.market_request_fingerprint(p_transfer_offer_id::text);
  perform pg_advisory_xact_lock(hashtextextended('accept_transfer_offer:' || p_idempotency_key::text, 0));
  select * into existing_record from public.idempotency_records
    where operation_type = 'accept_transfer_offer' and idempotency_key = p_idempotency_key;
  if found then
    if existing_record.request_fingerprint <> request_hash then
      raise exception using errcode = '22023', message = 'This idempotency key was already used for another transfer.';
    end if;
    return existing_record.response;
  end if;

  select * into offer_record from public.transfer_offers where id = p_transfer_offer_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MM_OFFER_NOT_FOUND: The transfer offer was not found.';
  end if;
  if not public.owns_fantasy_club(offer_record.to_club_id) and not public.is_service_role() then
    raise exception using errcode = '42501', message = 'Only the receiving manager can accept this offer.';
  end if;
  if offer_record.status = 'accepted' then
    select * into completed_record from public.completed_transfers where transfer_offer_id = offer_record.id;
    response_body := completed_record.summary || jsonb_build_object('status', 'accepted', 'transferId', completed_record.id);
    insert into public.idempotency_records (
      league_id, operation_type, idempotency_key, requester_profile_id, request_fingerprint, response
    ) values (
      offer_record.league_id, 'accept_transfer_offer', p_idempotency_key, actor_id, request_hash, response_body
    );
    return response_body;
  end if;
  if offer_record.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'MM_OFFER_INACTIVE: This transfer offer is no longer active.';
  end if;
  if offer_record.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'MM_OFFER_EXPIRED: This transfer offer has expired.';
  end if;
  if offer_record.cash_amount_minor = 0 and not exists (
    select 1 from public.transfer_offer_players where transfer_offer_id = offer_record.id
  ) then
    raise exception using errcode = 'P0001', message = 'MM_OFFER_INVALID: A transfer must include cash or at least one player.';
  end if;
  select * into season_record from public.seasons where id = offer_record.season_id for update;
  if not found or season_record.status <> 'active' or season_record.transfer_market_status <> 'open' then
    raise exception using errcode = 'P0001', message = 'MM_MARKET_CLOSED: In-season transfers are not currently open.';
  end if;

  -- Stable lock ordering prevents two opposing swaps from deadlocking.
  perform id from public.fantasy_clubs
    where id in (offer_record.from_club_id, offer_record.to_club_id)
    order by id for update;
  perform o.id
    from public.player_ownerships o
    join public.transfer_offer_players op on op.expected_ownership_id = o.id
    where op.transfer_offer_id = offer_record.id
    order by o.id for update of o;

  if offer_record.cash_amount_minor > 0 then
    select * into payer_record from public.fantasy_clubs where id = offer_record.cash_payer_club_id;
    select * into recipient_record from public.fantasy_clubs where id = offer_record.cash_recipient_club_id;
    if payer_record.id not in (offer_record.from_club_id, offer_record.to_club_id)
       or recipient_record.id not in (offer_record.from_club_id, offer_record.to_club_id) then
      raise exception using errcode = 'P0001', message = 'MM_OFFER_INVALID: Cash direction is invalid.';
    end if;
    if payer_record.available_balance_minor < offer_record.cash_amount_minor then
      raise exception using errcode = 'P0001', message = 'MM_INSUFFICIENT_FUNDS: The paying club no longer has enough budget.';
    end if;
  end if;

  if exists (
    select 1
    from public.transfer_offer_players op
    left join public.player_ownerships o
      on o.id = op.expected_ownership_id
      and o.real_player_id = op.real_player_id
      and o.fantasy_club_id = op.from_club_id
      and o.league_id = offer_record.league_id
      and o.status = 'active' and o.ended_at is null
    where op.transfer_offer_id = offer_record.id and o.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'MM_OWNERSHIP_CHANGED: One or more offered players have changed owner.';
  end if;

  perform set_config('app.financial_operation', 'allowed', true);
  for player_move in
    select * from public.transfer_offer_players where transfer_offer_id = offer_record.id order by id
  loop
    select * into old_ownership from public.player_ownerships where id = player_move.expected_ownership_id for update;
    update public.player_ownerships set status = 'transferred', ended_at = now() where id = old_ownership.id;
    insert into public.player_ownerships (
      league_id, season_id, real_player_id, fantasy_club_id, status, acquisition_type,
      acquisition_value_minor, book_value_minor, operation_id
    ) values (
      offer_record.league_id, offer_record.season_id, old_ownership.real_player_id,
      player_move.to_club_id, 'active', 'manager_transfer', old_ownership.book_value_minor,
      old_ownership.book_value_minor, p_idempotency_key
    ) returning * into new_ownership;
    update public.fantasy_clubs
      set squad_book_value_minor = squad_book_value_minor - old_ownership.book_value_minor
      where id = player_move.from_club_id and squad_book_value_minor >= old_ownership.book_value_minor;
    if not found then
      raise exception using errcode = 'P0001', message = 'MM_FINANCE_RECONCILIATION: A club book value needs administrator review.';
    end if;
    update public.fantasy_clubs
      set squad_book_value_minor = squad_book_value_minor + old_ownership.book_value_minor
      where id = player_move.to_club_id;
    insert into public.ownership_history (
      ownership_id, league_id, season_id, real_player_id, from_fantasy_club_id,
      to_fantasy_club_id, event_type, fee_minor, operation_id, metadata
    ) values (
      old_ownership.id, offer_record.league_id, offer_record.season_id, old_ownership.real_player_id,
      player_move.from_club_id, player_move.to_club_id, 'manager_transfer',
      offer_record.cash_amount_minor, p_idempotency_key,
      jsonb_build_object('newOwnershipId', new_ownership.id, 'offerId', offer_record.id)
    );
    moved_count := moved_count + 1;
  end loop;

  if offer_record.cash_amount_minor > 0 then
    update public.fantasy_clubs
      set available_balance_minor = available_balance_minor - offer_record.cash_amount_minor
      where id = payer_record.id;
    update public.fantasy_clubs
      set available_balance_minor = available_balance_minor + offer_record.cash_amount_minor
      where id = recipient_record.id;
    insert into public.financial_ledger_entries (
      league_id, season_id, fantasy_club_id, amount_minor, currency_code, reason,
      operation_id, counterparty_club_id, description, created_by_profile_id
    ) values
      (offer_record.league_id, offer_record.season_id, payer_record.id, -offer_record.cash_amount_minor,
       season_record.currency_code, 'manager_transfer', p_idempotency_key, recipient_record.id,
       'Cash paid for manager transfer', actor_id),
      (offer_record.league_id, offer_record.season_id, recipient_record.id, offer_record.cash_amount_minor,
       season_record.currency_code, 'manager_transfer', p_idempotency_key, payer_record.id,
       'Cash received for manager transfer', actor_id);
  end if;

  update public.transfer_offers set status = 'accepted', responded_at = now() where id = offer_record.id;
  response_body := jsonb_build_object(
    'status', 'accepted',
    'offerId', offer_record.id,
    'cashAmountMinor', offer_record.cash_amount_minor,
    'playersMoved', moved_count
  );
  insert into public.completed_transfers (
    transfer_offer_id, league_id, season_id, operation_id, summary
  ) values (
    offer_record.id, offer_record.league_id, offer_record.season_id, p_idempotency_key, response_body
  ) returning * into completed_record;
  response_body := response_body || jsonb_build_object('transferId', completed_record.id);
  insert into public.activity_feed_entries (
    league_id, season_id, event_type, actor_profile_id, headline, payload
  ) values (
    offer_record.league_id, offer_record.season_id, 'transfer_accepted', actor_id,
    'A manager transfer was completed',
    jsonb_build_object('transferId', completed_record.id, 'fromClubId', offer_record.from_club_id,
      'toClubId', offer_record.to_club_id, 'playersMoved', moved_count)
  );
  insert into public.idempotency_records (
    league_id, operation_type, idempotency_key, requester_profile_id, request_fingerprint, response
  ) values (
    offer_record.league_id, 'accept_transfer_offer', p_idempotency_key, actor_id, request_hash, response_body
  );
  return response_body;
exception
  when unique_violation then
    raise exception using
      errcode = 'P0001',
      message = 'MM_TRANSFER_CONFLICT: The offer changed while it was being accepted.',
      hint = 'Refresh the offer before trying again.';
end;
$$;

revoke execute on function public.purchase_free_agent(uuid, uuid, uuid) from public;
revoke execute on function public.release_player(uuid, uuid, uuid) from public;
revoke execute on function public.accept_transfer_offer(uuid, uuid) from public;
revoke execute on function public.create_transfer_offer(uuid, uuid, uuid, bigint, boolean, jsonb, interval, text) from public;
grant execute on function public.create_transfer_offer(uuid, uuid, uuid, bigint, boolean, jsonb, interval, text) to authenticated, service_role;
grant execute on function public.purchase_free_agent(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.release_player(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.accept_transfer_offer(uuid, uuid) to authenticated, service_role;
revoke execute on function public.purchase_free_agent(uuid, uuid, uuid) from anon;
revoke execute on function public.release_player(uuid, uuid, uuid) from anon;
revoke execute on function public.accept_transfer_offer(uuid, uuid) from anon;
revoke execute on function public.create_transfer_offer(uuid, uuid, uuid, bigint, boolean, jsonb, interval, text) from anon;
