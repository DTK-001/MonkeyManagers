import type {
  ActivityItem,
  DemoClub,
  DemoCompetition,
  DemoFixture,
  DemoPlayer,
  DemoState,
  DemoTeam
} from '../types';
import { realPremierPlayers, realPremierTeams } from './premier-2024';

export const demoTeams: DemoTeam[] = realPremierTeams;

export const demoCompetitions: DemoCompetition[] = [
  {
    id: 'premier',
    name: 'Crown Premier Division',
    shortName: 'CPD',
    format: 'league',
    status: 'Round 9 live',
    currentRound: 'Round 9',
    completeness: 100,
    colour: '#3fab77'
  },
  {
    id: 'cup',
    name: 'Heritage Challenge Cup',
    shortName: 'HCC',
    format: 'knockout',
    status: 'Round of 16',
    currentRound: 'Round of 16',
    completeness: 94,
    colour: '#c3a46d'
  },
  {
    id: 'europe',
    name: 'Continental Champions Series',
    shortName: 'CCS',
    format: 'european',
    status: 'League phase',
    currentRound: 'Matchday 4',
    completeness: 98,
    colour: '#768fc1'
  }
];

export const demoClubs: DemoClub[] = [
  {
    id: 'club-ravens',
    name: 'Holloway Ravens',
    abbreviation: 'HRV',
    manager: 'Alex Morgan',
    stadium: 'The Rookery',
    motto: 'Earn every roar',
    primary: '#0f4938',
    secondary: '#f4efe3',
    accent: '#c3a46d',
    budgetMinor: 36_400_000_00,
    totalPoints: 548.7,
    latestRoundPoints: 72.4,
    competitionWins: 3,
    highestRoundScore: 81.2,
    rank: 2,
    form: ['W', 'W', 'D', 'W', 'L']
  },
  {
    id: 'club-orbit',
    name: 'Orbital Athletic',
    abbreviation: 'ORB',
    manager: 'Jamie Chen',
    stadium: 'The Meridian',
    motto: 'Always in motion',
    primary: '#293f6f',
    secondary: '#f4efe3',
    accent: '#78a8d4',
    budgetMinor: 29_800_000_00,
    totalPoints: 561.15,
    latestRoundPoints: 68.1,
    competitionWins: 4,
    highestRoundScore: 84.45,
    rank: 1,
    form: ['W', 'D', 'W', 'W', 'W']
  },
  {
    id: 'club-foundry',
    name: 'Foundry Eleven',
    abbreviation: 'FDY',
    manager: 'Sam Patel',
    stadium: 'Ironworks Park',
    motto: 'Forged together',
    primary: '#6f302b',
    secondary: '#dad0bd',
    accent: '#d97f4b',
    budgetMinor: 41_200_000_00,
    totalPoints: 519.85,
    latestRoundPoints: 59.75,
    competitionWins: 2,
    highestRoundScore: 77.9,
    rank: 3,
    form: ['L', 'W', 'W', 'D', 'W']
  },
  {
    id: 'club-pilgrims',
    name: 'Greenwich Pilgrims',
    abbreviation: 'GWP',
    manager: 'Taylor Brooks',
    stadium: 'Compass Ground',
    motto: 'Forward by tradition',
    primary: '#4b315d',
    secondary: '#f0e9d9',
    accent: '#b68d63',
    budgetMinor: 47_600_000_00,
    totalPoints: 497.3,
    latestRoundPoints: 63.2,
    competitionWins: 1,
    highestRoundScore: 74.5,
    rank: 4,
    form: ['D', 'L', 'W', 'L', 'W']
  }
];

/*const firstNames = [
  'Ari',
  'Bastien',
  'Callum',
  'Dario',
  'Elias',
  'Felix',
  'Gabe',
  'Hugo',
  'Idris',
  'Jonas',
  'Kian',
  'Luca',
  'Mateo',
  'Nico',
  'Owen',
  'Pavel'
];
const lastNames = [
  'Adebayo',
  'Bellini',
  'Carver',
  'Dumont',
  'El-Amin',
  'Foster',
  'Graves',
  'Havel',
  'Iversen',
  'Jatta',
  'Kovacs',
  'Lobo',
  'Mensah',
  'Navarro',
  'Okafor',
  'Petrov',
  'Quinn',
  'Rossi',
  'Silva',
  'Tanaka'
];
const nationalities = [
  'England',
  'France',
  'Spain',
  'Portugal',
  'Ghana',
  'Denmark',
  'Japan',
  'Brazil'
];

const positions: Position[] = [
  ...Array<Position>(8).fill('GK'),
  ...Array<Position>(20).fill('DEF'),
  ...Array<Position>(20).fill('MID'),
  ...Array<Position>(16).fill('FWD')
];

function initialOwner(position: Position, positionIndex: number): string | null {
  const clubOrder = ['club-ravens', 'club-orbit', 'club-foundry', 'club-pilgrims'];
  const perClub = position === 'GK' ? 2 : position === 'FWD' ? 3 : 4;
  const clubIndex = Math.floor(positionIndex / perClub);
  return clubOrder[clubIndex] ?? null;
}

export const fictionalDemoPlayers: DemoPlayer[] = positions.map((position, index) => {
  const samePositionIndex = positions.slice(0, index).filter((item) => item === position).length;
  const baseMillions = 1.2 + ((index * 19) % 115) / 10;
  const valueMinor = Math.round(baseMillions * 100_000_000);
  const direction = index % 4 === 0 ? -1 : 1;
  const previousValueMinor = Math.round(
    valueMinor / (1 + direction * (0.006 + (index % 5) * 0.004))
  );
  const seasonPoints = Number((22 + ((index * 13.7) % 84)).toFixed(2));
  const recentPoints = Array.from({ length: 5 }, (_, match) =>
    Number((1.4 + ((index * 3.1 + match * 2.7) % 10.8)).toFixed(2))
  );
  return {
    id: `player-${String(index + 1).padStart(2, '0')}`,
    name: `${firstNames[index % firstNames.length]} ${lastNames[(index * 7 + 3) % lastNames.length]}`,
    position,
    teamId: demoTeams[index % demoTeams.length]?.id ?? 'team-1',
    nationality: nationalities[(index * 3) % nationalities.length] ?? 'England',
    competitionIds: index % 5 === 0 ? ['premier', 'cup', 'europe'] : ['premier', 'cup'],
    valueMinor,
    previousValueMinor,
    seasonPoints,
    recentPoints,
    form: Number((recentPoints.reduce((sum, score) => sum + score, 0) / 5).toFixed(2)),
    ownershipClubId: initialOwner(position, samePositionIndex),
    availability: index === 13 ? 'doubtful' : index === 37 ? 'injured' : 'available',
    provisional: index > 55,
    valueHistory: Array.from({ length: 8 }, (_, point) => ({
      date: new Date(Date.UTC(2026, 5, 1 + point * 5)).toISOString().slice(0, 10),
      valueMinor: Math.max(
        50_000_000,
        Math.round(valueMinor * (0.92 + point * 0.012 + ((index + point) % 3) * 0.004))
      )
    }))
  };
});*/

