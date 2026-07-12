import type { DemoClub } from '../../types';
import { supabase } from '../../lib/supabase';

const LAST_LEAGUE_KEY_PREFIX = 'monkey-managers-last-league:';

type SavedClubRow = {
  id: string;
  league_id: string;
  name: string;
  abbreviation: string;
  manager_display_name: string;
  stadium_name: string;
  motto: string | null;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  badge_config: unknown;
  available_balance_minor: number;
  updated_at: string;
};

interface SavedClub {
  club: DemoClub;
  leagueId: string;
  leagueName: string;
}

export async function loadSavedClub(authUserId: string, preferredLeagueId?: string): Promise<SavedClub | null> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: clubs, error: clubsError } = await supabase
    .from('fantasy_clubs')
    .select('id,league_id,name,abbreviation,manager_display_name,stadium_name,motto,primary_colour,secondary_colour,accent_colour,badge_config,available_balance_minor,updated_at')
    .eq('owner_profile_id', profile.id)
    .order('updated_at', { ascending: false });
  if (clubsError) throw clubsError;
  if (clubs.length === 0) return null;

  const preferredLeague = preferredLeagueId ?? readLastLeague(authUserId);
  const selected =
    (preferredLeague ? clubs.find((club) => club.league_id === preferredLeague) : null) ?? clubs[0];
  if (!selected) return null;
  const { data: league, error: leagueError } = await supabase
    .from('game_leagues')
    .select('name')
    .eq('id', selected.league_id)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!league) throw new Error('Your saved league could not be found.');

  const club = selected as SavedClubRow;
  return {
    leagueId: club.league_id,
    leagueName: (league as { name: string }).name,
    club: {
      id: club.id,
      name: club.name,
      abbreviation: club.abbreviation,
      manager: club.manager_display_name,
      stadium: club.stadium_name,
      motto: club.motto ?? '',
      primary: club.primary_colour,
      secondary: club.secondary_colour,
      accent: club.accent_colour,
      ...badgeFromConfig(club.badge_config),
      budgetMinor: Number(club.available_balance_minor),
      totalPoints: 0,
      latestRoundPoints: 0,
      competitionWins: 0,
      highestRoundScore: 0,
      rank: 0,
      form: []
    }
  };
}

export function rememberLastLeague(authUserId: string, leagueId: string): void {
  localStorage.setItem(`${LAST_LEAGUE_KEY_PREFIX}${authUserId}`, leagueId);
}

function readLastLeague(authUserId: string): string | null {
  return localStorage.getItem(`${LAST_LEAGUE_KEY_PREFIX}${authUserId}`);
}

function badgeFromConfig(value: unknown): Pick<DemoClub, 'badgeShape' | 'badgePattern' | 'badgeSymbol'> {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    badgeShape: config.shape === 'round' || config.shape === 'pennant' ? config.shape : 'shield',
    badgePattern: config.pattern === 'stripes' || config.pattern === 'split' ? config.pattern : 'sash',
    badgeSymbol: config.symbol === 'ball' || config.symbol === 'crown' ? config.symbol : 'star'
  };
}
