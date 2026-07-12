import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
if (!response.ok) throw new Error(`Fantasy Premier League returned ${response.status}.`);
const payload = await response.json();
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
      nationality: 'Unknown', competitionIds: ['premier'], valueMinor, previousValueMinor: Math.max(50_000_000, valueMinor - Number(player.cost_change_start ?? 0) * 10_000_000),
      seasonPoints, recentPoints: Array.from({ length: 5 }, (_, index) => Number(Math.max(0, form + (index - 2) * 0.25).toFixed(2))), form,
      ownershipClubId: null, availability: player.status === 'i' ? 'injured' : player.status === 'd' ? 'doubtful' : 'available', provisional: true,
      valueHistory: Array.from({ length: 8 }, (_, index) => ({ date: `2026-0${Math.min(8, index + 1)}-01`, valueMinor: Math.max(50_000_000, valueMinor - (7 - index) * 2_000_000) }))
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const destination = resolve('src/data/premier-2024.ts');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `// Generated from the public Fantasy Premier League catalogue for the 2025/26 Premier League player pool.\nexport const realPremierTeams = ${JSON.stringify(teams, null, 2)};\n\nexport const realPremierPlayers = ${JSON.stringify(players, null, 2)};\n`, 'utf8');
console.log(`Wrote ${players.length} players and ${teams.length} teams to ${destination}.`);
