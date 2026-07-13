import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
if (!response.ok) throw new Error(`Fantasy Premier League returned ${response.status}.`);
const payload = await response.json();
// 777 is the official Premier League 2025/26 competition-season identifier.
const profileResponse = await fetch('https://footballapi.pulselive.com/football/stats/ranked/players/appearances?comps=1&comp=1&compSeasons=777&compsCodeForSort=PL&altIds=true&page=0&pageSize=1000&compCodeForSort=PL', {
  headers: { Origin: 'https://www.premierleague.com' }
});
if (!profileResponse.ok) throw new Error(`Premier League player profiles returned ${profileResponse.status}.`);
const profilePayload = await profileResponse.json();
const nationalitiesByOptaId = new Map(
  (profilePayload?.stats?.content ?? []).flatMap((item) => {
    const owner = item?.owner;
    const optaId = owner?.altIds?.opta;
    const nationality = owner?.nationalTeam?.country ?? owner?.birth?.country?.country;
    return typeof optaId === 'string' && typeof nationality === 'string' ? [[optaId, nationality]] : [];
  })
);
const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const colours = ['#683A2D', '#284870', '#0F5C42', '#8B6A2B', '#523A71', '#A44343', '#2F6C78', '#6D5A3D'];
const teams = (payload.teams ?? []).map((team, index) => ({
  id: `fpl-team-${team.id}`, name: team.name, shortName: team.short_name, colour: colours[index % colours.length]
}));
const players = (payload.elements ?? [])
  .filter((player) => !player.removed && positions[player.element_type])
  .map((player) => {
    const valueMinor = Number(player.now_cost) * 10_000_000;
    const seasonPoints = Number(player.total_points ?? 0);
    const form = Number(player.form ?? 0);
    const name = `${player.first_name ?? ''} ${player.second_name ?? player.web_name ?? ''}`.trim();
    return {
      id: `fpl-player-${player.id}`, name, position: positions[player.element_type], teamId: `fpl-team-${player.team}`,
      birthDate: player.birth_date ?? null, nationality: nationalitiesByOptaId.get(player.opta_code) ?? 'Unknown', competitionIds: ['premier'], valueMinor, previousValueMinor: Math.max(50_000_000, valueMinor - Number(player.cost_change_start ?? 0) * 10_000_000),
      seasonPoints, recentPoints: Array.from({ length: 5 }, (_, index) => Number(Math.max(0, form + (index - 2) * 0.25).toFixed(2))), form,
      ownershipClubId: null, availability: player.status === 'i' ? 'injured' : player.status === 'd' ? 'doubtful' : 'available',
      availabilityDetail: {
        chanceThisRound: player.chance_of_playing_this_round ?? null,
        chanceNextRound: player.chance_of_playing_next_round ?? null,
        news: player.news || null
      },
      seasonStats: {
        minutes: Number(player.minutes ?? 0), starts: Number(player.starts ?? 0), goals: Number(player.goals_scored ?? 0), assists: Number(player.assists ?? 0),
        cleanSheets: Number(player.clean_sheets ?? 0), goalsConceded: Number(player.goals_conceded ?? 0), ownGoals: Number(player.own_goals ?? 0),
        penaltiesSaved: Number(player.penalties_saved ?? 0), penaltiesMissed: Number(player.penalties_missed ?? 0), yellowCards: Number(player.yellow_cards ?? 0),
        redCards: Number(player.red_cards ?? 0), saves: Number(player.saves ?? 0), bonus: Number(player.bonus ?? 0), bps: Number(player.bps ?? 0),
        expectedGoals: Number(player.expected_goals ?? 0), expectedAssists: Number(player.expected_assists ?? 0),
        expectedGoalInvolvements: Number(player.expected_goal_involvements ?? 0), expectedGoalsConceded: Number(player.expected_goals_conceded ?? 0),
        influence: Number(player.influence ?? 0), creativity: Number(player.creativity ?? 0), threat: Number(player.threat ?? 0), ictIndex: Number(player.ict_index ?? 0)
      },
      marketInterest: {
        selectedByPercent: Number(player.selected_by_percent ?? 0), transfersInEvent: Number(player.transfers_in_event ?? 0), transfersOutEvent: Number(player.transfers_out_event ?? 0),
        transfersInSeason: Number(player.transfers_in ?? 0), transfersOutSeason: Number(player.transfers_out ?? 0)
      },
      provisional: true,
      valueHistory: Array.from({ length: 8 }, (_, index) => ({ date: `2026-0${Math.min(8, index + 1)}-01`, valueMinor: Math.max(50_000_000, valueMinor - (7 - index) * 2_000_000) }))
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const destination = resolve('src/data/premier-2024.ts');
const marketSeedDestination = resolve('supabase/migrations/20260713213000_seed_bundled_catalogue_market.sql');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `// Generated from the public Fantasy Premier League catalogue for the 2025/26 Premier League player pool.\nexport const realPremierTeams = ${JSON.stringify(teams, null, 2)};\n\nexport const realPremierPlayers = ${JSON.stringify(players, null, 2)};\n`, 'utf8');
const sql = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const marketRows = players.map((player) => `  (${[
  sql('fpl-catalogue'), sql(player.id), sql(player.name), sql(player.name.split(' ')[0]), sql(player.name.split(' ').slice(1).join(' ')),
  player.birthDate ? sql(player.birthDate) : 'null', player.nationality === 'Unknown' ? 'null' : sql(player.nationality), sql(player.position),
  sql(JSON.stringify({ cataloguePlayerId: player.id, teamId: player.teamId, valueMinor: player.valueMinor, previousValueMinor: player.previousValueMinor })), 'now()'
].join(', ')})`).join(',\n');
await writeFile(marketSeedDestination, `-- Generated by tools/build-premier-2024-roster.mjs.\n-- This permanent catalogue replaces the admin profile-refresh prerequisite for market operations.\ninsert into public.real_players (provider, provider_external_id, display_name, first_name, last_name, birth_date, nationality, position, raw_payload, last_synced_at)\nvalues\n${marketRows}\non conflict (provider, provider_external_id) do update set\n  display_name = excluded.display_name, first_name = excluded.first_name, last_name = excluded.last_name,\n  birth_date = excluded.birth_date, nationality = excluded.nationality, position = excluded.position,\n  raw_payload = excluded.raw_payload, last_synced_at = excluded.last_synced_at, updated_at = now();\n\ninsert into public.player_catalogue_profiles (\n  catalogue_player_id, api_football_player_id, real_player_id, display_name, team_name, position, birth_date, nationality,\n  match_status, match_confidence, current_value_minor, previous_value_minor, source_updated_at\n)\nselect\n  player.raw_payload ->> 'cataloguePlayerId', null, player.id, player.display_name, player.raw_payload ->> 'teamId', player.position,\n  player.birth_date, player.nationality, 'matched', 100,\n  (player.raw_payload ->> 'valueMinor')::bigint, (player.raw_payload ->> 'previousValueMinor')::bigint, now()\nfrom public.real_players player\nwhere player.provider = 'fpl-catalogue'\non conflict (catalogue_player_id) do update set\n  real_player_id = excluded.real_player_id, display_name = excluded.display_name, team_name = excluded.team_name,\n  position = excluded.position, birth_date = excluded.birth_date, nationality = excluded.nationality,\n  match_status = excluded.match_status, match_confidence = excluded.match_confidence,\n  current_value_minor = excluded.current_value_minor, previous_value_minor = excluded.previous_value_minor,\n  source_updated_at = excluded.source_updated_at, updated_at = now();\n`,'utf8');
const generatedMarketSeed = await readFile(marketSeedDestination, 'utf8');
await writeFile(
  marketSeedDestination,
  generatedMarketSeed.replace(
    'real_player_id = excluded.real_player_id, display_name = excluded.display_name',
    'real_player_id = coalesce(player_catalogue_profiles.real_player_id, excluded.real_player_id), display_name = excluded.display_name'
  ),
  'utf8'
);
console.log(`Wrote ${players.length} players and ${teams.length} teams to ${destination}.`);