export const demoPlayers = realPremierPlayers as DemoPlayer[];

export const demoFixtures: DemoFixture[] = [
  {
    id: 'fixture-1',
    competitionId: 'premier',
    round: 'Round 8',
    homeTeamId: 'team-1',
    awayTeamId: 'team-4',
    kickoff: '2026-07-08T18:45:00Z',
    status: 'completed',
    homeScore: 2,
    awayScore: 1
  },
  {
    id: 'fixture-2',
    competitionId: 'cup',
    round: 'Round of 16',
    homeTeamId: 'team-2',
    awayTeamId: 'team-5',
    kickoff: '2026-07-09T19:00:00Z',
    status: 'completed',
    homeScore: 1,
    awayScore: 1
  },
  {
    id: 'fixture-3',
    competitionId: 'premier',
    round: 'Round 9',
    homeTeamId: 'team-3',
    awayTeamId: 'team-7',
    kickoff: '2026-07-12T14:00:00Z',
    status: 'upcoming'
  },
  {
    id: 'fixture-4',
    competitionId: 'europe',
    round: 'Matchday 4',
    homeTeamId: 'team-6',
    awayTeamId: 'team-8',
    kickoff: '2026-07-14T19:45:00Z',
    status: 'upcoming'
  }
];

export const demoActivity: ActivityItem[] = [
  {
    id: 'activity-1',
    type: 'score',
    title: 'Round 8 complete',
    detail: 'Holloway Ravens climbed to second with 72.40 points.',
    timestamp: '2026-07-10T08:15:00Z'
  },
  {
    id: 'activity-2',
    type: 'transfer',
    title: 'Market movement',
    detail: 'Orbital Athletic signed Hugo Carver for £8.1m.',
    timestamp: '2026-07-10T07:32:00Z'
  },
  {
    id: 'activity-3',
    type: 'sync',
    title: 'Nightly data complete',
    detail: '12 fixtures checked · 2 performances corrected · 88 requests remaining.',
    timestamp: '2026-07-10T03:37:00Z'
  },
  {
    id: 'activity-4',
    type: 'value',
    title: 'Value watch',
    detail: 'Bastien Graves rose 4.1% after a third consecutive strong performance.',
    timestamp: '2026-07-09T03:39:00Z'
  }
];

const initialStarters = demoPlayers
  .filter((player) => player.ownershipClubId === 'club-ravens')
  .filter((player) =>
    player.position === 'GK'
      ? player.id === 'player-01'
      : player.position === 'DEF'
        ? ['player-09', 'player-10', 'player-11', 'player-12'].includes(player.id)
        : player.position === 'MID'
          ? ['player-29', 'player-30', 'player-31', 'player-32'].includes(player.id)
          : ['player-49', 'player-50'].includes(player.id)
  )
  .map((player) => player.id);

const currentSquadIds = demoPlayers
  .filter((player) => player.ownershipClubId === 'club-ravens')
  .map((player) => player.id);

export const createInitialDemoState = (): DemoState => ({
  demoActive: false,
  selectedLeagueId: 'league-friday',
  currentClubId: 'club-ravens',
  clubs: demoClubs,
  players: demoPlayers,
  competitions: demoCompetitions,
  fixtures: demoFixtures,
  starters: initialStarters,
  bench: currentSquadIds.filter((id) => !initialStarters.includes(id)).slice(0, 7),
  captainId: initialStarters.find((id) => id === 'player-49') ?? initialStarters[0] ?? null,
  viceCaptainId: initialStarters.find((id) => id === 'player-31') ?? initialStarters[1] ?? null,
  activity: demoActivity,
  lastUpdated: '2026-07-10T03:37:00Z',
  marketOpen: true,
  message: null
});
