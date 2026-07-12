import { requireSupabase } from '../../lib/supabase';

export type ServerMarketPlayer = {
  cataloguePlayerId: string;
  realPlayerId: string;
  ownerClubId: string | null;
  valueMinor: number;
  previousValueMinor: number;
};

export async function loadServerMarket(
  leagueId: string,
  fantasyClubId: string
): Promise<{ players: ServerMarketPlayer[]; balanceMinor: number }> {
  const supabase = requireSupabase();
  const { data: profiles, error: profileError } = await supabase
    .from('player_catalogue_profiles')
    .select('catalogue_player_id,real_player_id,current_value_minor,previous_value_minor')
    .not('real_player_id', 'is', null)
    .not('current_value_minor', 'is', null);
  if (profileError) throw profileError;
  if (profiles.length === 0) {
    throw new Error('The live player catalogue is not ready. Refresh player profiles from Control room first.');
  }

  const realPlayerIds = profiles.flatMap((profile) =>
    profile.real_player_id ? [String(profile.real_player_id)] : []
  );
  const { data: ownerships, error: ownershipError } = realPlayerIds.length
    ? await supabase
        .from('player_ownerships')
        .select('real_player_id,fantasy_club_id')
        .eq('league_id', leagueId)
        .eq('status', 'active')
        .is('ended_at', null)
        .in('real_player_id', realPlayerIds)
    : { data: [], error: null };
  if (ownershipError) throw ownershipError;

  const { data: club, error: clubError } = await supabase
    .from('fantasy_clubs')
    .select('available_balance_minor')
    .eq('id', fantasyClubId)
    .maybeSingle();
  if (clubError) throw clubError;
  if (!club) throw new Error('Your club could not be found.');

  const owners = new Map(
    ownerships.map((ownership) => [
      String(ownership.real_player_id),
      String(ownership.fantasy_club_id)
    ])
  );
  return {
    players: profiles.flatMap((profile) => {
      if (!profile.real_player_id || profile.current_value_minor === null) return [];
      const realPlayerId = String(profile.real_player_id);
      return [
        {
          cataloguePlayerId: String(profile.catalogue_player_id),
          realPlayerId,
          ownerClubId: owners.get(realPlayerId) ?? null,
          valueMinor: Number(profile.current_value_minor),
          previousValueMinor: Number(profile.previous_value_minor ?? profile.current_value_minor)
        }
      ];
    }),
    balanceMinor: Number(club.available_balance_minor)
  };
}

export async function runServerMarketOperation(
  kind: 'purchase' | 'release',
  fantasyClubId: string,
  cataloguePlayerId: string
): Promise<number> {
  const supabase = requireSupabase();
  const functionName = kind === 'purchase' ? 'purchase_catalogue_player' : 'release_catalogue_player';
  const response = (await supabase.rpc(functionName, {
    p_fantasy_club_id: fantasyClubId,
    p_catalogue_player_id: cataloguePlayerId,
    p_idempotency_key: crypto.randomUUID()
  })) as { data: unknown; error: Error | null };
  const { data, error } = response;
  if (error) throw error;
  const result = data as { balanceMinor?: unknown } | null;
  const balanceMinor = Number(result?.balanceMinor);
  if (!Number.isSafeInteger(balanceMinor)) throw new Error('The market operation returned an invalid balance.');
  return balanceMinor;
}
